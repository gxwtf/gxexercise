import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getAdminViewer } from "@/lib/admin-guard"
import { subjects } from "@/constants/subjects"
import { Button } from "@/components/ui/button"
import { AdminSubmissionsFilter } from "@/components/admin/AdminSubmissionsFilter"
import { AdminSubmissionsPager } from "@/components/admin/AdminSubmissionsPager"
import { AdminSubmissionsTable, type AdminSubmissionRow } from "@/components/admin/AdminSubmissionsTable"
import type { Prisma } from "@/generated/prisma/client"
import { AI_GRADEABLE, ORDER_MAP, formatDateTime, needsAiGrading, scoreText } from "@/lib/submission-records"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * 管理员：全部用户的作答记录（只读）。
 * 与「我的作答记录」同源（一次作答 = 一条 QuestionGroupSubmission），额外支持按用户筛选。
 */
export default async function AdminSubmissionsPage({ searchParams }: PageProps) {
  // 权限校验必须放在查库之前：layout 的校验拦不住 page 的执行与 RSC 载荷
  const viewer = await getAdminViewer()
  if (!viewer.ok) {
    if (viewer.reason === "anonymous") redirect("/login?back=/admin/submissions")
    // 非管理员：提示由 admin/layout.tsx 渲染，这里不查库、不返回任何数据
    return null
  }

  const sp = await searchParams
  const pick = (k: string) => {
    const v = sp[k]
    return (Array.isArray(v) ? v[0] : v) ?? ""
  }
  const subject = pick("subject") || "all"
  const keyword = pick("q").trim()
  const userQuery = pick("user").trim()
  const sortRaw = pick("sort")
  const sort = ORDER_MAP[sortRaw] ? sortRaw : "time_desc"
  const pendingOnly = pick("pending") === "1"

  const pageRaw = Number.parseInt(pick("page"), 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  // 关键词 / 未批改都作用在题组上
  const questionGroupWhere: Prisma.QuestionGroupWhereInput = {
    ...(subject !== "all" ? { subject } : {}),
    ...(keyword ? { title: { contains: keyword, mode: "insensitive" } } : {}),
    ...(pendingOnly ? { questionType: { in: AI_GRADEABLE } } : {}),
  }

  // 用户筛选：纯数字优先按用户 ID 精确匹配，否则按用户名模糊匹配
  const userIdNum = /^\d+$/.test(userQuery) ? Number(userQuery) : null
  const userWhere: Prisma.UserWhereInput | undefined = userQuery
    ? userIdNum !== null
      ? { OR: [{ id: userIdNum }, { userName: { contains: userQuery, mode: "insensitive" } }] }
      : { userName: { contains: userQuery, mode: "insensitive" } }
    : undefined

  const where: Prisma.QuestionGroupSubmissionWhereInput = {
    questionGroup: questionGroupWhere,
    ...(userWhere ? { user: userWhere } : {}),
    // 只看未批改：仅统计需要 AI 批改的题型（客观题提交时已判分，状态就是 graded）
    ...(pendingOnly ? { submissions: { some: { gradingStatus: "pending" } } } : {}),
  }

  const [total, distinctUsers, rows] = await Promise.all([
    prisma.questionGroupSubmission.count({ where }),
    prisma.questionGroupSubmission.findMany({ where, distinct: ["userId"], select: { userId: true } }),
    prisma.questionGroupSubmission.findMany({
      where,
      orderBy: ORDER_MAP[sort],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, userName: true } },
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
  if (userQuery) pageQuery.user = userQuery
  if (sort !== "time_desc") pageQuery.sort = sort
  if (pendingOnly) pageQuery.pending = "1"

  const tableRows: AdminSubmissionRow[] = rows.map((s) => {
    const g = s.questionGroup
    const inPaper = s.testSubmission
    return {
      id: s.id,
      time: formatDateTime(s.createdAt),
      userName: s.user.userName || `同学${s.user.id}`,
      userId: s.user.id,
      subject: g.subject,
      title: inPaper?.testPaper?.title ?? g.title,
      subtitle: inPaper ? `套卷小节 · ${g.title}` : g.category ? `单节练习 · ${g.category}` : "单节练习",
      score: scoreText(s.score, g.score),
      pending: needsAiGrading(g.questionType) && s.submissions.some((x) => x.gradingStatus === "pending"),
      detailHref: `/admin/submissions/${s.id}`,
      // 套卷小节：删除会连同整份套卷；单节练习：只删这一条
      deleteKind: (inPaper ? "paper" : "group") as "paper" | "group",
      deleteId: inPaper ? inPaper.id : s.id,
    }
  })

  return (
    <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            全部作答记录
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">管理员</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {total} 次作答 · {distinctUsers.length} 位用户
            {pendingOnly && "（仅未批改的主观题）"}
            {total > PAGE_SIZE && `，第 ${safePage} / ${pageCount} 页`}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/records">我的作答记录</Link>
        </Button>
      </div>

      <AdminSubmissionsFilter
        subject={subject}
        keyword={keyword}
        user={userQuery}
        sort={sort}
        pendingOnly={pendingOnly}
        subjects={subjects}
      />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          没有符合条件的作答记录
        </p>
      ) : (
        <>
          <AdminSubmissionsTable rows={tableRows} />
          <AdminSubmissionsPager page={safePage} pageCount={pageCount} query={pageQuery} />
        </>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        该页面汇集所有用户的作答记录：管理员可查看详情或删除指定记录（删除不可恢复，套卷小节会连同整份套卷一起删除）；
        同学本人仍可在「我的作答记录」中自助删除。
      </p>
    </div>
  )
}
