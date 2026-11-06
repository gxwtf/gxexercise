"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  subjects,
  subjectToRoute,
  categoriesBySubject,
  categoryToRoute,
} from "@/constants/subjects"

/**
 * 首页「按考试找卷」。
 *
 * 为什么在前端拼链接、而不是提交表单让服务端 302：
 * 站点会同时被直连（localhost:1230）和 cpolar 公网域名访问，服务端 `new URL(..., request.origin)`
 * 很容易拼出 `http://localhost:1230/...` 这种只在本机可用的绝对地址；纯前端用相对路径 push
 * 就不会有这个问题（在哪打开就跳到哪）。
 */

const PAPER_TYPES = [
  { label: "北京高考真题", cat: "高考真题" },
  { label: "各区一模", cat: "各区一模" },
  { label: "各区二模", cat: "各区二模" },
  { label: "各区上期末", cat: "各区期末" },
]

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021]

export default function PaperFinder({ defaultSubject = "历史" }: { defaultSubject?: string }) {
  const router = useRouter()
  const [subject, setSubject] = useState(defaultSubject)
  const [cat, setCat] = useState(PAPER_TYPES[1].cat)
  const [year, setYear] = useState<number | "all">(2026)

  const href = useMemo(() => {
    const subjectRoute = subjectToRoute[subject]
    const categoryName = (categoriesBySubject[subject] || []).includes("套卷") ? "套卷" : "选择"
    const categoryRoute = categoryToRoute[subject]?.[categoryName]
    if (!subjectRoute || !categoryRoute) return "/questions"
    const params = new URLSearchParams({ cat })
    if (year !== "all") params.set("year", String(year))
    return `/questions/${subjectRoute}/${categoryRoute}?${params.toString()}`
  }, [subject, cat, year])

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        router.push(href)
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">学科</span>
        <select
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-foreground"
        >
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">类型</span>
        <select
          name="cat"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-foreground"
        >
          {PAPER_TYPES.map((t) => (
            <option key={t.cat} value={t.cat}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">年份</span>
        <select
          name="year"
          value={String(year)}
          onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="rounded-lg border border-input bg-background px-3 py-2 text-foreground"
        >
          <option value="all">全部</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        查看套卷
      </button>
      <a href={href} className="text-sm font-medium text-brand hover:underline">
        直接打开
      </a>
      <p className="basis-full text-xs text-muted-foreground">
        也可以进列表后再用搜索框筛关键词（如「海淀」「西城一模」）。
      </p>
    </form>
  )
}
