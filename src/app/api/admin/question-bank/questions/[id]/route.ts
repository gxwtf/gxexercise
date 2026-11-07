// PATCH /api/admin/question-bank/questions/[id] —— 管理员修改单题（题组编辑页里的单题表单）
//
// 与题组 PATCH 同样的三条约束：校验通过 → 确实有变化 → 业务更新与审计日志同事务。
//
// 单题没有 title 字段，审计日志的 targetLabel 用题干摘要（questionStemPreview）；
// 同时回填所属题组（单题可能属于多个题组，取 orderIndex 最小的那个），
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

interface GroupScoreUpdate {
  groupId: string
  title: string
  before: number
  after: number
}

/**
 * 重算「包含这道单题」的所有题组的总分。
 *
 * 规则（与题库展示口径一致）：
 *   - 普通题组：单题分值之和；
 *   - answerMode = "pick-one"（作文二选一 / 微写作三选一）：取单题最高分（等于单题满分，不是翻倍）；
 *   - QuestionGroup.score 是 Float 列，保留小数（单题分值允许 .5，例如完形每题 1.5 分），
 *     只按 0.01 精度收敛，避免浮点累加噪声（如 0.30000000000000004）。
 */
async function recalcGroupScores(
  tx: Prisma.TransactionClient,
  questionId: string,
): Promise<GroupScoreUpdate[]> {
  const memberships = await tx.groupItem.findMany({ where: { questionId }, select: { groupId: true } })
  const updates: GroupScoreUpdate[] = []

  for (const { groupId } of memberships) {
    const group = await tx.questionGroup.findUnique({
      where: { id: groupId },
      select: { id: true, title: true, score: true, answerMode: true },
    })
    if (!group) continue

    const items = await tx.groupItem.findMany({
      where: { groupId },
      select: { question: { select: { score: true } } },
    })
    const scores = items.map((item) => item.question.score)
    if (scores.length === 0) continue

    const total =
      group.answerMode === "pick-one" ? Math.max(...scores) : scores.reduce((sum, score) => sum + score, 0)
    const nextScore = Math.round(total * 100) / 100
    if (nextScore === group.score) continue

    await tx.questionGroup.update({ where: { id: groupId }, data: { score: nextScore } })
    updates.push({ groupId, title: group.title, before: group.score, after: nextScore })
  }

  return updates
}

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
      return NextResponse.json({ success: false, error: "单题不存在" }, { status: 404 })
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
      // 题组分值 = 单题分值合计（pick-one 取单题满分），改单题分值后同步重算
      const scoreUpdates = await recalcGroupScores(tx, id)
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
        summary: scoreUpdates.length
          ? `题组分值自动合计：${scoreUpdates
              .map((item) => `${item.title} ${item.before} → ${item.after} 分`)
              .join("；")}`
          : null,
        ip,
      })
      return updated
    })

    return NextResponse.json({ success: true, data: { question, changed } })
  } catch (error) {
    console.error("管理员修改单题失败:", error)
    return NextResponse.json({ success: false, error: "保存失败" }, { status: 500 })
  }
}
