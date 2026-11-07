// PATCH /api/admin/question-bank/questions/[id] —— 管理员修改小题（题组编辑页里的小题表单）
//
// 与题组 PATCH 同样的三条约束：校验通过 → 确实有变化 → 业务更新与审计日志同事务。
//
// 小题没有 title 字段，审计日志的 targetLabel 用题干摘要（questionStemPreview）；
// 同时回填所属题组（小题可能属于多个题组，取 orderIndex 最小的那个），
// 这样「修改记录」页能从日志直接跳回题组编辑页。
import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { requireAdmin } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { buildFieldChanges, getRequestIp, writeAdminEditLog } from "@/lib/admin-edit-log"
import { QUESTION_EDITABLE_FIELDS, questionStemPreview } from "@/lib/question-bank-meta"
import {
  normalizeEmptyToNull,
  parseQuestionPatch,
  QUESTION_NULLABLE_FIELDS,
  readJsonObject,
} from "@/lib/question-bank-validate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params

  const body = await readJsonObject(request)
  if (!body.ok) {
    return NextResponse.json({ success: false, error: body.error }, { status: 400 })
  }
  const parsed = parseQuestionPatch(body.data)
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
  }
  const patch = parsed.data

  try {
    const before = await prisma.question.findUnique({ where: { id } })
    if (!before) {
      return NextResponse.json({ success: false, error: "小题不存在" }, { status: 404 })
    }

    // 所属题组只用于写日志（题目可以不属于任何题组，如题库里还没组卷的散题）
    const groupItem = await prisma.groupItem.findFirst({
      where: { questionId: id },
      orderBy: { orderIndex: "asc" },
      select: { groupId: true, group: { select: { title: true } } },
    })

    // 旧值里的 "" 与 null 视为同一件事（历史数据两种都有），避免刷出假改动
    const changes = buildFieldChanges(
      normalizeEmptyToNull(before, QUESTION_NULLABLE_FIELDS),
      patch,
      QUESTION_EDITABLE_FIELDS,
    )
    const changed = Object.keys(changes)
    if (changed.length === 0) {
      return NextResponse.json({ success: true, data: { question: before, changed: [] } })
    }

    // options 是 Json? 列：清空必须写 Prisma.DbNull（写 null 会被当成 JSON 的 null 值），
    // 而 diff 用的是普通数组/null，所以单独从 patch 里摘出来处理。
    const { options, ...rest } = patch
    const data: Prisma.QuestionUpdateInput = { ...rest }
    if (options !== undefined) {
      data.options = options === null ? Prisma.DbNull : (options as Prisma.InputJsonValue)
    }

    const ip = getRequestIp(request)
    const question = await prisma.$transaction(async (tx) => {
      const updated = await tx.question.update({ where: { id }, data })
      await writeAdminEditLog(tx, {
        adminId: auth.userId,
        adminName: auth.session.username || null,
        action: "update-question",
        targetType: "question",
        targetId: id,
        targetLabel: questionStemPreview(updated.content),
        groupId: groupItem?.groupId ?? null,
        groupTitle: groupItem?.group.title ?? null,
        changes,
        ip,
      })
      return updated
    })

    return NextResponse.json({ success: true, data: { question, changed } })
  } catch (error) {
    console.error("管理员修改小题失败:", error)
    return NextResponse.json({ success: false, error: "保存失败" }, { status: 500 })
  }
}
