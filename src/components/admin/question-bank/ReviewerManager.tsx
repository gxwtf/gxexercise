"use client"

// 题库审核名单管理：网站管理员按「广学账号用户名」把人加进/移出名单。
// 名单成员可以进「题库管理」（看题组、改题目），但看不到「全部作答记录」等管理员页面。

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/EmptyState"
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

export interface ReviewerRow {
  id: string
  userName: string
  note: string | null
  createdBy: string | null
  createdAt: string
}

interface ReviewerManagerProps {
  reviewers: ReviewerRow[]
}

export function ReviewerManager({ reviewers }: ReviewerManagerProps) {
  const router = useRouter()
  const [userName, setUserName] = React.useState("")
  const [note, setNote] = React.useState("")
  const [adding, setAdding] = React.useState(false)
  const [removing, setRemoving] = React.useState<string | null>(null)

  const add = async () => {
    const name = userName.trim()
    if (!name) {
      toast.error("请填写广学账号用户名")
      return
    }
    setAdding(true)
    try {
      const response = await fetch("/api/admin/question-bank/reviewers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: name, note: note.trim() || null }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.error || `添加失败（${response.status}）`)
      toast.success(`已把 ${name} 加入题库审核名单`)
      setUserName("")
      setNote("")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加失败，请稍后重试")
    } finally {
      setAdding(false)
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="reviewer-name">广学账号用户名</Label>
          <Input
            id="reviewer-name"
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            placeholder="如：Wangzehao2009"
            maxLength={100}
            className="w-64"
            disabled={adding}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reviewer-note">备注（可选）</Label>
          <Input
            id="reviewer-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="如：英语组审核"
            maxLength={200}
            className="w-64"
            disabled={adding}
          />
        </div>
        <Button type="button" onClick={add} disabled={adding}>
          {adding ? <Loader2 className="animate-spin" /> : <Plus />}
          {adding ? "添加中…" : "加入审核名单"}
        </Button>
      </div>

      {reviewers.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="审核名单还是空的"
          description="把同学的广学账号用户名加进来，他们登录后就能在「管理 → 题库管理」里看题和改题。"
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {reviewers.map((reviewer) => (
            <li key={reviewer.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {reviewer.userName}
                  {reviewer.note ? <Badge variant="secondary">{reviewer.note}</Badge> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  加入时间 {new Date(reviewer.createdAt).toLocaleString("zh-CN")}
                  {reviewer.createdBy ? ` · 操作人 ${reviewer.createdBy}` : ""}
                </p>
              </div>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
