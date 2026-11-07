"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface QuestionBankFilterProps {
  subject: string
  category: string
  keyword: string
  subjects: string[]
  /** 学科 → 类别，类别下拉跟随学科；传纯对象是因为要跨 server/client 边界序列化 */
  categoriesBySubject: Record<string, string[]>
}

/** 题组列表筛选：学科 + 类别（跟随学科）+ 标题关键词 */
export function QuestionBankFilter({
  subject,
  category,
  keyword,
  subjects,
  categoriesBySubject,
}: QuestionBankFilterProps) {
  const router = useRouter()
  const [sub, setSub] = React.useState(subject)
  const [cat, setCat] = React.useState(category)
  const [kw, setKw] = React.useState(keyword)

  const push = (next: { subject?: string; category?: string; keyword?: string }) => {
    const s = next.subject ?? sub
    const c = next.category ?? cat
    const k = next.keyword ?? kw
    const params = new URLSearchParams()
    if (s && s !== "all") params.set("subject", s)
    if (c && c !== "all") params.set("category", c)
    if (k.trim()) params.set("q", k.trim())
    const qs = params.toString()
    router.push(qs ? `/admin/questions?${qs}` : "/admin/questions")
  }

  // 类别是学科的下级维度：没选学科时全部类别混在一起没意义，故禁用
  const categoryOptions = sub !== "all" ? (categoriesBySubject[sub] ?? []) : []
  const hasFilter = sub !== "all" || cat !== "all" || kw.trim().length > 0

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={sub}
          onValueChange={(value) => {
            setSub(value)
            // 换学科后旧类别不再属于该学科，一并清掉
            setCat("all")
            push({ subject: value, category: "all" })
          }}
        >
          <SelectTrigger size="sm" className="w-[124px]" aria-label="选择学科">
            {/* 直接给出文案：Radix 的 SelectValue 在选项没展开过时取不到 item 文本，会显示空白 */}
            <SelectValue placeholder="全部学科">
              <span className={sub === "all" ? "text-muted-foreground" : undefined}>
                {sub === "all" ? "全部学科" : sub}
              </span>
            </SelectValue>
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
          value={cat}
          onValueChange={(value) => {
            setCat(value)
            push({ category: value })
          }}
          disabled={sub === "all"}
        >
          <SelectTrigger size="sm" className="w-[150px]" aria-label="选择题组类别">
            <SelectValue placeholder="全部类别">
              <span className={cat === "all" ? "text-muted-foreground" : undefined}>
                {sub === "all" ? "选择学科后可选" : cat === "all" ? "全部类别" : cat}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类别</SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <form
          className="flex basis-full flex-wrap items-center gap-2 sm:flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            push({ keyword: kw })
          }}
        >
          <Input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索标题 / 标签 / 试卷来源 / 正文"
            className="h-9 w-full sm:w-64"
            aria-label="搜索标题 / 标签 / 试卷来源 / 正文"
          />
          <Button type="submit" size="sm">
            查询
          </Button>
        </form>

        {hasFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSub("all")
              setCat("all")
              setKw("")
              router.push("/admin/questions")
            }}
          >
            清除筛选
          </Button>
        )}
      </div>
    </div>
  )
}
