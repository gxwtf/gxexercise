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

interface RecordsFilterProps {
  subject: string
  keyword: string
  subjects: string[]
}

/** 记录页筛选：学科用 shadcn Select（只能手动选），关键词可输入 */
export function RecordsFilter({ subject, keyword, subjects }: RecordsFilterProps) {
  const router = useRouter()
  const [sub, setSub] = React.useState(subject)
  const [kw, setKw] = React.useState(keyword)

  const apply = (nextSubject: string, nextKeyword: string) => {
    const params = new URLSearchParams()
    if (nextSubject && nextSubject !== "all") params.set("subject", nextSubject)
    if (nextKeyword.trim()) params.set("q", nextKeyword.trim())
    const qs = params.toString()
    router.push(qs ? `/records?${qs}` : "/records")
  }

  const hasFilter = sub !== "all" || kw.trim().length > 0

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <Select
        value={sub}
        onValueChange={(value) => {
          setSub(value)
          apply(value, kw)
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

      <form
        className="flex flex-1 flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          apply(sub, kw)
        }}
      >
        <Input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="搜索试卷 / 题组名称"
          className="h-9 w-full sm:w-64"
        />
        <Button type="submit" size="sm">
          查询
        </Button>
        {hasFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSub("all")
              setKw("")
              router.push("/records")
            }}
          >
            重置
          </Button>
        )}
      </form>
    </div>
  )
}
