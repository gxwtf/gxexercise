import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { htmlToPdf } from "@/lib/pdf/soffice"
import { reportDocHtml, reportPageHtml } from "@/lib/pdf/report-doc"
import { buildGroupReportInput } from "@/lib/pdf/report-source"
import { pdfAttachment } from "@/lib/pdf/attachment"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * 下载题组的「作答分析报告」PDF：整组所有小题 + 我的作答 + 正确答案 + 解析 + AI 批改。
 * 可选 `?submission=<questionGroupSubmissionId>` 指定某次作答，默认取最近一次。
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const submissionId = new URL(request.url).searchParams.get("submission")
  const input = await buildGroupReportInput(id, session.userid, submissionId)
  if (!input) return NextResponse.json({ error: "题组不存在或没有作答记录" }, { status: 404 })

  const html = reportPageHtml(`${input.title}（作答分析报告）`, reportDocHtml(input))

  try {
    const pdf = await htmlToPdf(html, 240_000)
    return pdfAttachment(pdf, `${input.title}-分析报告.pdf`)
  } catch (error) {
    console.error("生成题组分析报告 PDF 失败:", error)
    return NextResponse.json({ error: "PDF 生成失败" }, { status: 500 })
  }
}
