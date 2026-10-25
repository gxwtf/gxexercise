"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface LeaderboardControlsProps {
  period: "week" | "month"
  subject: string
  subjects: string[]
}

/** 学科展示名：全部 → 总榜，数学 → 数学榜 */
export function subjectLabel(s: string) {
  return s === "全部" ? "总榜" : `${s}榜`
}

/** 周榜/月榜切换 + 学科筛选（shadcn Tabs / Select） */
export function LeaderboardControls({ period, subject, subjects }: LeaderboardControlsProps) {
  const router = useRouter()
  const hrefFor = (p: string, s: string) =>
    `/leaderboard?period=${p}${s && s !== "全部" ? `&subject=${encodeURIComponent(s)}` : ""}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs value={period}>
        <TabsList>
          {(["week", "month"] as const).map((p) => (
            <TabsTrigger key={p} value={p} asChild>
              <Link href={hrefFor(p, subject)}>{p === "week" ? "周榜" : "月榜"}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">学科</span>
        <Select
          value={subject}
          onValueChange={(v) => router.push(hrefFor(period, v))}
        >
          <SelectTrigger className="h-8 w-32 text-sm">
            <SelectValue placeholder="总榜" />
          </SelectTrigger>
          <SelectContent align="end">
            {subjects.map((s) => (
              <SelectItem key={s} value={s}>
                {subjectLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
