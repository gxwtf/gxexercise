import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getAdminViewer } from "@/lib/admin-guard"
import { QuestionGroupEditor } from "@/components/admin/question-bank/QuestionGroupEditor"
import { readCoverCandidates } from "@/lib/cover-candidates"
import type {
  EditLogFieldChange,
  EditLogView,
  GroupEditorGroup,
  GroupEditorQuestion,
  QuestionOption,
} from "@/components/admin/question-bank/types"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ groupId: string }>
}

/** 把 Prisma 的 Json 字段安全转成审计日志用的 changes（只保留字符串，脏数据直接忽略） */
function toEditLogChanges(value: unknown): Record<string, EditLogFieldChange> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const out: Record<string, EditLogFieldChange> = {}
  for (const [field, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue
    const entry = raw as Record<string, unknown>
    const before = typeof entry.before === "string" || entry.before === null ? (entry.before as string | null) : null
    const after = typeof entry.after === "string" || entry.after === null ? (entry.after as string | null) : null
    const change: EditLogFieldChange = { before, after }
    if (typeof entry.beforeLength === "number") change.beforeLength = entry.beforeLength
    if (typeof entry.afterLength === "number") change.afterLength = entry.afterLength
    out[field] = change
  }
  return Object.keys(out).length ? out : null
}

/** 把选项 JSON 规范成 [{id,label}]；老数据里可能有其它形状，这里只取认识的两个字段 */
function toOptions(value: unknown): QuestionOption[] | null {
  if (!Array.isArray(value)) return null
  const out: QuestionOption[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === "string" ? row.id : typeof row.id === "number" ? String(row.id) : ""
    const label = typeof row.label === "string" ? row.label : row.label == null ? "" : String(row.label)
    if (!id && !label) continue
    out.push({ id, label })
  }
  return out.length ? out : null
}

/**
 * 管理员：编辑某个题组（题组信息 + 题组下每一道单题）。
 * 权限校验必须放在查库之前：layout 的校验拦不住 page 的执行与 RSC 载荷。
 */
export default async function AdminQuestionBankEditPage({ params }: PageProps) {
  const viewer = await getAdminViewer()
  const { groupId } = await params
  if (!viewer.ok) {
    if (viewer.reason === "anonymous") redirect(`/login?back=/admin/questions/${groupId}`)
    return null
  }

  const group = await prisma.questionGroup.findUnique({
    where: { id: groupId },
    include: {
      groupItems: {
        include: { question: true },
        orderBy: { orderIndex: "asc" },
      },
    },
  })
  if (!group) notFound()

  const questionIds = group.groupItems.map((item) => item.questionId)

  // 最近的改动存档：题组本身的 + 组内任意单题的
  const logs = await prisma.adminEditLog.findMany({
    where: {
      OR: [
        { groupId: group.id },
        ...(questionIds.length ? [{ targetType: "question", targetId: { in: questionIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  })

  const editorGroup: GroupEditorGroup = {
    id: group.id,
    title: group.title,
    subject: group.subject,
    category: group.category,
    questionType: group.questionType,
    grade: group.grade ?? "",
    source: group.source,
    score: group.score,
    answerMode: group.answerMode,
    tags: group.tags ?? [],
    imageUrl: group.imageUrl ?? "",
    content: group.content ?? "",
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    itemCount: group.groupItems.length,
  }

  const editorQuestions: GroupEditorQuestion[] = group.groupItems.map((item) => ({
    id: item.question.id,
    orderIndex: item.orderIndex,
    values: {
      questionType: item.question.questionType,
      content: item.question.content ?? "",
      options: toOptions(item.question.options),
      answer: item.question.answer ?? "",
      analysis: item.question.analysis ?? "",
      score: item.question.score,
      tags: item.question.tags ?? [],
      category: item.question.category ?? "",
      grade: item.question.grade ?? "",
      year: item.question.year ?? null,
      source: item.question.source ?? "",
    },
  }))

  // 候选封面来自流水线缓存（.cache/cover），没有就返回 null，界面上显示「暂无候选」
  const coverCandidates = await readCoverCandidates(group.id)

  const editorLogs: EditLogView[] = logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    adminId: log.adminId,
    adminName: log.adminName,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    targetLabel: log.targetLabel,
    groupId: log.groupId,
    groupTitle: log.groupTitle,
    changes: toEditLogChanges(log.changes),
    summary: log.summary ?? null,
  }))

  return (
    <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
      <QuestionGroupEditor
        group={editorGroup}
        questions={editorQuestions}
        logs={editorLogs}
        coverCandidates={coverCandidates}
      />
    </div>
  )
}
