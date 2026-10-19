import Link from "next/link"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { prisma } from "@/lib/prisma"
import { subjects } from "@/constants/subjects"
import { Button } from "@/components/ui/button"
import { RecordsFilter } from "@/components/records/RecordsFilter"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function fmt(date: Date | null | undefined) {
  if (!date) return "-"
  return new Date(date).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const scoreText = (score: number | null | undefined, max: number | null | undefined) => {
  if (score == null) return "-"
  return max ? `${Math.round(score * 10) / 10} / ${max}` : `${Math.round(score * 10) / 10}`
}

/** 主观题（作文/阅读表达等）没有对错，只看得分 */
function isSubjectiveGroup(questionType: string) {
  return /writing|essay|reading-expression|作文|写作|阅读表达/.test(questionType)
}

export default async function RecordsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const pick = (k: string) => {
    const v = sp[k]
    return (Array.isArray(v) ? v[0] : v) ?? ""
  }
  const subject = pick("subject") || "all"
  const keyword = pick("q").trim()

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) redirect("/login?back=/records")
  const userId = session.userid

  const subjectFilter = subject !== "all" ? { subject } : {}
  const groupNameFilter = keyword ? { title: { contains: keyword, mode: "insensitive" as const } } : {}

  const [groupSubs, paperSubs] = await Promise.all([
    prisma.questionGroupSubmission.findMany({
      where: {
        userId,
        questionGroup: { ...subjectFilter, ...groupNameFilter },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        questionGroup: {
          select: { id: true, title: true, subject: true, category: true, questionType: true, score: true },
        },
      },
    }),
    prisma.testPaperSubmission.findMany({
      where: { userId, testPaper: { ...subjectFilter, ...groupNameFilter } },
      orderBy: { submittedAt: "desc" },
      take: 100,
      include: { testPaper: { select: { id: true, title: true, subject: true, totalScore: true } } },
    }),
  ])

  const hasFilter = subject !== "all" || keyword.length > 0

  return (
    <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">我的作答记录</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {paperSubs.length} 次套卷提交、{groupSubs.length} 次单节练习
            {hasFilter && "（已按条件筛选，最多显示 100 条）"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/questions/math/math-choice">去练习</Link>
        </Button>
      </div>

      <RecordsFilter subject={subject} keyword={keyword} subjects={subjects} />

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">套卷提交</h2>
        {paperSubs.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">暂无记录</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">提交时间</TableHead>
                  <TableHead>学科</TableHead>
                  <TableHead>试卷</TableHead>
                  <TableHead className="whitespace-nowrap">得分 / 总分</TableHead>
                  <TableHead className="whitespace-nowrap">用时</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paperSubs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmt(s.submittedAt ?? s.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">{s.testPaper.subject}</TableCell>
                    <TableCell className="min-w-[12rem]">{s.testPaper.title}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{scoreText(s.score, s.testPaper.totalScore)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {s.duration ? `${Math.round(s.duration / 60)} 分钟` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/test-paper/${s.testPaper.id}/result/${s.id}`}>查看结果</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">单节练习</h2>
        {groupSubs.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">暂无记录</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">提交时间</TableHead>
                  <TableHead>学科</TableHead>
                  <TableHead>题组</TableHead>
                  <TableHead className="whitespace-nowrap">结果</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupSubs.map((s) => {
                  const g = s.questionGroup
                  const subjective = isSubjectiveGroup(g.questionType)
                  const resultText = subjective
                    ? scoreText(s.score, g.score)                 // 主观题：得分 / 总分
                    : s.correctNum != null && s.totalNum
                      ? `${s.correctNum} / ${s.totalNum} 题正确`
                      : scoreText(s.score, g.score)
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{fmt(s.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">{g.subject}</TableCell>
                      <TableCell className="min-w-[12rem]">{g.title}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{resultText}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/question/${g.id}/review/1`}>查看回顾</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
