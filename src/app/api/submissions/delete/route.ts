import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"

/**
 * 删除作答记录
 * body: { kind: "group" | "paper", id: string }
 * - group：单节练习记录（若该节属于某次套卷提交，则整份套卷记录一起删）
 * - paper：整份套卷提交
 */
export async function POST(request: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
  }
  const userId = session.userid

  let body: { kind?: string; id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "请求体解析失败" }, { status: 400 })
  }
  const { kind, id } = body
  if (!id || (kind !== "group" && kind !== "paper")) {
    return NextResponse.json({ success: false, error: "参数不合法" }, { status: 400 })
  }

  try {
    let groupSubmissionIds: string[] = []
    let testSubmissionId: string | null = null

    if (kind === "paper") {
      const sub = await prisma.testPaperSubmission.findUnique({
        where: { id },
        select: { userId: true },
      })
      if (!sub || sub.userId !== userId) {
        return NextResponse.json({ success: false, error: "记录不存在" }, { status: 404 })
      }
      testSubmissionId = id
    } else {
      const sub = await prisma.questionGroupSubmission.findUnique({
        where: { id },
        select: { userId: true, testSubmissionId: true },
      })
      if (!sub || sub.userId !== userId) {
        return NextResponse.json({ success: false, error: "记录不存在" }, { status: 404 })
      }
      if (sub.testSubmissionId) {
        // 属于套卷的小节：整份套卷记录一起删，避免留下半份数据
        testSubmissionId = sub.testSubmissionId
      } else {
        groupSubmissionIds = [id]
      }
    }

    if (testSubmissionId) {
      const sections = await prisma.questionGroupSubmission.findMany({
        where: { testSubmissionId },
        select: { id: true },
      })
      groupSubmissionIds = sections.map((s) => s.id)
    }

    await prisma.$transaction(async (tx) => {
      if (groupSubmissionIds.length) {
        await tx.questionSubmission.deleteMany({ where: { groupSubmissionId: { in: groupSubmissionIds } } })
        await tx.questionGroupSubmission.deleteMany({ where: { id: { in: groupSubmissionIds } } })
      }
      if (testSubmissionId) {
        await tx.testPaperSubmission.delete({ where: { id: testSubmissionId } })
      }
    })

    return NextResponse.json({ success: true, deleted: testSubmissionId ? "paper" : "group" })
  } catch (error) {
    console.error("删除作答记录失败:", error)
    return NextResponse.json({ success: false, error: "删除失败" }, { status: 500 })
  }
}
