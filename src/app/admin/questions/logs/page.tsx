import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getAdminViewer } from "@/lib/admin-guard"
import { Button } from "@/components/ui/button"
import { EditLogFilter } from "@/components/admin/question-bank/EditLogFilter"
import { EditLogTable, type EditLogRow } from "@/components/admin/question-bank/EditLogTable"
import { QuestionBankPager } from "@/components/admin/question-bank/QuestionBankPager"
import type { Prisma } from "@/generated/prisma/client"
import type { FieldChange } from "@/lib/admin-edit-log"
import { formatDateTime } from "@/lib/submission-records"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * 管理员：题库修改记录（审计日志）。
 * 数据源是 AdminEditLog（与业务更新同事务写入），只读展示，不提供删除/编辑。
 */
export default async function AdminQuestionEditLogsPage({ searchParams }: PageProps) {
  // 权限校验必须放在查库之前：layout 的校验拦不住 page 的执行与 RSC 载荷
  const viewer = await getAdminViewer()
  if (!viewer.ok) {
    if (viewer.reason === "anonymous") redirect("/login?back=/admin/questions/logs")
    // 非管理员：提示由 admin/layout.tsx 渲染，这里不查库、不返回任何数据
    return null
  }

  const sp = await searchParams
  const pick = (k: string) => {
    const v = sp[k]
    return (Array.isArray(v) ? v[0] : v) ?? ""
  }
  const typeRaw = pick("type")
  const targetType = typeRaw === "group" || typeRaw === "question" ? typeRaw : "all"
  const keyword = pick("q").trim()
  const admin = pick("admin").trim()

  const pageRaw = Number.parseInt(pick("page"), 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const where: Prisma.AdminEditLogWhereInput = {
    ...(targetType !== "all" ? { targetType } : {}),
    // 关键词同时匹配对象名、所属题组名与管理员名：管理员往往只记得其中一样
    ...(keyword
      ? {
          OR: [
            { targetLabel: { contains: keyword, mode: "insensitive" } },
            { groupTitle: { contains: keyword, mode: "insensitive" } },
            { adminName: { contains: keyword, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(admin ? { adminName: { contains: admin, mode: "insensitive" } } : {}),
  }

  const [total, logs] = await Promise.all([
    prisma.adminEditLog.count({ where }),
    prisma.adminEditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)

  // 分页/链接所需的筛选条件（可序列化，传给客户端组件）
  const pageQuery: Record<string, string> = {}
  if (targetType !== "all") pageQuery.type = targetType
  if (keyword) pageQuery.q = keyword
  if (admin) pageQuery.admin = admin

  const tableRows: EditLogRow[] = logs.map((log) => ({
    id: log.id,
    time: formatDateTime(log.createdAt),
    adminId: log.adminId,
    adminName: log.adminName,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    targetLabel: log.targetLabel,
    groupId: log.groupId,
    groupTitle: log.groupTitle,
    // changes 是 Json 列（Prisma 只保证是 unknown），结构由 EditLogTable 自己收窄校验
    changes: log.changes as Record<string, FieldChange> | null,
  }))

  return (
    <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            修改记录
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">管理员</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {total} 条改动
            {total > PAGE_SIZE && `，第 ${safePage} / ${pageCount} 页`}
            {" · 日志只保留每个字段的前 800 字预览"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/questions">返回题库管理</Link>
        </Button>
      </div>

      <EditLogFilter targetType={targetType} keyword={keyword} admin={admin} />

      {logs.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          没有符合条件的修改记录
        </p>
      ) : (
        <>
          <EditLogTable rows={tableRows} />
          <QuestionBankPager
            page={safePage}
            pageCount={pageCount}
            query={pageQuery}
            basePath="/admin/questions/logs"
          />
        </>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        每次在题组编辑页保存（含封面增删）都会在这里留下一条记录：谁、什么时候、改了哪个对象的哪些字段。
        日志按时间倒序排列，正文等长字段只保存前 800 字预览，原始长度另外记录。
      </p>
    </div>
  )
}
