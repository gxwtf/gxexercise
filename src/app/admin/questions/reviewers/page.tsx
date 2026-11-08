import Link from "next/link"
import { redirect } from "next/navigation"
import { getAdminViewer } from "@/lib/admin-guard"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/EmptyState"
import { Inbox } from "lucide-react"
import { ReviewerManager, type ReviewerRow } from "@/components/admin/question-bank/ReviewerManager"

export const dynamic = "force-dynamic"

/**
 * 管理员：题目审核管理（哪些非网站管理员可以管理题库）。
 * 只有网站管理员能看/改这份名单；审核同学本人进不来这个页面（layout 放行，但本页自己拦）。
 */
export default async function QuestionBankReviewersPage() {
  const viewer = await getAdminViewer()
  if (!viewer.ok) {
    if (viewer.reason === "anonymous") redirect("/login?back=/admin/questions/reviewers")
    return (
      <div className="app-container py-16">
        <EmptyState
          icon={<Inbox />}
          title="需要网站管理员权限"
          description="题目审核管理仅网站管理员可查看和修改；题库审核同学可以直接去「题库管理」改题。"
          action={
            <Button asChild>
              <Link href="/admin/questions">题库管理</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const reviewers = await prisma.questionBankReviewer.findMany({ orderBy: { createdAt: "asc" } })
  const rows: ReviewerRow[] = reviewers.map((reviewer) => ({
    id: reviewer.id,
    userName: reviewer.userName,
    userId: reviewer.userId,
    grade: reviewer.grade,
    createdAt: reviewer.createdAt.toISOString(),
  }))

  return (
    <div className="app-container py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            题目审核管理
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">管理员</span>
          </h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/questions">返回题库管理</Link>
        </Button>
      </div>

      <ReviewerManager reviewers={rows} />
    </div>
  )
}
