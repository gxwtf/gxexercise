"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SORT_OPTIONS } from "@/components/records/RecordsFilter"

interface AdminSubmissionsFilterProps {
  subject: string
  keyword: string
  user: string
  sort: string
  pendingOnly: boolean
  subjects: string[]
}

/** 管理员提交记录筛选：学科 + 关键词 + 用户 + 排序 + 只看未批改 */
export function AdminSubmissionsFilter({
  subject,
  keyword,
  user,
  sort,
  pendingOnly,
  subjects,
}: AdminSubmissionsFilterProps) {
  const router = useRouter()
  const [sub, setSub] = React.useState(subject)
  const [kw, setKw] = React.useState(keyword)
  const [userQuery, setUserQuery] = React.useState(user)
  const [sortValue, setSortValue] = React.useState(sort)
  const [pending, setPending] = React.useState(pendingOnly)

  const push = (next: { subject?: string; keyword?: string; user?: string; sort?: string; pending?: boolean }) => {
    const s = next.subject ?? sub
    const k = next.keyword ?? kw
    const u = next.user ?? userQuery
    const so = next.sort ?? sortValue
    const pe = next.pending ?? pending
    const params = new URLSearchParams()
    if (s && s !== "all") params.set("subject", s)
    if (k.trim()) params.set("q", k.trim())
    if (u.trim()) params.set("user", u.trim())
    if (so && so !== "time_desc") params.set("sort", so)
    if (pe) params.set("pending", "1")
    const qs = params.toString()
    router.push(qs ? `/admin/submissions?${qs}` : "/admin/submissions")
  }

  const hasFilter =
    sub !== "all" || kw.trim().length > 0 || userQuery.trim().length > 0 || sortValue !== "time_desc" || pending

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={sub}
          onValueChange={(value) => {
            setSub(value)
            push({ subject: value })
          }}
        >
          <SelectTrigger size="sm" className="w-[124px]" aria-label="选择学科">
            <SelectValue placeholder="全部学科" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部学科</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortValue}
          onValueChange={(value) => {
            setSortValue(value)
            push({ sort: value })
          }}
        >
          <SelectTrigger size="sm" className="w-[160px]" aria-label="排序方式">
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <form
          className="flex basis-full flex-wrap items-center gap-2 sm:flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            push({ keyword: kw, user: userQuery })
          }}
        >
          <Input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索试卷 / 题组名称"
            className="h-9 w-full sm:w-56"
            aria-label="搜索试卷或题组名称"
          />
          <Input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="用户名或用户 ID"
            className="h-9 w-full sm:w-40"
            aria-label="按用户名或用户 ID 筛选"
          />
          <Button type="submit" size="sm">
            查询
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Checkbox
            id="admin-pending-only"
            checked={pending}
            onCheckedChange={(v) => {
              const next = Boolean(v)
              setPending(next)
              push({ pending: next })
            }}
          />
          <Label htmlFor="admin-pending-only" className="cursor-pointer text-sm text-muted-foreground">
            只看未批改
          </Label>
        </div>

        {hasFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSub("all")
              setKw("")
              setUserQuery("")
              setSortValue("time_desc")
              setPending(false)
              router.push("/admin/submissions")
            }}
          >
            重置
          </Button>
        )}
      </div>
    </div>
  )
}
