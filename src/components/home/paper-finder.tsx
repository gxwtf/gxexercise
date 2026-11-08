"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { subjects, subjectToRoute, categoriesBySubject, categoryToRoute } from "@/constants/subjects"
import { Button } from "@/components/ui/button"
import { DISTRICT_OPTIONS } from "@/constants/districts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/**
 * 首页「按考试找卷」：学科 × 类型 × 年份 → 对应学科的套卷列表。
 * 链接在前端拼（相对路径 push），这样本地 1230 与 cpolar 公网域名都能正确跳转。
 */
const PAPER_TYPES = [
  { label: "全部", cat: "all" },
  { label: "北京高考真题", cat: "高考真题" },
  { label: "各区一模", cat: "各区一模" },
  { label: "各区二模", cat: "各区二模" },
  { label: "期中", cat: "各区期中" },
  { label: "各区上期末", cat: "各区期末" },
]

const YEARS = ["all", "2026", "2025", "2024", "2023", "2022", "2021"] as const

export default function PaperFinder({ defaultSubject = "历史" }: { defaultSubject?: string }) {
  const router = useRouter()
  const [subject, setSubject] = useState(defaultSubject)
  const [cat, setCat] = useState(PAPER_TYPES[1].cat)
  const [year, setYear] = useState<string>("2026")
  const [district, setDistrict] = useState<string>("all")

  const go = () => {
    const subjectRoute = subjectToRoute[subject]
    const categoryName = (categoriesBySubject[subject] || []).includes("套卷") ? "套卷" : "选择"
    const categoryRoute = categoryToRoute[subject]?.[categoryName]
    if (!subjectRoute || !categoryRoute) {
      router.push("/questions")
      return
    }
    const params = new URLSearchParams()
    if (cat !== "all") params.set("cat", cat)
    if (year !== "all") params.set("year", year)
    if (district !== "all") params.set("district", district)
    router.push(`/questions/${subjectRoute}/${categoryRoute}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">学科</span>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-28" aria-label="选择学科">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">类型</span>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-36" aria-label="选择类型">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAPER_TYPES.map((t) => (
              <SelectItem key={t.cat} value={t.cat}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">年份</span>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-24" aria-label="选择年份">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y}>
                {y === "all" ? "全部" : y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">考区</span>
        <Select value={district} onValueChange={setDistrict}>
          <SelectTrigger className="w-28" aria-label="选择考区">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISTRICT_OPTIONS.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={go}>查看套卷</Button>
    </div>
  )
}
