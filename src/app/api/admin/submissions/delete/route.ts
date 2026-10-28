import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { DELETE_BATCH_LIMIT, deleteSubmissionRecords, parseDeleteTargets } from "@/lib/submission-delete"

/**
 * 管理员删除任意用户的作答记录（支持批量）
 * body: { items: [{ kind: "group" | "paper", id }] }，兼容 { kind, id }
 *
 * 与 /api/submissions/delete 的区别：不限制 userId；但必须带管理员会话。
 * 套卷小节的删除会升级为整份套卷（与逻辑保持一致的级联规则）。
 * 删除前先查出记录归属与标题，写一条审计日志（journalctl -u gxexercise 可查）。
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: { items?: unknown; kind?: unknown; id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "请求体解析失败" }, { status: 400 })
  }

  const targets = parseDeleteTargets(body)
  if (targets.length === 0) {
    return NextResponse.json({ success: false, error: "参数不合法" }, { status: 400 })
  }
  if (targets.length > DELETE_BATCH_LIMIT) {
    return NextResponse.json({ success: false, error: `一次最多删除 ${DELETE_BATCH_LIMIT} 条` }, { status: 400 })
  }

  try {
    // 审计信息：删除前的归属（谁、哪个题组 / 套卷）
    const groupIds = targets.filter((t) => t.kind === "group").map((t) => t.id)
    const paperIds = targets.filter((t) => t.kind === "paper").map((t) => t.id)
    const [groups, papers] = await Promise.all([
      groupIds.length
        ? prisma.questionGroupSubmission.findMany({
            where: { id: { in: groupIds } },
            select: {
              id: true,
              userId: true,
              user: { select: { userName: true } },
              questionGroup: { select: { title: true } },
              testSubmissionId: true,
            },
          })
        : Promise.resolve([]),
      paperIds.length
        ? prisma.testPaperSubmission.findMany({
            where: { id: { in: paperIds } },
            select: { id: true, userId: true, testPaper: { select: { title: true } } },
          })
        : Promise.resolve([]),
    ])

    const deleted = await deleteSubmissionRecords(targets)
    if (deleted.groups === 0 && deleted.papers === 0) {
      return NextResponse.json({ success: false, error: "记录不存在" }, { status: 404 })
    }

    const audit = [
      ...groups.map(
        (g) =>
          `group:${g.id} user=${g.userId}(${g.user.userName ?? "-"}) title=${g.questionGroup.title}` +
          (g.testSubmissionId ? ` -> paper:${g.testSubmissionId}` : "")
      ),
      ...papers.map((p) => `paper:${p.id} user=${p.userId} title=${p.testPaper.title}`),
    ]
    console.log(
      `[admin-delete] admin=${auth.userId}(${auth.session.username ?? "-"}) deleted=${JSON.stringify(deleted)} targets=${audit.join(" | ")}`
    )

    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    console.error("管理员删除作答记录失败:", error)
    return NextResponse.json({ success: false, error: "删除失败" }, { status: 500 })
  }
}
