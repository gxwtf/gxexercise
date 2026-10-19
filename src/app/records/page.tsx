import Link from "next/link"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { prisma } from "@/lib/prisma"
import { subjects } from "@/constants/subjects"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RecordsFilter } from "@/components/records/RecordsFilter"
import { RecordsPager } from "@/components/records/RecordsPager"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

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

const round1 = (n: number) => Math.round(n * 10) / 10
const scoreText = (score: number | null | undefined, max: number | null | undefined) => {
  if (score == null) return "-"
  return max ? `${round1(score)} / ${max}` : `${round1(score)}`
}

const ORDER_MAP: Record<string, Record<string, "asc" | "desc">[]> = {
  time_desc: [{ createdAt: "desc" }],
  time_asc: [{ createdAt: "asc" }],
  score_desc: [{ score: "desc" }, { createdAt: "desc" }],
  score_asc: [{ score: "asc" }, { createdAt: "desc" }],
}

export default async function RecordsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const pick = (k: string) => {
    const v = sp[k]
    return (Array.isArray(v) ? v[0] : v) ?? ""
  }
  const subject = pick("subject") || "all"
  const keyword = pick("q").trim()
  const sortRaw = pick("sort")
  const sort = ORDER_MAP[sortRaw] ? sortRaw : "time_desc"
  const pendingOnly = pick("pending") === "1"

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) redirect("/login?back=/records")
  const userId = session.userid

  const pageRaw = Number.parseInt(pick("page"), 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  // 一次作答 = 一个 QuestionGroupSubmission（套卷的小节也在这张表，testSubmissionId 非空）
  const where = {
    userId,
    questionGroup: {
      ...(subject !== "all" ? { subject } : {}),
      ...(keyword ? { title: { contains: keyword, mode: "insensitive" as const } } : {}),
    },
    ...(pendingOnly ? { submissions: { some: { gradingStatus: "pending" } } } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.questionGroupSubmission.count({ where }),
    prisma.questionGroupSubmission.findMany({
      where,
      orderBy: ORDER_MAP[sort],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        questionGroup: {
          select: { id: true, title: true, subject: true, category: true, questionType: true, score: true },
        },
        submissions: { select: { gradingStatus: true }, take: 200 },
        testSubmission: {
          select: { id: true, testPaperId: true, testPaper: { select: { title: true } } },
        },
      },
    }),
  ])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)

  // 分页/链接所需的筛选条件（可序列化，传给客户端组件）
  const pageQuery: Record<string, string> = {}
  if (subject !== "all") pageQuery.subject = subject
  if (keyword) pageQuery.q = keyword
  if (sort !== "time_desc") pageQuery.sort = sort
  if (pendingOnly) pageQuery.pending = "1"

  return (
    <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">我的作答记录</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {total} 次作答记录
            {pendingOnly && "（仅未批改）"}
            {total > PAGE_SIZE && `，第 ${safePage} / ${pageCount} 页`}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/questions/math/math-choice">去练习</Link>
        </Button>
      </div>

      <RecordsFilter
        subject={subject}
        keyword={keyword}
        sort={sort}
        pendingOnly={pendingOnly}
        subjects={subjects}
      />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          暂无记录
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">提交时间</TableHead>
                  <TableHead className="whitespace-nowrap">学科</TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead className="whitespace-nowrap">得分 / 总分</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const g = s.questionGroup
                  const pending = s.submissions.some((x) => x.gradingStatus === "pending")
                  const inPaper = s.testSubmission
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{fmt(s.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">{g.subject}</TableCell>
                      <TableCell className="min-w-[12rem]">
                        <div className="flex flex-col gap-0.5">
                          <span>{inPaper?.testPaper?.title ?? g.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {inPaper ? `套卷小节 · ${g.title}` : `单节练习 · ${g.category}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {pending ? (
                          <span className="text-amber-700 dark:text-amber-400">待批改</span>
                        ) : (
                          scoreText(s.score, g.score)
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {pending ? (
                          <Badge
                            variant="outline"
                            className="border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                          >
                            批改中
                          </Badge>
                        ) : (
                          <Badge variant="outline">已批改</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          {inPaper ? (
                            <Link href={`/test-paper/${inPaper.testPaperId}/result/${inPaper.id}`}>查看结果</Link>
                          ) : (
                            <Link href={`/question/${g.id}/review/1`}>查看回顾</Link>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <RecordsPager page={safePage} pageCount={pageCount} query={pageQuery} />
        </>
      )}
    </div>
  )
}
