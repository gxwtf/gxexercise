// POST /api/admin/submissions/regrade —— 管理员手动重评指定作答
//
// 背景：参考答案 / 分值 / AI 批改提示词被改了之后，历史作答的分数是提交那一刻算的，
// 需要能手动按最新口径重算。作答详情页只有一个「重评」按钮，弹窗里选
// 「重评本次作答」或「重评该题组的全部作答」，两种范围都落到这里：
//   - 本次作答：body { groupSubmissionIds: [id] }
//   - 该题组全部作答：body { questionGroupId }（服务端展开成这个题组下的所有问题组提交）
//
// 只允许网站管理员（session.admin）：重评会改别人看得见的成绩，
// 题库审核同学（questionBankEditor）不在授权范围内。
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-auth"
import { getRequestIp } from "@/lib/admin-edit-log"
import { prisma } from "@/lib/prisma"
import {
  REGRADE_MAX_GROUPS,
  REGRADE_MAX_QUESTIONS,
  runRegrade,
  type RegradeTarget,
} from "@/lib/regrade"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** 请求体里的 id 可能是任何东西，统一洗成「去重后的非空字符串数组」 */
function readIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
  return Array.from(new Set(ids))
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: { groupSubmissionIds?: unknown; questionGroupId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "参数不合法" }, { status: 400 })
  }

  const selectedIds = readIds(body.groupSubmissionIds)
  const questionGroupId = typeof body.questionGroupId === "string" ? body.questionGroupId.trim() : ""

  if (selectedIds.length === 0 && !questionGroupId) {
    return NextResponse.json({ success: false, error: "参数不合法" }, { status: 400 })
  }
  if (selectedIds.length > REGRADE_MAX_GROUPS) {
    return NextResponse.json(
      { success: false, error: `一次最多重评 ${REGRADE_MAX_GROUPS} 份作答` },
      { status: 400 },
    )
  }

  try {
    // 「重评该题组的全部作答」：展开成这个题组下的所有问题组提交。
    // 题组可能被做过成百上千次，所以要先展开再判上限，超了就要求分批。
    const targets: RegradeTarget[] = selectedIds.map((id) => ({ groupSubmissionId: id }))

    if (questionGroupId) {
      const expanded = await prisma.questionGroupSubmission.findMany({
        where: { questionGroupId },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      })
      const known = new Set(selectedIds)
      for (const row of expanded) {
        if (known.has(row.id)) continue
        known.add(row.id)
        targets.push({ groupSubmissionId: row.id })
      }
    }

    if (targets.length > REGRADE_MAX_QUESTIONS) {
      return NextResponse.json(
        { success: false, error: `一次最多重评 ${REGRADE_MAX_QUESTIONS} 份作答` },
        { status: 400 },
      )
    }

    // 题组下一条作答都没有：同样算「记录不存在」
    if (targets.length === 0) {
      return NextResponse.json({ success: false, error: "记录不存在" }, { status: 404 })
    }

    const run = await runRegrade(targets)

    // 一条都没查到：这不是「重评成功但无事可做」，而是前端传了已经不存在的记录
    if (run.groups.length === 0) {
      if (run.failed.length > 0 && run.failed.every((item) => item.notFound)) {
        return NextResponse.json({ success: false, error: "记录不存在" }, { status: 404 })
      }
      console.error("[admin-regrade] 重评全部失败:", run.failed)
      return NextResponse.json({ success: false, error: "重评失败" }, { status: 500 })
    }

    let requeued = 0
    let objectiveChanged = 0
    let skipped = 0
    for (const group of run.groups) {
      for (const question of group.questions) {
        if (question.outcome === "requeued") requeued++
        else if (question.outcome === "objective-changed") objectiveChanged++
        else if (question.outcome === "skipped") skipped++
      }
    }

    const failed = run.failed.map(({ id, error }) => ({ id, error }))

    const ip = getRequestIp(request)
    console.log(
      `[admin-regrade] admin=${auth.userId}(${auth.session.username ?? "-"}) ` +
        `groups=${run.groups.length} requeued=${requeued} objectiveChanged=${objectiveChanged} ` +
        `ids=${targets.map((t) => t.groupSubmissionId).join(",")} ip=${ip ?? "-"}`,
    )

    return NextResponse.json({
      success: true,
      data: {
        groups: run.groups,
        requeued,
        objectiveChanged,
        skipped,
        failed,
      },
    })
  } catch (error) {
    console.error("管理员重评作答失败:", error)
    return NextResponse.json({ success: false, error: "重评失败" }, { status: 500 })
  }
}
