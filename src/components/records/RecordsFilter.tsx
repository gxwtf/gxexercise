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

export const SORT_OPTIONS = [
  { value: "time_desc", label: "时间：最新优先" },
  { value: "time_asc", label: "时间：最早优先" },
  { value: "score_desc", label: "得分：高→低" },
  { value: "score_asc", label: "得分：低→高" },
] as const

export type SortValue = (typeof SORT_OPTIONS)[number]["value"]

interface RecordsFilterProps {
  subject: string
  keyword: string
  sort: string
  pendingOnly: boolean
  subjects: string[]
}

/** 记录页筛选：学科（shadcn Select，只能手动选）+ 关键词 + 排序 + 只看未批改 */
export function RecordsFilter({ subject, keyword, sort, pendingOnly, subjects }: RecordsFilterProps) {
  const router = useRouter()
  const [sub, setSub] = React.useState(subject)
  const [kw, setKw] = React.useState(keyword)
  const [sortValue, setSortValue] = React.useState(sort)
  const [pending, setPending] = React.useState(pendingOnly)

  const push = (next: { subject?: string; keyword?: string; sort?: string; pending?: boolean }) => {
    const s = next.subject ?? sub
    const k = next.keyword ?? kw
    const so = next.sort ?? sortValue
    const pe = next.pending ?? pending
    const params = new URLSearchParams()
    if (s && s !== "all") params.set("subject", s)
    if (k.trim()) params.set("q", k.trim())
    if (so && so !== "time_desc") params.set("sort", so)
    if (pe) params.set("pending", "1")
    const qs = params.toString()
    router.push(qs ? `/records?${qs}` : "/records")
  }

  const hasFilter = sub !== "all" || kw.trim().length > 0 || sortValue !== "time_desc" || pending

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
          className="flex flex-1 flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            push({ keyword: kw })
          }}
        >
          <Input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索试卷 / 题组名称"
            className="h-9 w-full sm:w-60"
          />
          <Button type="submit" size="sm">
            查询
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Checkbox
            id="pending-only"
            checked={pending}
            onCheckedChange={(v) => {
              const next = Boolean(v)
              setPending(next)
              push({ pending: next })
            }}
          />
          <Label htmlFor="pending-only" className="cursor-pointer text-sm text-muted-foreground">
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
              setSortValue("time_desc")
              setPending(false)
              router.push("/records")
            }}
          >
            重置
          </Button>
        )}
      </div>
    </div>
  )
}
