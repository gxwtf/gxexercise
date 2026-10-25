import Link from "next/link"
import { ChevronLeft, Crown, Medal, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LeaderboardRow } from "@/lib/leaderboard"

/** 由用户名生成稳定的头像底色 */
function avatarColors(name: string) {
  const palettes = [
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 9973
  return palettes[h % palettes.length]
}

function initials(name: string) {
  const trimmed = (name || "匿名").trim()
  return trimmed.slice(0, 1).toUpperCase()
}

function rankStyle(rank: number) {
  if (rank === 1) return "border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/40"
  if (rank === 2) return "border-slate-300 bg-slate-50 dark:border-slate-500 dark:bg-slate-900/40"
  if (rank === 3) return "border-orange-300 bg-orange-50 dark:border-orange-600 dark:bg-orange-950/40"
  return "border-border bg-card"
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="size-4 text-amber-500" />
  if (rank === 2) return <Medal className="size-4 text-slate-400 dark:text-slate-300" />
  if (rank === 3) return <Medal className="size-4 text-orange-500" />
  return <span className="text-xs tabular-nums text-muted-foreground">{rank}</span>
}

export interface LeaderboardListProps {
  title: string
  subtitle: string
  rows: LeaderboardRow[]
  metric: "count" | "score"
  highlightUserId?: number | null
}

/** 单个榜单（勤学榜 / 卓越榜） */
export function LeaderboardList({ title, subtitle, rows, metric, highlightUserId }: LeaderboardListProps) {
  const max = rows[0]?.[metric === "count" ? "questions" : "score"] ?? 0
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold text-foreground">
          <Trophy className="size-4 text-brand" />
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </header>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">本期还没有人上榜，快来抢榜！</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, idx) => {
            const value = metric === "count" ? row.questions : Math.round(row.score * 10) / 10
            const pct = max > 0 ? Math.round((Number(value) / max) * 100) : 0
            const mine = highlightUserId != null && row.userId === highlightUserId
            return (
              <li
                key={row.userId}
                className={cn("relative overflow-hidden rounded-lg border px-3 py-2", rankStyle(idx + 1), mine && "ring-2 ring-brand/60")}
              >
                <div className="relative flex items-center gap-3">
                  <span className="flex w-5 shrink-0 items-center justify-center">
                    <RankBadge rank={idx + 1} />
                  </span>
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      avatarColors(row.name || String(row.userId))
                    )}
                    aria-hidden
                  >
                    {initials(row.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {row.name}
                      {mine && <span className="ml-1 text-xs text-brand">（我）</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metric === "count" ? `${row.questions} 道题` : `${Math.round(row.score * 10) / 10} 分`}
                      {metric === "count" && row.score > 0 ? ` · ${Math.round(row.score * 10) / 10} 分` : ""}
                      {metric === "score" ? ` · ${row.questions} 道题` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{value}</span>
                </div>
                <span
                  className="absolute inset-y-0 left-0 -z-0 bg-brand/5"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                  aria-hidden
                />
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
