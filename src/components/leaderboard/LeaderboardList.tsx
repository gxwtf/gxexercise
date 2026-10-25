import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  // 前三名：浅色用浅底深字，深色用「半透明亮色底 + 亮字 + 描边」，避免深底发闷、彼此难区分
  if (rank === 1)
    return "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300 dark:bg-amber-400/20 dark:text-amber-200 dark:ring-amber-400/45"
  if (rank === 2)
    return "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-300 dark:bg-slate-300/20 dark:text-slate-100 dark:ring-slate-300/45"
  if (rank === 3)
    return "bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-300 dark:bg-orange-400/20 dark:text-orange-100 dark:ring-orange-400/45"
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
                  <TableHead className="w-28 pr-5 text-right">得分</TableHead>
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {rows.map((row, idx) => {
                const rank = idx + 1
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
                    <TableCell className="pr-5 text-right tabular-nums text-sm font-medium text-foreground">
                      {Math.round(row.score * 10) / 10}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">分</span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
