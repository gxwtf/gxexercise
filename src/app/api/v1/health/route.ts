// GET /api/v1/health —— 健康检查（公开，不需要 Bearer）
//
// 部署后 `curl -fsS https://ti.gxwtf.cn/api/v1/health` 应返回 {"status":"ok"}。

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  let db = "ok"
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (error) {
    console.error("[api/v1/health] db check failed:", error)
    db = "error"
  }

  return NextResponse.json(
    {
      status: db === "ok" ? "ok" : "degraded",
      db,
      time: new Date().toISOString(),
    },
    { status: db === "ok" ? 200 : 503 },
  )
}
