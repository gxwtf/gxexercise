import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { prisma } from "@/lib/prisma"
import { htmlToPdf, pageHtml } from "@/lib/pdf/soffice"
import { reviewDocHtml } from "@/lib/pdf/review-doc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string; questionIndex: string }>
}

/** 下载单题回顾 PDF（服务端生成，直接附件下载，不在前端预览） */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id, questionIndex } = await params
  const index = Math.max(1, Number.parseInt(questionIndex, 10) || 1)

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const group = await prisma.questionGroup.findUnique({
    where: { id },
    include: { groupItems: { include: { question: true }, orderBy: { orderIndex: "asc" } } },
  })
  if (!group) return NextResponse.json({ error: "题组不存在" }, { status: 404 })

  const item = group.groupItems[index - 1]
  if (!item) return NextResponse.json({ error: "题目不存在" }, { status: 404 })
  const question = item.question

  // 取该用户在这个题组最近一次作答
  const groupSub = await prisma.questionGroupSubmission.findFirst({
    where: { userId: session.userid, questionGroupId: id },
    orderBy: { createdAt: "desc" },
  })
  const sub = groupSub
    ? await prisma.questionSubmission.findFirst({
        where: { groupSubmissionId: groupSub.id, questionId: question.id },
        orderBy: { createdAt: "desc" },
      })
    : null

  const userAnswer = ((sub?.content as { answer?: string } | null)?.answer ?? "").trim()
  const aiFeedback = (sub?.aiFeedback ?? null) as Record<string, unknown> | null
  const scoreText =
    sub?.score != null ? `${Math.round(sub.score * 10) / 10} / ${question.score ?? "-"}` : null

  const body = reviewDocHtml({
    title: group.title,
    questionIndex: index,
    questionType: group.questionType,
    content:
      group.category === "名著" && group.content
        ? `${group.content}\n\n${question.content ?? ""}`
        : question.content ?? "",
    userAnswer,
    correctAnswer: question.answer ?? "",
    analysis: question.analysis ?? "",
    scoreText,
    aiFeedback,
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  })

  const html = pageHtml(`${group.title} 第${index}题`, body)

  try {
    const pdf = await htmlToPdf(html)
    const filename = `${group.title}-第${index}题.pdf`.replace(/[\\/:*?"<>|]/g, "_")
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="review-${index}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("生成回顾 PDF 失败:", error)
    return NextResponse.json({ error: "PDF 生成失败" }, { status: 500 })
  }
}
