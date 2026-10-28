// 作答记录删除（共享逻辑）
//
// 被两处复用：
// - /api/submissions/delete         学生删除自己的记录（带 userId 约束）
// - /api/admin/submissions/delete   管理员删除任意用户的记录（无 userId 约束，需 admin）
//
// 一次「作答」= 一条 QuestionGroupSubmission：
// - 若它属于某次套卷提交（testSubmissionId 非空），删除范围升级为整份套卷（连同其所有小节），
//   避免留下缺小节的半份套卷记录
// - 否则只删这一条（先删其下的小题提交，再删作答本身）

import { prisma } from "@/lib/prisma"

export interface DeleteTarget {
  kind: "group" | "paper"
  id: string
}

export interface DeleteResult {
  groups: number
  papers: number
}

export const DELETE_BATCH_LIMIT = 200

/** 解析并校验请求里的删除目标（兼容旧的单条写法 { kind, id }） */
export function parseDeleteTargets(body: {
  items?: unknown
  kind?: unknown
  id?: unknown
}): DeleteTarget[] {
  const rawItems = Array.isArray(body.items) ? body.items : body.kind && body.id ? [{ kind: body.kind, id: body.id }] : []
  return rawItems
    .map((item) => item as Partial<DeleteTarget> | null)
    .filter((item): item is DeleteTarget => Boolean(item && item.id && (item.kind === "group" || item.kind === "paper")))
}

/**
 * 删除作答记录（含套卷级联）。
 * @param userId 传了就只允许删该用户的记录（学生自助删除）；管理员删除时不传
 */
export async function deleteSubmissionRecords(
  targets: DeleteTarget[],
  userId?: number
): Promise<DeleteResult> {
  const groupIds = new Set<string>()
  const paperIds = new Set<string>()

  const owned = userId === undefined ? {} : { userId }

  const paperItemIds = targets.filter((t) => t.kind === "paper").map((t) => t.id)
  const groupItemIds = targets.filter((t) => t.kind === "group").map((t) => t.id)

  if (paperItemIds.length) {
    const papers = await prisma.testPaperSubmission.findMany({
      where: { id: { in: paperItemIds }, ...owned },
      select: { id: true },
    })
    papers.forEach((p) => paperIds.add(p.id))
  }

  if (groupItemIds.length) {
    const groups = await prisma.questionGroupSubmission.findMany({
      where: { id: { in: groupItemIds }, ...owned },
      select: { id: true, testSubmissionId: true },
    })
    for (const g of groups) {
      // 套卷小节：整份套卷一起删
      if (g.testSubmissionId) paperIds.add(g.testSubmissionId)
      else groupIds.add(g.id)
    }
  }

  if (paperIds.size) {
    const sections = await prisma.questionGroupSubmission.findMany({
      where: { testSubmissionId: { in: Array.from(paperIds) } },
      select: { id: true },
    })
    sections.forEach((s) => groupIds.add(s.id))
  }

  if (groupIds.size === 0 && paperIds.size === 0) {
    return { groups: 0, papers: 0 }
  }

  await prisma.$transaction(async (tx) => {
    if (groupIds.size) {
      const ids = Array.from(groupIds)
      await tx.questionSubmission.deleteMany({ where: { groupSubmissionId: { in: ids } } })
      await tx.questionGroupSubmission.deleteMany({ where: { id: { in: ids } } })
    }
    if (paperIds.size) {
      await tx.testPaperSubmission.deleteMany({ where: { id: { in: Array.from(paperIds) } } })
    }
  })

  return { groups: groupIds.size, papers: paperIds.size }
}
