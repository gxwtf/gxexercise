// GET /api/v1/test-papers —— 套卷列表（只读，Bearer 鉴权）
//
// 筛选：subject / year / grade / q / source / tag
// 分页：page（从 1 开始）、pageSize（默认 20，上限 100）

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiKey } from "@/lib/api-key"
import {
  buildPaperWhere,
  paperListSelect,
  parsePaging,
  serializePaperList,
  serverError,
} from "@/lib/api-v1"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = requireApiKey(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const { page, pageSize, skip } = parsePaging(searchParams)

  try {
    const where = buildPaperWhere(searchParams)
    const [total, rows] = await Promise.all([
      prisma.testPaper.count({ where }),
      prisma.testPaper.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: paperListSelect,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: rows.map(serializePaperList),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    })
  } catch (error) {
    return serverError("test-papers", error)
  }
}
