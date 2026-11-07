// GET /api/v1/questions —— 题组列表（只读，Bearer 鉴权）
//
// 与网页列表页同口径：subject / category / cat / district / year / grade / q
// 分页：page（从 1 开始）、pageSize（默认 20，上限 100）
// 列表只回元信息，不含题干与答案；要正文请取 /api/v1/questions/<id>。

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiKey } from "@/lib/api-key"
import {
  buildGroupWhere,
  groupListSelect,
  parsePaging,
  serializeGroupList,
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
    const where = buildGroupWhere(searchParams)
    const [total, rows] = await Promise.all([
      prisma.questionGroup.count({ where }),
      prisma.questionGroup.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: groupListSelect,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: rows.map(serializeGroupList),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    })
  } catch (error) {
    return serverError("questions", error)
  }
}
