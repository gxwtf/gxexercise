import Link from "next/link"
import pkg from "../../../package.json"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { ArrowUpRight, BookOpenCheck, CheckCircle2, Clock, FileText, Trophy } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { subjects, subjectToRoute, categoriesBySubject, categoryToRoute } from "@/constants/subjects"
import { getLeaderboard, getMyRank } from "@/lib/leaderboard"
import { LeaderboardList } from "@/components/leaderboard/LeaderboardList"
import SampleQuestion from "@/components/home/sample-question"
import PaperFinder from "@/components/home/paper-finder"
import ActivityTicker from "@/components/home/activity-ticker"
import { getRecentActivity, relativeTimeLabel } from "@/lib/activity"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const dynamic = "force-dynamic"

/** 整卷链路（选择题 + 非选择题大题）的六科 */
const FULL_SUBJECTS = ["语文", "英语", "生物", "历史", "地理", "政治"]
const PARTIAL_SUBJECTS: Record<string, string> = {
  数学: "选择 / 填空",
  物理: "选择",
  化学: "图片版选择",
}

const PAPER_TYPES = [
  { label: "北京高考真题", cat: "高考真题" },
  { label: "各区一模", cat: "各区一模" },
  { label: "各区二模", cat: "各区二模" },
  { label: "各区上期末", cat: "各区期末" },
]

const dayFmt = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" })

export default async function RootPage() {
  const version = pkg.version
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  const userId = session.isLoggedIn && session.userid ? session.userid : 0

  const [
    paperTotal,
    questionTotal,
    paperBySubject,
    groupBySubject,
    { rows: studyTop },
    { rows: scoreTop },
  ] = await Promise.all([
    prisma.testPaper.count(),
    prisma.question.count(),
    prisma.testPaper.groupBy({ by: ["subject"], _count: { id: true } }),
    prisma.questionGroup.groupBy({ by: ["subject"], _count: { id: true } }),
    getLeaderboard({ period: "week", metric: "count", limit: 5 }),
    getLeaderboard({ period: "week", metric: "score", limit: 5 }),
  ])

  // 最近谁练了什么（类似「谁又下了一单」）：已交卷/已交题组，同一用户只留最近一条
  const activity = await getRecentActivity({ limit: 6, excludeUserId: userId })
  const activityView = activity.map((a) => ({
    id: a.id,
    userName: a.userName,
    title: a.title,
    href: a.href,
    score: a.score,
    max: a.max,
    atLabel: relativeTimeLabel(a.at),
    kindLabel: a.kind === "paper" ? "整卷" : "题组",
  }))

  const paperCountMap = new Map(paperBySubject.map((r) => [r.subject, r._count.id]))
  const groupCountMap = new Map(groupBySubject.map((r) => [r.subject, r._count.id]))
  const totalGroups = Array.from(groupCountMap.values()).reduce((a, b) => a + b, 0)

  // 每科最新一卷（只对六科主干各查一次）
  const latestBySubject = new Map<string, { id: string; title: string }>()
  const latestRows = await Promise.all(
    FULL_SUBJECTS.map((subject) =>
      prisma.testPaper.findFirst({
        where: { subject },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, subject: true, createdAt: true },
      }),
    ),
  )
  for (const row of latestRows) {
    if (row) latestBySubject.set(row.subject, { id: row.id, title: row.title })
  }
  // 最近入库：每个学科各取最新一卷，再按入库时间取前 3（避免同一批导入垄断整块）
  const recentPapers = latestRows
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3)

  // 已登录：我的待批改 / 最近练习（题组优卷优先） / 本周名次
  let pendingCount = 0
  let recentSubs: { id: string; title: string; href: string; score: number | null; max: number | null }[] = []
  let myRank: Awaited<ReturnType<typeof getMyRank>> = null
  if (userId) {
    const [pending, groupSubs, paperSubs, rank] = await Promise.all([
      prisma.questionSubmission.count({ where: { userId, gradingStatus: "pending" } }),
      prisma.questionGroupSubmission.findMany({
        where: { userId, testSubmissionId: null },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          score: true,
          createdAt: true,
          questionGroup: { select: { id: true, title: true, score: true } },
        },
      }),
      prisma.testPaperSubmission.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          score: true,
          createdAt: true,
          testPaper: { select: { id: true, title: true, totalScore: true } },
        },
      }),
      getMyRank({ period: "week", userId }),
    ])

    pendingCount = pending

    const merged = [
      ...groupSubs.map((g) => ({
        id: g.id,
        at: g.createdAt,
        title: g.questionGroup.title,
        href: `/question/${g.questionGroup.id}/review/1`,
        score: g.score,
        max: g.questionGroup.score ?? null,
      })),
      ...paperSubs.map((t) => ({
        id: t.id,
        at: t.createdAt,
        title: t.testPaper.title,
        href: `/test-paper/${t.testPaper.id}/result/${t.id}`,
        score: t.score,
        max: t.testPaper.totalScore ?? null,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 3)

    if (merged.length) {
      recentSubs = merged.map(({ at: _at, ...rest }) => rest)
    } else {
      const single = await prisma.questionSubmission.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, score: true, question: { select: { subject: true, source: true, score: true } } },
      })
      recentSubs = single.map((q) => ({
        id: q.id,
        title: `${q.question?.source || q.question?.subject || "练习"}（单题）`,
        href: "/records",
        score: q.score,
        max: q.question?.score ?? null,
      }))
    }
    myRank = rank
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      {/* 首屏：定位 + 数据 + 主入口 */}
      <section className="space-y-4">
        <Badge variant="outline" className="gap-1">
          <BookOpenCheck aria-hidden="true" />
          广学题库 · 公测期 · v{version}
        </Badge>
        <h1 className="text-2xl font-bold leading-snug text-foreground sm:text-4xl">
          北京高中真题与各区模拟，<span className="text-brand">九科齐全</span>
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          教师版带答案与解析。单题、题组、整卷三种练法；客观题提交即判，主观题按采分点 AI 批改，可导出纸质作答卷与回顾 PDF。
        </p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span className="text-foreground">{paperTotal} 套卷</span>
          <span className="text-foreground">{questionTotal.toLocaleString("zh-CN")} 道题</span>
          <span className="text-foreground">{totalGroups} 个题组</span>
          <span>2011–2026 北京真题 · 2021–2026 各区一模 / 二模 / 上期末</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href={userId ? (recentSubs[0]?.href ?? "#subjects") : "#sample"}>
              {userId ? (recentSubs[0] ? "继续上次练习" : "挑一套开始") : "不登录，先做一道"}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="#subjects">按学科开始</Link>
          </Button>
          <Button variant="link" asChild>
            <Link href="#by-exam">
              按考试找卷
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {activityView.length > 0 ? (
          <ActivityTicker items={activityView} />
        ) : (
          <p className="text-xs text-muted-foreground">最近还没有人交卷，你可以开个头。</p>
        )}

        {recentPapers.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>最近入库</span>
            {recentPapers.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1">
                <Link href={`/test-paper/${p.id}`} className="text-foreground hover:underline">
                  {p.title}
                </Link>
                <span>{dayFmt.format(p.createdAt)}</span>
              </span>
            ))}
          </p>
        )}
      </section>

      {/* 免登录体验（只给未登录访客） */}
      {userId ? null : (
        <section id="sample" className="scroll-mt-20">
          <SampleQuestion />
        </section>
      )}

      {/* 我的学习（登录后） */}
      {userId ? (
        <section id="me" className="scroll-mt-20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">我的学习</h2>
            <div className="flex gap-2">
              <Button variant="link" size="sm" asChild>
                <Link href="/records">
                  作答记录
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
              <Button variant="link" size="sm" asChild>
                <Link href="/leaderboard">
                  完整榜单
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card size="sm">
              <CardContent className="flex items-start justify-between">
                <div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock aria-hidden="true" />
                    待 AI 批改
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{pendingCount}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {pendingCount > 0 ? "十几秒内出结果" : "没有排队"}
                </span>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Trophy aria-hidden="true" />
                  本周名次
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {myRank ? `第 ${myRank.rankCount}` : "—"}
                  {myRank && <span className="ml-1 text-xs font-normal text-muted-foreground">/ {myRank.totalUsers} 人</span>}
                </p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent>
                <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText aria-hidden="true" />
                  最近练习
                </p>
                {recentSubs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">还没有记录</p>
                ) : (
                  <ul className="space-y-0.5 text-xs">
                    {recentSubs.map((s) => (
                      <li key={s.id} className="flex items-baseline justify-between gap-2">
                        <Link href={s.href} className="min-w-0 truncate text-foreground hover:underline">
                          {s.title}
                        </Link>
                        <span className="shrink-0 text-muted-foreground">
                          {s.score != null ? `${Math.round(s.score * 10) / 10}${s.max != null ? `/${s.max}` : ""}` : "待批改"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {/* 按考试找卷 */}
      <section id="by-exam" className="scroll-mt-20 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">按考试找卷</h2>
          <p className="text-sm text-muted-foreground">选学科、类型与年份，直接进该科套卷列表。</p>
        </div>
        <Card size="sm">
          <CardContent>
            <PaperFinder />
            <p className="mt-2 text-xs text-muted-foreground">也可以在列表页搜索框里筛关键词（如「海淀」）。</p>
          </CardContent>
        </Card>
      </section>

      {/* 按学科刷题 */}
      <section id="subjects" className="scroll-mt-20 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">按学科刷题</h2>
          <p className="text-sm text-muted-foreground">六科是完整整卷；数学 / 物理 / 化学目前只收部分题型。</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FULL_SUBJECTS.map((subject) => {
            const route = subjectToRoute[subject]
            const latest = latestBySubject.get(subject)
            const cats = (categoriesBySubject[subject] || []).filter((c) => c !== "套卷").slice(0, 3)
            return (
              <Card key={subject} size="sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>
                      <Link href={`/questions/${route}`} className="hover:underline">
                        {subject}
                      </Link>
                    </CardTitle>
                    <Badge variant="secondary">选择 + 大题</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {paperCountMap.get(subject) ?? 0} 套卷 · {groupCountMap.get(subject) ?? 0} 题组
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {latest && (
                    <Link href={`/test-paper/${latest.id}`} className="block truncate text-xs text-brand hover:underline">
                      {latest.title}
                    </Link>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {cats.map((c) => (
                      <Button key={c} variant="outline" size="xs" asChild>
                        <Link href={`/questions/${route}/${categoryToRoute[subject]?.[c]}`}>{c}</Link>
                      </Button>
                    ))}
                    <Button variant="secondary" size="xs" asChild>
                      <Link href={`/questions/${route}/${categoryToRoute[subject]?.["套卷"]}`}>整卷</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Alert>
          <BookOpenCheck aria-hidden="true" />
          <AlertTitle>部分题型（整卷还在补）</AlertTitle>
          <AlertDescription>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(PARTIAL_SUBJECTS).map(([subject, note]) => (
                <span key={subject}>
                  <Link href={`/questions/${subjectToRoute[subject]}`} className="font-medium text-foreground hover:underline">
                    {subject}
                  </Link>
                  <span className="ml-1">
                    {paperCountMap.get(subject) ?? 0} 套 · {note}
                  </span>
                </span>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      </section>

      {/* 判分与导出 */}
      <section id="how" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">写完之后，怎么判</h2>
        <Card size="sm">
          <CardContent className="space-y-3">
            <div className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-700 dark:text-green-400" aria-hidden="true" />
              <p className="text-sm text-foreground">
                <span className="font-medium">客观题即时判分</span>
                <span className="ml-1 text-muted-foreground">选择题、填空题提交即出对错；同题按最高分计入榜单。</span>
              </p>
            </div>
            <Separator />
            <div className="flex gap-2.5">
              <BookOpenCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
              <p className="text-sm text-foreground">
                <span className="font-medium">主观题按采分点</span>
                <span className="ml-1 text-muted-foreground">
                  作文与阅读表达按维度；语文阅读、历史 / 地理 / 政治按采分点或等级表；生物大题按每个空判。
                </span>
              </p>
            </div>
            <Separator />
            <div className="flex gap-2.5">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-foreground">
                <span className="font-medium">纸质作答卷可导出</span>
                <span className="ml-1 text-muted-foreground">题组与整卷支持导出无答案的空白卷 PDF，回顾页可导出带解析的 PDF。</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 广学榜 */}
      <section id="leaderboard" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">广学榜</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <LeaderboardList title="勤学榜" subtitle="本周做题数量 Top 5" rows={studyTop} metric="count" compact href="/leaderboard?period=week" />
          <LeaderboardList title="卓越榜" subtitle="本周得分合计 Top 5" rows={scoreTop} metric="score" compact href="/leaderboard?period=week" />
        </div>
        <p className="text-xs text-muted-foreground">
          周期内同一题只算一次（多次作答取最高分）；周榜为本周一至周日，月榜为本月 1 日至月末（北京时间）。
        </p>
      </section>

      {/* 页脚 */}
      <footer className="space-y-4 pt-2">
        <Separator />
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant="outline">v{version}</Badge>
            <span>九科集齐</span>
            <span>·</span>
            <span>{paperTotal} 套卷</span>
            <span>·</span>
            <span>{questionTotal.toLocaleString("zh-CN")} 道题</span>
          </p>
          <p>题目与答案来自菁师帮教师版试卷，图片与表格以原卷为准；AI 批改是参考意见，与教师评分可能存在差异。</p>
        </div>

        <div className="grid gap-3 text-xs sm:grid-cols-3">
          <div>
            <p className="mb-1 font-medium text-foreground">按学科</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
              {subjects.map((s) => (
                <Link key={s} href={`/questions/${subjectToRoute[s]}`} className="hover:text-foreground hover:underline">
                  {s}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">按考试</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
              {PAPER_TYPES.map((t) => (
                <Link
                  key={t.cat}
                  href={`/questions/history/test-paper?cat=${encodeURIComponent(t.cat)}`}
                  className="hover:text-foreground hover:underline"
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">其它</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
              <Link href="/leaderboard" className="hover:text-foreground hover:underline">
                广学榜
              </Link>
              <Link href="/records" className="hover:text-foreground hover:underline">
                我的记录
              </Link>
              <a href="https://gxwtf.cn/feedback/new" className="hover:text-foreground hover:underline">
                网站反馈
              </a>
              <a href="https://gxwtf.cn/home" className="hover:text-foreground hover:underline">
                前往竞赛题库
              </a>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          想一起出题、审解析或做工具？
          <a
            href="https://gxwtf.cn/markdown/preview?file=uploads%2Frecruitment.md"
            className="ml-1 text-brand hover:underline"
          >
            看看招新说明
          </a>
        </p>
      </footer>
    </div>
  )
}
