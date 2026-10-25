import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { getLeaderboard, getLeaderboardSubjects, getMyRank } from "@/lib/leaderboard"
import { subjectLabel, type LeaderboardPeriod } from "@/lib/leaderboard-shared"
import { LeaderboardList } from "@/components/leaderboard/LeaderboardList"
import { LeaderboardControls } from "@/components/leaderboard/LeaderboardControls"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ period?: string; subject?: string }>
}

function fmt(d: Date) {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, ".")
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const period: LeaderboardPeriod = sp.period === "month" ? "month" : "week"
  const subjects = await getLeaderboardSubjects()
  const options = ["全部", ...subjects.filter((s) => s !== "全部")]
  const subject = sp.subject && options.includes(sp.subject) ? sp.subject : "全部"

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  const userId = session.userid || 0

  const [{ rows: studyRows, start, end }, { rows: scoreRows }, myRank] = await Promise.all([
    getLeaderboard({ period, metric: "count", subject, limit: 50 }),
    getLeaderboard({ period, metric: "score", subject, limit: 50 }),
    getMyRank({ period, subject, userId }),
  ])

  const periodLabel = period === "week" ? "周榜" : "月榜"

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-8 lg:px-12">
      {/* 头部 */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            首页
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">广学榜</h1>
          <Badge variant="secondary" className="font-normal">
            {periodLabel}
          </Badge>
          <Badge variant="outline" className="font-normal">
            {subjectLabel(subject)}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {fmt(start)} ~ {fmt(new Date(end.getTime() - 86400000))}
          </span>
        </div>

        <LeaderboardControls period={period} subject={subject} subjects={options} />
      </div>

      {/* 两个榜单 */}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <LeaderboardList
          title="勤学榜"
          subtitle="按周期内做题数量排名"
          rows={studyRows}
          metric="count"
          myRank={myRank?.rankCount ?? null}
          myTotalUsers={myRank?.totalUsers ?? null}
          myName={myRank?.name ?? null}
          myQuestions={myRank?.questions ?? null}
          myScore={myRank?.score ?? null}
        />
        <LeaderboardList
          title="卓越榜"
          subtitle="按周期内做题得分排名（同题取最高分）"
          rows={scoreRows}
          metric="score"
          myRank={myRank?.rankScore ?? null}
          myTotalUsers={myRank?.totalUsers ?? null}
          myName={myRank?.name ?? null}
          myQuestions={myRank?.questions ?? null}
          myScore={myRank?.score ?? null}
        />
      </div>

      {/* 统计规则 */}
      <Card className="mt-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">统计规则</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">周期：</span>
            周榜为本周一 00:00 至周日 24:00；月榜为本月 1 日 00:00 至月末（北京时间）。
          </p>
          <p>
            <span className="font-medium text-foreground">勤学榜：</span>
            按周期内作答过的题目数排名，同一道题无论作答多少次只计 1 道。
          </p>
          <p>
            <span className="font-medium text-foreground">卓越榜：</span>
            按周期内每道题的最高得分累加排名；未判分（评阅中）的题目暂不计分。
          </p>
          <p>
            <span className="font-medium text-foreground">排序：</span>
            主指标相同的情况下，依次比较另一项指标、用户 ID。支持按学科单独统计，
            「总榜」为所有学科合计。
          </p>
          <p>榜单实时计算，刷新页面即为最新结果。</p>
        </CardContent>
      </Card>
    </div>
  )
}
