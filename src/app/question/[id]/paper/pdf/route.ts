import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { prisma } from "@/lib/prisma"
import { htmlToPdf } from "@/lib/pdf/soffice"
import { paperDocHtml, paperPageHtml } from "@/lib/pdf/paper-doc"
import { toPaperGroups } from "@/lib/pdf/paper-source"
import { pdfAttachment } from "@/lib/pdf/attachment"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

/** 下载题组的「纸质作答卷」PDF（无答案、无解析，按考试卷版式留出作答空间） */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const group = await prisma.questionGroup.findUnique({
    where: { id },
    include: { groupItems: { include: { question: true }, orderBy: { orderIndex: "asc" } } },
  })
  if (!group) return NextResponse.json({ error: "题组不存在" }, { status: 404 })

  const [paperGroup] = toPaperGroups([group])
  const body = paperDocHtml({
    kind: "group",
    title: group.title,
    subject: group.subject,
    source: group.source,
    grade: group.grade,
    groups: [paperGroup],
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  })
  const html = paperPageHtml(`${group.title}（纸质作答卷）`, body)

  try {
    const pdf = await htmlToPdf(html, 180_000)
    return pdfAttachment(pdf, `${group.title}-纸质作答卷.pdf`)
  } catch (error) {
    console.error("生成题组作答卷 PDF 失败:", error)
    return NextResponse.json({ error: "PDF 生成失败" }, { status: 500 })
  }
}
