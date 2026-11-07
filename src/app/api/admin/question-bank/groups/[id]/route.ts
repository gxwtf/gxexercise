// PATCH /api/admin/question-bank/groups/[id] —— 管理员修改题组（题组编辑页的「保存」）
//
// 三件事必须一起成立，否则不能算改成功：
//   1) 请求体校验通过（见 src/lib/question-bank-validate.ts）；
//   2) 与旧值相比确实有字段变了（没变就什么都不写，避免日志里刷出「空改动」）；
//   3) 业务更新与审计日志在**同一个事务**里落地 —— 改了必有记录，回滚也不会留幽灵日志。
//
// 返回 { success: true, data: { group, changed } }：group 是更新后的完整题组，
// changed 是实际变动字段名（前端用来 toast「已保存：标题、分值」）。
import { NextResponse } from "next/server"
import { requireQuestionBankEditor } from "@/lib/question-bank-auth"
import { prisma } from "@/lib/prisma"
import { buildFieldChanges, getRequestIp, writeAdminEditLog } from "@/lib/admin-edit-log"
import { GROUP_EDITABLE_FIELDS } from "@/lib/question-bank-meta"
import {
  GROUP_NULLABLE_FIELDS,
  normalizeEmptyToNull,
  parseGroupPatch,
  readJsonObject,
} from "@/lib/question-bank-validate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireQuestionBankEditor()
  if (!auth.ok) return auth.response

  const { id } = await params

  const body = await readJsonObject(request)
  if (!body.ok) {
    return NextResponse.json({ success: false, error: body.error }, { status: 400 })
  }
  const parsed = parseGroupPatch(body.data)
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
  }
  const patch = parsed.data

  try {
    const before = await prisma.questionGroup.findUnique({ where: { id } })
    if (!before) {
      return NextResponse.json({ success: false, error: "题组不存在" }, { status: 404 })
    }

    // 只拿「提交过并通过校验」的字段算 diff：没提交的字段不进日志。
    // 旧值的空串先归一成 null，避免把「库里是 ""、前端送空」误判成改动。
    const changes = buildFieldChanges(
      normalizeEmptyToNull(before, GROUP_NULLABLE_FIELDS),
      patch,
      GROUP_EDITABLE_FIELDS,
    )
    const changed = Object.keys(changes)
    if (changed.length === 0) {
      // 无实际变化：不更新、不写日志（updatedAt 也别动，否则列表排序会莫名跳到最前）
      return NextResponse.json({ success: true, data: { group: before, changed: [] } })
    }

    const ip = getRequestIp(request)
    const group = await prisma.$transaction(async (tx) => {
      const updated = await tx.questionGroup.update({ where: { id }, data: patch })
      await writeAdminEditLog(tx, {
        adminId: auth.userId,
        adminName: auth.session.username || null,
        action: "update-group",
        targetType: "group",
        targetId: id,
        // 有标题变更时记新标题，否则 new==old，等于记原标题
        targetLabel: updated.title,
        groupId: updated.id,
        groupTitle: updated.title,
        changes,
        ip,
      })
      return updated
    })

    return NextResponse.json({ success: true, data: { group, changed } })
  } catch (error) {
    console.error("管理员修改题组失败:", error)
    return NextResponse.json({ success: false, error: "保存失败" }, { status: 500 })
  }
}
