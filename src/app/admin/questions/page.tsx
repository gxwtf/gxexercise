import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getAdminViewer } from "@/lib/admin-guard"
import { subjects, categoriesBySubject } from "@/constants/subjects"
import { Button } from "@/components/ui/button"
import { QuestionBankFilter } from "@/components/admin/question-bank/QuestionBankFilter"
import { QuestionBankPager } from "@/components/admin/question-bank/QuestionBankPager"
import { QuestionBankTable, type QuestionBankRow } from "@/components/admin/question-bank/QuestionBankTable"
import type { Prisma } from "@/generated/prisma/client"
import { questionTypeLabel } from "@/lib/question-bank-meta"
import { formatDateTime } from "@/lib/submission-records"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * 管理员：题库管理 · 题组列表（只读 + 入口）。
 * 编辑动作都在 /admin/questions/[groupId]，这里只负责「找到那个题组」。
 */
export default async function AdminQuestionBankPage({ searchParams }: PageProps) {
  // 权限校验必须放在查库之前：layout 的校验拦不住 page 的执行与 RSC 载荷
  const viewer = await getAdminViewer()
  if (!viewer.ok) {
    if (viewer.reason === "anonymous") redirect("/login?back=/admin/questions")
    // 非管理员：提示由 admin/layout.tsx 渲染，这里不查库、不返回任何数据
    return null
  }

  const sp = await searchParams
  const pick = (k: string) => {
    const v = sp[k]
    return (Array.isArray(v) ? v[0] : v) ?? ""
  }
  const subject = pick("subject") || "all"
  // 类别必须属于所选学科，跨学科的 category 参数直接忽略（否则会出现「数学 + 阅读」这种死组合）
  const categoryRaw = pick("category")
  const category =
    subject !== "all" && categoryRaw && (categoriesBySubject[subject] ?? []).includes(categoryRaw)
      ? categoryRaw
      : "all"
  const keyword = pick("q").trim()

  const pageRaw = Number.parseInt(pick("page"), 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const where: Prisma.QuestionGroupWhereInput = {
    ...(subject !== "all" ? { subject } : {}),
    ...(category !== "all" ? { category } : {}),
    ...(keyword ? { title: { contains: keyword, mode: "insensitive" } } : {}),
  }

  const [total, groups] = await Promise.all([
    prisma.questionGroup.count({ where }),
    prisma.questionGroup.findMany({
      where,
      // 最近改过的排在前面：管理员通常就是来改刚动的那个题组
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        subject: true,
        questionType: true,
        score: true,
        updatedAt: true,
        _count: { select: { groupItems: true } },
      },
    }),
  ])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const startNo = (safePage - 1) * PAGE_SIZE

  // 分页/链接所需的筛选条件（可序列化，传给客户端组件）
  const pageQuery: Record<string, string> = {}
  if (subject !== "all") pageQuery.subject = subject
  if (category !== "all") pageQuery.category = category
  if (keyword) pageQuery.q = keyword

  const tableRows: QuestionBankRow[] = groups.map((g, index) => ({
    id: g.id,
    no: startNo + index + 1,
    title: g.title,
    subject: g.subject,
    typeLabel: questionTypeLabel(g.questionType),
    itemCount: g._count.groupItems,
    score: g.score,
    updatedAt: formatDateTime(g.updatedAt),
  }))

  return (
    <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            题库管理
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">管理员</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {total} 个题组
            {total > PAGE_SIZE && `，第 ${safePage} / ${pageCount} 页`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/questions/logs">修改记录</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/submissions">全部作答记录</Link>
          </Button>
        </div>
      </div>

      <QuestionBankFilter
        subject={subject}
        category={category}
        keyword={keyword}
        subjects={subjects}
        categoriesBySubject={categoriesBySubject}
      />

      {groups.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          没有符合条件的题组
        </p>
      ) : (
        <>
          <QuestionBankTable rows={tableRows} />
          <QuestionBankPager page={safePage} pageCount={pageCount} query={pageQuery} />
        </>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        按更新时间倒序排列。点「编辑」进入题组编辑页（可改题组信息与全部单题），
        点「预览」在题库前台打开该题组；每次保存都会记入「修改记录」。
      </p>
    </div>
  )
}
