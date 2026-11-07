// GET /api/v1/stats —— 题库规模总览（只读，Bearer 鉴权）
//
// 用途：后台看板、同步脚本判断是否需要重跑、内容盘点。
// 回答「有多少题 / 多少个题组 / 多少套卷 / 各科各多少」。

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiKey } from "@/lib/api-key"
import { serverError } from "@/lib/api-v1"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = requireApiKey(request)
  if (denied) return denied

  try {
    const [questions, groups, papers, submissions, bySubject] = await Promise.all([
      prisma.question.count(),
      prisma.questionGroup.count(),
      prisma.testPaper.count(),
      prisma.questionGroupSubmission.count(),
      prisma.questionGroup.groupBy({
        by: ["subject"],
        _count: { id: true },
      }),
    ])

    const subjects: Record<string, number> = {}
    for (const row of bySubject) {
      subjects[row.subject] = row._count.id
    }

    return NextResponse.json({
      success: true,
      data: {
        questions,
        groups,
        papers,
        groupSubmissions: submissions,
        groupsBySubject: subjects,
      },
    })
  } catch (error) {
    return serverError("stats", error)
  }
}
