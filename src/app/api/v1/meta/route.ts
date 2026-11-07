// GET /api/v1/meta —— 学科 / 类别 / 路由 slug / 考区清单（只读，Bearer 鉴权）
//
// 客户端做筛选器时先用这个接口拿枚举，不要硬编码中文名。

import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { apiMeta } from "@/lib/api-v1"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = requireApiKey(request)
  if (denied) return denied

  return NextResponse.json({ success: true, data: apiMeta() })
}
