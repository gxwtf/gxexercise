import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { getLeaderboard, getLeaderboardSubjects, periodRange, type LeaderboardPeriod } from "@/lib/leaderboard"
import { LeaderboardList } from "@/components/leaderboard/LeaderboardList"

export const dynamic = "force-dynamic"

const SUBJECT_TABS = ["全部"]

interface PageProps {
  searchParams: Promise<{ period?: string; subject?: string }>
}

function fmt(d: Date) {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "/")
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const period: LeaderboardPeriod = sp.period === "month" ? "month" : "week"
  const subjects = await getLeaderboardSubjects()
  const subjectOptions = [...SUBJECT_TABS, ...subjects.filter((s) => !SUBJECT_TABS.includes(s))]
  const subject = sp.subject && subjectOptions.includes(sp.subject) ? sp.subject : "全部"

  const [{ rows: studyRows, start, end }, { rows: scoreRows }] = await Promise.all([
    getLeaderboard({ period, metric: "count", subject, limit: 50 }),
    getLeaderboard({ period, metric: "score", subject, limit: 50 }),
  ])

  const periodLabel = period === "week" ? "本周榜" : "本月榜"

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" />
            返回首页
          </Link>
          <h1 className="text-2xl font-bold text-foreground">广学榜</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {periodLabel} · {fmt(start)} ~ {fmt(new Date(end.getTime() - 86400000))} · {subject === "全部" ? "全部学科" : subject}
        </p>
      </div>

      {/* 周期切换 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["week", "month"] as LeaderboardPeriod[]).map((p) => (
          <Link
            key={p}
            href={`/leaderboard?period=${p}${subject !== "全部" ? `&subject=${encodeURIComponent(subject)}` : ""}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              period === p
                ? "border-brand bg-brand text-primary-foreground dark:bg-brand"
                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {p === "week" ? "周榜" : "月榜"}
          </Link>
        ))}
      </div>

      {/* 学科筛选 */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">学科：</span>
        {subjectOptions.map((s) => (
          <Link
            key={s}
            href={`/leaderboard?period=${period}${s !== "全部" ? `&subject=${encodeURIComponent(s)}` : ""}`}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              subject === s
                ? "border-brand/60 bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LeaderboardList
          title="勤学榜"
          subtitle="按做题数量"
          rows={studyRows}
          metric="count"
        />
        <LeaderboardList
          title="卓越榜"
          subtitle="按得分合计"
          rows={scoreRows}
          metric="score"
        />
      </div>

      {/* 统计规则 */}
      <section className="mt-8 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <h2 className="mb-2 text-sm font-semibold text-foreground">统计规则</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>周期：周榜为<b>本周一 00:00 至周日 24:00</b>；月榜为<b>本月 1 日 00:00 至月末</b>（北京时间）。</li>
          <li><b>勤学榜</b>按「做题数量」排序：周期内作答过的<b>题目数</b>（同一道题多次作答只计 1 道）。</li>
          <li><b>卓越榜</b>按「做题总分」排序：周期内每道题<b>只取最高一次得分</b>累加（未判分的题目不计分）。</li>
          <li>同一题多次提交不重复计数；分数相同则按另一项指标、再按用户 ID 排序。</li>
          <li>可按学科单独统计；「全部」为所有学科合计。</li>
          <li>数据实时更新，刷新页面即可看到最新排名。</li>
        </ul>
      </section>
    </div>
  )
}
