import Link from "next/link"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { ArrowUpRight, BookOpenCheck, CheckCircle2, ChevronRight, Clock, FileText, Trophy } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { subjects, subjectToRoute, categoriesBySubject, categoryToRoute } from "@/constants/subjects"
import { getLeaderboard, getMyRank } from "@/lib/leaderboard"
import { LeaderboardList } from "@/components/leaderboard/LeaderboardList"
import SampleQuestion from "@/components/home/sample-question"
import PaperFinder from "@/components/home/paper-finder"

export const dynamic = "force-dynamic"

/** 整卷链路（选择题 + 非选择题大题）的六科；其余三科目前只收部分题型 */
const FULL_SUBJECTS = ["语文", "英语", "生物", "历史", "地理", "政治"]
const PARTIAL_SUBJECTS: Record<string, string> = {
  数学: "目前收录选择题与填空题",
  物理: "目前收录选择题",
  化学: "目前收录图片版选择题",
}

/** 按考试找卷的四个类型（与 /questions/<学科>/套卷 的筛选参数一致） */
const PAPER_TYPES = [
  { label: "北京高考真题", cat: "高考真题" },
  { label: "各区一模", cat: "各区一模" },
  { label: "各区二模", cat: "各区二模" },
  { label: "各区上期末", cat: "各区期末" },
]

const dayFmt = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" })

export default async function RootPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  const userId = session.isLoggedIn && session.userid ? session.userid : 0

  const [
    paperTotal,
    questionTotal,
    paperBySubject,
    groupBySubject,
    recentPapers,
    { rows: studyTop },
    { rows: scoreTop },
  ] = await Promise.all([
    prisma.testPaper.count(),
    prisma.question.count(),
    prisma.testPaper.groupBy({ by: ["subject"], _count: { id: true } }),
    prisma.questionGroup.groupBy({ by: ["subject"], _count: { id: true } }),
    prisma.testPaper.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true, subject: true, createdAt: true },
    }),
    getLeaderboard({ period: "week", metric: "count", limit: 5 }),
    getLeaderboard({ period: "week", metric: "score", limit: 5 }),
  ])

  // 每科「最新一卷」：只对六科主干各查一次（轻查询），保证每张卡片都有最新的卷名
  const latestBySubject = new Map<string, { id: string; title: string; year: number | null }>()
  const latestRows = await Promise.all(
    FULL_SUBJECTS.map((subject) =>
      prisma.testPaper.findFirst({
        where: { subject },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, subject: true, year: true },
      }),
    ),
  )
  for (const row of latestRows) {
    if (row) latestBySubject.set(row.subject, { id: row.id, title: row.title, year: row.year })
  }
  const paperCountMap = new Map(paperBySubject.map((r) => [r.subject, r._count.id]))
  const groupCountMap = new Map(groupBySubject.map((r) => [r.subject, r._count.id]))
  const totalGroups = Array.from(groupCountMap.values()).reduce((a, b) => a + b, 0)

  // 已登录：我的待批改 / 最近作答 / 本周名次
  let pendingCount = 0
  let recentSubs: { id: string; title: string; href: string; score: number | null; max: number | null }[] = []
  let myRank: Awaited<ReturnType<typeof getMyRank>> = null
  if (userId) {
    const [pending, groupSubs, paperSubs, rank] = await Promise.all([
      prisma.questionSubmission.count({ where: { userId, gradingStatus: "pending" } }),
      // 题组/套卷形态优先：一次练习（一个题组或一整卷）比单题更能说明「上次做到哪」
      prisma.questionGroupSubmission.findMany({
        where: { userId, testSubmissionId: null },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          score: true,
          correctNum: true,
          totalNum: true,
          createdAt: true,
          questionGroup: { select: { id: true, title: true, score: true } },
        },
      }),
      prisma.testPaperSubmission.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, score: true, createdAt: true, testPaper: { select: { id: true, title: true, totalScore: true } } },
      }),
      getMyRank({ period: "week", userId }),
    ])

    pendingCount = pending

    // 合并「题组练习」与「整卷练习」两类记录，按时间倒序取最近 3 条
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
      // 只有单题作答时兜底（比如只做过「体验题」之外的零散单题）
      const single = await prisma.questionSubmission.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          score: true,
          question: { select: { subject: true, source: true, score: true } },
        },
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
    <div className="bg-background">
      {/* ── 首屏：一句话定位 + 数据 + 两个主入口 ── */}
      <section className="border-b border-border bg-gradient-to-b from-muted/60 to-background">
        <div className="mx-auto w-full max-w-5xl px-6 pb-10 pt-10 sm:pt-14">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <BookOpenCheck className="size-3.5 text-brand" aria-hidden="true" />
            广学题库 · 公测期
          </p>
          <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-5xl">
            北京高中真题与各区模拟，
            <span className="text-brand">九科齐全</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            教师版带答案与解析。单题、题组、整卷三种练法；客观题提交即判，主观题按采分点由 AI 批改，纸质作答卷与回顾 PDF 可导出。
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="text-foreground">
              <strong className="text-lg font-semibold">{paperTotal}</strong> 套卷
            </span>
            <span className="text-foreground">
              <strong className="text-lg font-semibold">{questionTotal.toLocaleString("zh-CN")}</strong> 道题
            </span>
            <span className="text-foreground">
              <strong className="text-lg font-semibold">{totalGroups}</strong> 个题组
            </span>
            <span>2011–2026 北京高考真题 · 2021–2026 各区一模 / 二模 / 上期末</span>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={userId ? (recentSubs[0]?.href ?? "#subjects") : "#sample"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              {userId ? (recentSubs[0] ? "继续上次练习" : "挑一套开始") : "不登录，先做一道"}
            </Link>
            <Link
              href="#subjects"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              按学科开始
            </Link>
            <Link href="#by-exam" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              按考试找卷
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          {recentPapers.length > 0 && (
            <div className="mt-7 rounded-xl border border-border bg-card/70 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">最近入库</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {recentPapers.map((p) => (
                  <li key={p.id} className="flex items-center gap-1.5 text-foreground">
                    <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
                    <Link href={`/test-paper/${p.id}`} className="hover:underline">
                      {p.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">{dayFmt.format(p.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* ── 免登录体验一道（只给未登录访客；登录后改由「我的学习」承接） ── */}
      {!userId ? <SampleQuestion /> : null}

      {/* ── 我的学习（仅登录后） ── */}
      {userId ? (
        <section id="me" className="border-y border-border bg-muted/30">
          <div className="mx-auto w-full max-w-5xl px-6 py-12">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-2xl font-bold text-foreground">我的学习</h2>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href="/records" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  我的作答记录
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
                <Link href="/leaderboard" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  完整榜单
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" aria-hidden="true" />
                  待 AI 批改
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{pendingCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pendingCount > 0 ? "提交后通常十几秒内出结果" : "当前没有排队中的作答"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Trophy className="size-4" aria-hidden="true" />
                  本周名次
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {myRank ? `第 ${myRank.rankCount}` : "—"}
                  {myRank && (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">/ {myRank.totalUsers} 人</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {myRank ? `本周做题 ${myRank.questions} 题 · 得分合计 ${Math.round(myRank.score)}` : "本周还没有作答记录"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="size-4" aria-hidden="true" />
                  最近作答
                </p>
                {recentSubs.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">还没有作答记录，去学科区挑一套开始吧。</p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {recentSubs.map((s) => (
                      <li key={s.id} className="flex items-baseline justify-between gap-2">
                        <Link href={s.href} className="min-w-0 truncate text-foreground hover:underline">
                          {s.title}
                        </Link>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {s.score != null
                            ? `${Math.round((s.score as number) * 10) / 10}${s.max != null ? `/${s.max}` : ""} 分`
                            : "待批改"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── 按考试找卷 ── */}
      <section id="by-exam" className="mx-auto w-full max-w-5xl scroll-mt-20 px-6 py-14">
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-foreground">按考试找卷</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            选学科 + 类型 + 年份，直接进这套卷子所在的列表（都是教师版，带答案与解析）。
          </p>
        </div>
        <PaperFinder />
      </section>

      {/* ── 学科区：主干（整卷）与枝干（部分题型） ── */}
      <section id="subjects" className="scroll-mt-20 border-y border-border bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-6 py-14">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">按学科刷题</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              六科是完整整卷（选择题 + 非选择题大题）；数学 / 物理 / 化学目前只收录部分题型，已在下面单独标注。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FULL_SUBJECTS.map((subject) => {
              const route = subjectToRoute[subject]
              const latest = latestBySubject.get(subject)
              const cats = (categoriesBySubject[subject] || []).filter((c) => c !== "套卷").slice(0, 4)
              return (
                <article key={subject} className="flex flex-col rounded-xl border border-border bg-card p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      <Link href={`/questions/${route}`} className="hover:underline">
                        {subject}
                      </Link>
                    </h3>
                    <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                      选择 + 大题
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {paperCountMap.get(subject) ?? 0} 套卷 · {groupCountMap.get(subject) ?? 0} 个题组
                  </p>
                  {latest && (
                    <Link
                      href={`/test-paper/${latest.id}`}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                    >
                      最新：{latest.title}
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Link>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {cats.map((c) => (
                      <Link
                        key={c}
                        href={`/questions/${route}/${categoryToRoute[subject]?.[c]}`}
                        className="rounded-md border border-border px-2 py-0.5 text-xs text-foreground hover:bg-accent"
                      >
                        {c}
                      </Link>
                    ))}
                    <Link
                      href={`/questions/${route}/${categoryToRoute[subject]?.["套卷"]}`}
                      className="rounded-md border border-brand/40 px-2 py-0.5 text-xs font-medium text-brand hover:bg-accent"
                    >
                      整卷
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-8 rounded-xl border border-dashed border-border bg-card/60 p-5">
            <h3 className="text-sm font-semibold text-foreground">部分题型（整卷还在补）</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {Object.entries(PARTIAL_SUBJECTS).map(([subject, note]) => (
                <li key={subject} className="text-sm">
                  <Link href={`/questions/${subjectToRoute[subject]}`} className="font-medium text-foreground hover:underline">
                    {subject}
                  </Link>
                  <span className="ml-2 text-muted-foreground">
                    {paperCountMap.get(subject) ?? 0} 套 · {note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 判分口径 ── */}
      <section id="how" className="mx-auto w-full max-w-5xl scroll-mt-20 px-6 py-14">
        <h2 className="text-2xl font-bold text-foreground">写完之后，怎么判</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <CheckCircle2 className="size-5 text-green-700 dark:text-green-400" aria-hidden="true" />
            <h3 className="mt-2 font-semibold text-foreground">客观题即时判分</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              选择题、填空题提交即出对错；同一道题重复作答只按最高分计入榜单。
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <BookOpenCheck className="size-5 text-brand" aria-hidden="true" />
            <h3 className="mt-2 font-semibold text-foreground">主观题按采分点</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              作文与阅读表达按维度评；语文阅读、历史 / 地理 / 政治按参考答案的采分点或等级表；生物大题按每个空判。
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <FileText className="size-5 text-foreground" aria-hidden="true" />
            <h3 className="mt-2 font-semibold text-foreground">纸质作答卷可导出</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              题组与整卷都能导出「纸质作答卷」PDF（无答案、按考试版式留白），回顾页可导出带解析的 PDF。
            </p>
          </div>
        </div>
      </section>

      {/* ── 广学榜（社群位，放在学科区之后） ── */}
      <section id="leaderboard" className="scroll-mt-20 border-y border-border bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-6 py-14">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-bold text-foreground">广学榜</h2>
            <Link href="/leaderboard" className="text-sm font-medium text-brand hover:underline">
              完整榜单（周榜 / 月榜）→
            </Link>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <LeaderboardList
              title="勤学榜"
              subtitle="本周做题数量 Top 5"
              rows={studyTop}
              metric="count"
              compact
              href="/leaderboard?period=week"
            />
            <LeaderboardList
              title="卓越榜"
              subtitle="本周得分合计 Top 5"
              rows={scoreTop}
              metric="score"
              compact
              href="/leaderboard?period=week"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            统计规则：周期内同一道题只算一次（多次作答取最高分）；周榜为本周一至周日，月榜为本月 1 日至月末（北京时间）。
            <Link href="/leaderboard" className="ml-1 text-brand hover:underline">
              查看详细规则
            </Link>
          </p>
        </div>
      </section>

      {/* ── 页脚：状态、来源与全量导航 ── */}
      <footer className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-foreground">
            公测期 <span className="font-medium">0.3.0-rc1</span> · 九科集齐 · {paperTotal} 套卷 /{" "}
            {questionTotal.toLocaleString("zh-CN")} 道题
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            题目与答案来自菁师帮教师版试卷，图片、表格与答案以原卷为准；AI 批改是参考意见，与教师评分可能存在差异。
          </p>
        </div>

        <nav aria-label="按学科" className="mt-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">按学科</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {subjects.map((s) => (
              <li key={s}>
                <Link href={`/questions/${subjectToRoute[s]}`} className="text-foreground hover:underline">
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="按考试" className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">按考试</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {PAPER_TYPES.map((t) => (
              <li key={t.cat}>
                <Link
                  href={`/questions/history/test-paper?cat=${encodeURIComponent(t.cat)}`}
                  className="text-foreground hover:underline"
                >
                  {t.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="#by-exam" className="text-brand hover:underline">
                自选学科 / 年份
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="其它" className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">其它</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <li>
              <Link href="/leaderboard" className="text-foreground hover:underline">
                广学榜
              </Link>
            </li>
            <li>
              <Link href="/records" className="text-foreground hover:underline">
                我的作答记录
              </Link>
            </li>
            <li>
              <Link href="#how" className="text-foreground hover:underline">
                判分与导出说明
              </Link>
            </li>
            <li>
              <a href="https://gxwtf.cn/feedback/new" className="text-foreground hover:underline">
                网站反馈
              </a>
            </li>
            <li>
              <a href="https://gxwtf.cn/home" className="text-foreground hover:underline">
                前往竞赛题库
              </a>
            </li>
          </ul>
        </nav>

        <p className="mt-8 text-xs text-muted-foreground">
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
