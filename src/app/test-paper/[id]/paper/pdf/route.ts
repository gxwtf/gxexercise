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

/** 下载整卷的「纸质作答卷」PDF（无答案、无解析，按考试卷版式留出作答空间） */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const paper = await prisma.testPaper.findUnique({
    where: { id },
    include: { paperItems: { orderBy: { orderIndex: "asc" } } },
  })
  if (!paper) return NextResponse.json({ error: "试卷不存在" }, { status: 404 })

  const groupIds = paper.paperItems.map((item) => item.itemId)
  const groups = await prisma.questionGroup.findMany({
    where: { id: { in: groupIds } },
    include: { groupItems: { include: { question: true }, orderBy: { orderIndex: "asc" } } },
  })
  const groupMap = new Map(groups.map((group) => [group.id, group]))
  const orderedGroups = groupIds
    .map((groupId) => groupMap.get(groupId))
    .filter((group): group is (typeof groups)[number] => Boolean(group))

  const paperGroups = toPaperGroups(orderedGroups)
  const body = paperDocHtml({
    kind: "paper",
    title: paper.title,
    subject: paper.subject,
    source: paper.source,
    grade: paper.grade,
    year: paper.year,
    totalScore: paper.totalScore,
    duration: paper.duration,
    groups: paperGroups,
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  })
  const html = paperPageHtml(`${paper.title}（纸质作答卷）`, body)

  try {
    const pdf = await htmlToPdf(html, 240_000)
    return pdfAttachment(pdf, `${paper.title}-纸质作答卷.pdf`)
  } catch (error) {
    console.error("生成套卷作答卷 PDF 失败:", error)
    return NextResponse.json({ error: "PDF 生成失败" }, { status: 500 })
  }
}
