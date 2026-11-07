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
 * 管理员：题库审核名单（哪些非网站管理员可以管理题库）。
 * 只有网站管理员能看/改这份名单；审核同学本人进不来这个页面（layout 放行，但本页自己拦）。
 */
export default async function QuestionBankReviewersPage() {
  const viewer = await getAdminViewer()
  if (!viewer.ok) {
    if (viewer.reason === "anonymous") redirect("/login?back=/admin/questions/reviewers")
    return (
      <div className="container mx-auto px-3 py-16 sm:px-4">
        <EmptyState
          icon={<Inbox />}
          title="需要网站管理员权限"
          description="审核名单仅网站管理员可查看和修改；题库审核同学可以直接去「题库管理」改题。"
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
    <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">题库审核名单</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            名单里的同学（不是网站管理员也可以）登录后可在「管理 → 题库管理」里查看和修改题目。
            名单变更会记入修改记录。
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/questions">返回题库管理</Link>
        </Button>
      </div>

      <ReviewerManager reviewers={rows} />

      <p className="mt-6 text-xs text-muted-foreground">
        用户名必须是广学账号的用户名（与登录时一致）。如果同学改名，需要先移出旧名字再加入新名字。
      </p>
    </div>
  )
}
