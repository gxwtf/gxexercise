import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import { prisma } from "@/lib/prisma"
import { findSourcePdf } from "@/lib/pdf/find-source-pdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

/** 下载该套试卷的原始 PDF（自动在素材目录里按标题模糊匹配文件） */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params
  const paper = await prisma.testPaper.findUnique({
    where: { id },
    select: { title: true, subject: true },
  })
  if (!paper) return NextResponse.json({ error: "试卷不存在" }, { status: 404 })

  const match = findSourcePdf(paper.title, paper.subject)
  if (!match) {
    return NextResponse.json({ error: "没有找到该试卷的原始 PDF" }, { status: 404 })
  }

  try {
    const buf = await readFile(match.file)
    const filename = `${match.fileName}`.replace(/[\\/:*?"<>|]/g, "_")
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="paper.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    console.error("读取试卷 PDF 失败:", error)
    return NextResponse.json({ error: "读取文件失败" }, { status: 500 })
  }
}
