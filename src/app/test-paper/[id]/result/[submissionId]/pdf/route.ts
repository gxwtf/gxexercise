import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { htmlToPdf } from "@/lib/pdf/soffice"
import { reportDocHtml, reportPageHtml } from "@/lib/pdf/report-doc"
import { buildPaperReportInput } from "@/lib/pdf/report-source"
import { pdfAttachment } from "@/lib/pdf/attachment"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string; submissionId: string }>
}

/**
 * 下载整卷的「作答分析报告」PDF：按大题分节，整卷所有小题 + 我的作答 +
 * 正确答案 + 解析 + 作文 AI 批改 + 错题汇总。
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id, submissionId } = await params

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const input = await buildPaperReportInput(id, submissionId, session.userid)
  if (!input) return NextResponse.json({ error: "试卷或作答记录不存在" }, { status: 404 })

  const html = reportPageHtml(`${input.title}（作答分析报告）`, reportDocHtml(input))

  try {
    const pdf = await htmlToPdf(html, 300_000)
    return pdfAttachment(pdf, `${input.title}-分析报告.pdf`)
  } catch (error) {
    console.error("生成套卷分析报告 PDF 失败:", error)
    return NextResponse.json({ error: "PDF 生成失败" }, { status: 500 })
  }
}
