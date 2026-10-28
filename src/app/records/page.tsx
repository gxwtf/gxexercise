import Link from "next/link"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { prisma } from "@/lib/prisma"
import { subjects } from "@/constants/subjects"
import { Button } from "@/components/ui/button"
import { RecordsFilter } from "@/components/records/RecordsFilter"
import { RecordsPager } from "@/components/records/RecordsPager"
import { RecordsTable } from "@/components/records/RecordsTable"
import { AI_GRADEABLE, ORDER_MAP, formatDateTime, needsAiGrading, scoreText } from "@/lib/submission-records"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
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
    // 只看未批改：仅统计需要 AI 批改的题型（客观题提交时已判分，状态就是 graded）
    ...(pendingOnly
      ? {
          questionGroup: {
            ...(subject !== "all" ? { subject } : {}),
            ...(keyword ? { title: { contains: keyword, mode: "insensitive" as const } } : {}),
            questionType: { in: AI_GRADEABLE },
          },
          submissions: { some: { gradingStatus: "pending" } },
        }
      : {}),
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

    // 组装给客户端表格的数据（全部可序列化）
  const tableRows = rows.map((s) => {
    const g = s.questionGroup
    const pending = needsAiGrading(g.questionType) && s.submissions.some((x) => x.gradingStatus === "pending")
    const inPaper = s.testSubmission
    return {
      id: s.id,
      time: formatDateTime(s.createdAt),
      subject: g.subject,
      title: inPaper?.testPaper?.title ?? g.title,
      subtitle: inPaper ? `套卷小节 · ${g.title}` : `单节练习 · ${g.category}`,
      score: scoreText(s.score, g.score),
      pending,
      detailHref: inPaper
        ? `/test-paper/${inPaper.testPaperId}/result/${inPaper.id}`
        : `/question/${g.id}/review/1`,
      practiceHref: inPaper ? `/test-paper/${inPaper.testPaperId}/practice` : `/question/${g.id}`,
      pdfHref: inPaper
        ? // 套卷小节：导整卷分析报告
          `/test-paper/${inPaper.testPaperId}/result/${inPaper.id}/pdf`
        : // 单节练习：导这一次作答的题组分析报告
          `/question/${g.id}/review/pdf?submission=${s.id}`,
      deleteKind: (inPaper ? "paper" : "group") as "paper" | "group",
      deleteId: inPaper ? inPaper.id : s.id,
    }
  })

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
        <div className="flex flex-wrap items-center gap-2">
          {session.admin && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/submissions">全部作答记录</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/questions/math/math-choice">去练习</Link>
          </Button>
        </div>
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
          <RecordsTable rows={tableRows} />
          <RecordsPager page={safePage} pageCount={pageCount} query={pageQuery} />
        </>
      )}
    </div>
  )
}
