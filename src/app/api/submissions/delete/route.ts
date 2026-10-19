import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"

interface DeleteItem {
  kind: "group" | "paper"
  id: string
}

/**
 * 删除作答记录（支持批量）
 * body: { items: [{ kind: "group" | "paper", id }] }
 * 兼容旧的单条写法 { kind, id }
 *
 * - group：单节练习记录；若该节属于某次套卷提交，则整份套卷记录一起删
 * - paper：整份套卷提交（连同其所有小节与题目提交）
 */
export async function POST(request: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
  }
  const userId = session.userid

  let body: { items?: DeleteItem[]; kind?: string; id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "请求体解析失败" }, { status: 400 })
  }

  const items: DeleteItem[] = Array.isArray(body.items)
    ? body.items
    : body.kind && body.id
      ? [{ kind: body.kind as DeleteItem["kind"], id: body.id }]
      : []

  const valid = items.filter((i) => i && i.id && (i.kind === "group" || i.kind === "paper"))
  if (valid.length === 0) {
    return NextResponse.json({ success: false, error: "参数不合法" }, { status: 400 })
  }
  if (valid.length > 200) {
    return NextResponse.json({ success: false, error: "一次最多删除 200 条" }, { status: 400 })
  }

  try {
    const groupIds = new Set<string>()
    const paperIds = new Set<string>()

    const paperItemIds = valid.filter((i) => i.kind === "paper").map((i) => i.id)
    const groupItemIds = valid.filter((i) => i.kind === "group").map((i) => i.id)

    if (paperItemIds.length) {
      const papers = await prisma.testPaperSubmission.findMany({
        where: { id: { in: paperItemIds }, userId },
        select: { id: true },
      })
      papers.forEach((p) => paperIds.add(p.id))
    }

    if (groupItemIds.length) {
      const groups = await prisma.questionGroupSubmission.findMany({
        where: { id: { in: groupItemIds }, userId },
        select: { id: true, testSubmissionId: true },
      })
      for (const g of groups) {
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
      return NextResponse.json({ success: false, error: "记录不存在或无权删除" }, { status: 404 })
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

    return NextResponse.json({
      success: true,
      deleted: { groups: groupIds.size, papers: paperIds.size },
    })
  } catch (error) {
    console.error("删除作答记录失败:", error)
    return NextResponse.json({ success: false, error: "删除失败" }, { status: 500 })
  }
}
