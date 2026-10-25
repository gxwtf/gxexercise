import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { LeaderboardRow } from "@/lib/leaderboard"

export interface LeaderboardListProps {
  title: string
  subtitle: string
  rows: LeaderboardRow[]
  metric: "count" | "score"
  highlightUserId?: number | null
  /** 首页紧凑模式：不显示表头 */
  compact?: boolean
  href?: string
}

function initials(name: string) {
  const t = (name || "匿名").trim()
  return t.slice(0, 2).toUpperCase()
}

function rankTone(rank: number) {
  if (rank === 1) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
  if (rank === 2) return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
  if (rank === 3) return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
  return "bg-muted text-muted-foreground"
}

export function LeaderboardList({
  title,
  subtitle,
  rows,
  metric,
  highlightUserId,
  compact = false,
  href,
}: LeaderboardListProps) {
  const valueOf = (row: LeaderboardRow) => (metric === "count" ? row.questions : Math.round(row.score * 10) / 10)
  const max = rows.length ? Math.max(...rows.map((r) => Number(valueOf(r)))) : 0

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CardDescription className="text-xs">{subtitle}</CardDescription>
        </div>
        {href && (
          <Link href={href} className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand hover:underline">
            完整榜单
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </CardHeader>

      <CardContent className="px-0">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">本期暂无上榜记录</p>
        ) : (
          <Table>
            {!compact && (
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 pl-5">名次</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead className="w-24 text-right">题数</TableHead>
                  <TableHead className="w-24 text-right">得分</TableHead>
                  <TableHead className="w-40 pr-5">占比</TableHead>
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {rows.map((row, idx) => {
                const rank = idx + 1
                const value = valueOf(row)
                const pct = max > 0 ? (Number(value) / max) * 100 : 0
                const mine = highlightUserId != null && row.userId === highlightUserId
                return (
                  <TableRow key={row.userId} className={cn(mine && "bg-brand/5")}>
                    <TableCell className="pl-5">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                          rankTone(rank)
                        )}
                      >
                        {rank}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className={rank <= 3 ? "bg-brand/10 text-brand" : undefined}>
                            {initials(row.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-sm font-medium text-foreground">
                          {row.name}
                          {mine && <span className="ml-1 text-xs text-brand">（我）</span>}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {row.questions}
                      <span className="ml-0.5 text-xs">题</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium text-foreground">
                      {Math.round(row.score * 10) / 10}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">分</span>
                    </TableCell>
                    <TableCell className="pr-5">
                      <Progress value={pct} className="h-1.5" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        {compact && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-2.5">
            <Badge variant="outline" className="text-[11px] font-normal">
              周期内同题只计一次
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
