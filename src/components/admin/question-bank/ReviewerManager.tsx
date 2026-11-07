"use client"

// 题库审核名单：与广学账号衔接
//
// 添加：按用户名去账号中心（account.gxwtf.cn）搜人，带上头像 / 年级一起加入；
// 展示：表格显示头像、用户名、年级（不展示操作人 / 备注）。

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Search, Trash2, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/EmptyState"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { accountAvatarUrl, gradeLabel } from "@/lib/grade-label"

export interface ReviewerRow {
  id: string
  userName: string
  userId: number | null
  grade: number | null
  createdAt: string
}

interface ReviewerManagerProps {
  reviewers: ReviewerRow[]
}

interface AccountUser {
  id: number
  username: string
  grade: number | null
}

/** 账号中心返回的用户名做过 HTML 转义，这里还原一下再存 */
function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function AvatarCell({ userId, userName }: { userId: number | null; userName: string }) {
  const src = accountAvatarUrl(userId)
  return (
    <Avatar className="size-8">
      {src ? <AvatarImage src={src} alt={userName} /> : null}
      <AvatarFallback className="text-xs">{userName.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

export function ReviewerManager({ reviewers }: ReviewerManagerProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<AccountUser[] | null>(null)
  const [searching, setSearching] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState<string | null>(null)
  const [removing, setRemoving] = React.useState<string | null>(null)

  const existing = new Set(reviewers.map((reviewer) => reviewer.userName.toLowerCase()))

  const search = async () => {
    const keyword = query.trim()
    if (!keyword) {
      toast.error("先输入用户名 / 姓名")
      return
    }
    setSearching(true)
    setSearchError(null)
    setResults(null)
    try {
      // 直接调广学账号的管理员用户列表（*.gxwtf.cn 之间允许带凭证跨域）
      const response = await fetch(
        `https://account.gxwtf.cn/users?search=${encodeURIComponent(keyword)}&page=1&pageSize=10`,
        { credentials: "include", headers: { accept: "application/json" } },
      )
      if (response.status === 403) {
        throw new Error("当前浏览器没有账号中心管理员登录态：请先登录 account.gxwtf.cn（管理员账号）再回来查。")
      }
      if (!response.ok) throw new Error(`账号中心返回 ${response.status}`)
      const json = (await response.json()) as { users?: Array<Record<string, unknown>> }
      const users: AccountUser[] = (json.users ?? []).map((user) => {
        const grade = Number(user.grade)
        return {
          id: Number(user.id),
          username: decodeHtml(String(user.username ?? "")),
          grade: Number.isInteger(grade) && grade >= 7 && grade <= 13 ? grade : null,
        }
      })
      setResults(users)
      if (users.length === 0) setSearchError("没有搜到匹配的账号")
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "查询账号中心失败")
    } finally {
      setSearching(false)
    }
  }

  const add = async (payload: { userName: string; userId?: number | null; grade?: number | null }) => {
    setAdding(payload.userName)
    try {
      const response = await fetch("/api/admin/question-bank/reviewers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.error || `添加失败（${response.status}）`)
      toast.success(`已把 ${payload.userName} 加入题库审核名单`)
      setResults(null)
      setQuery("")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加失败，请稍后重试")
    } finally {
      setAdding(null)
    }
  }

  const remove = async (name: string) => {
    setRemoving(name)
    try {
      const response = await fetch("/api/admin/question-bank/reviewers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: name }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.error || `移除失败（${response.status}）`)
      toast.success(`已把 ${name} 移出审核名单`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除失败，请稍后重试")
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="reviewer-search">从广学账号查找同学</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="reviewer-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void search()
            }}
            placeholder="输入用户名 / 姓名 / 邮箱（账号中心搜索）"
            className="w-80"
            disabled={searching}
          />
          <Button type="button" onClick={() => void search()} disabled={searching}>
            {searching ? <Loader2 className="animate-spin" /> : <Search />}
            {searching ? "查找中…" : "查找"}
          </Button>
        </div>

        {searchError ? <p className="text-xs text-destructive">{searchError}</p> : null}

        {results && results.length > 0 ? (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">头像</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead className="w-[80px]">年级</TableHead>
                  <TableHead className="w-[120px] text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((user) => {
                  const already = existing.has(user.username.toLowerCase())
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <AvatarCell userId={user.id} userName={user.username} />
                      </TableCell>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell className="text-muted-foreground">{gradeLabel(user.grade) ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={already || adding !== null}
                          onClick={() =>
                            add({ userName: user.username, userId: user.id, grade: user.grade })
                          }
                        >
                          {adding === user.username ? <Loader2 className="animate-spin" /> : <Plus />}
                          {already ? "已在名单" : adding === user.username ? "添加中…" : "加入名单"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">
            审核名单
            <span className="ml-2 text-sm font-normal text-muted-foreground">共 {reviewers.length} 人</span>
          </h2>
        </div>

        {reviewers.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="审核名单还是空的"
            description="按用户名从广学账号搜到同学后加入，他们登录就能在「管理 → 题库管理」里看题和改题。"
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">头像</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead className="w-[90px]">年级</TableHead>
                  <TableHead className="w-[170px]">加入时间</TableHead>
                  <TableHead className="w-[100px] text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewers.map((reviewer) => (
                  <TableRow key={reviewer.id}>
                    <TableCell>
                      <AvatarCell userId={reviewer.userId} userName={reviewer.userName} />
                    </TableCell>
                    <TableCell className="font-medium">{reviewer.userName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {gradeLabel(reviewer.grade) ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(reviewer.createdAt).toLocaleString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-center">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={removing !== null}
                          >
                            {removing === reviewer.userName ? <Loader2 className="animate-spin" /> : <Trash2 />}
                            移出
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>把 {reviewer.userName} 移出题库审核名单？</AlertDialogTitle>
                            <AlertDialogDescription>
                              移出后该账号将无法再进入「题库管理」（已保存的修改和审计记录不受影响）。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              className="text-red-800 dark:text-red-300"
                              onClick={(event) => {
                                event.preventDefault()
                                void remove(reviewer.userName)
                              }}
                            >
                              确认移出
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

      </div>
    </div>
  )
}
