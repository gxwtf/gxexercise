// 机器对机器接口的统一鉴权（Bearer）
//
// 用途：给脚本、快捷指令、其他站点读取题库内容，不依赖浏览器登录态。
// 配置：服务器 .env 里的 GXEXERCISE_API_KEY，支持逗号分隔多把 key（轮换用）。
// 与用户会话（iron-session）完全分开：这个 key 只读，不能提交作答。

import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * 校验 Authorization: Bearer <key>。
 * 通过返回 null；不通过返回可直接 `return` 的 401/503 响应。
 */
export function requireApiKey(request: Request): NextResponse | null {
  const keys = (process.env.GXEXERCISE_API_KEY ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)

  if (keys.length === 0) {
    return NextResponse.json(
      { success: false, error: "服务端未配置 GXEXERCISE_API_KEY" },
      { status: 503 },
    )
  }

  const header = request.headers.get("authorization") ?? ""
  const token = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : ""

  if (!token) {
    return NextResponse.json(
      { success: false, error: "缺少 Bearer token" },
      { status: 401 },
    )
  }

  if (!keys.some((key) => safeEqual(key, token))) {
    return NextResponse.json(
      { success: false, error: "无效的 Bearer token" },
      { status: 401 },
    )
  }

  return null
}
