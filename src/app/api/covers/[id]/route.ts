// GET /api/covers/<groupId>.jpg —— 封面图（生产自托管，读磁盘，不走 public/）
//
// 为什么不用 public/：`next start` 只在启动时登记 public 文件清单，运行期新增的图
// 会 404，换封面就得重启服务。改成路由处理器每次读盘后，换图/新增图即时生效。
//
// 目录默认 /home/gxwtf/gxexercise-data/covers，可用 COVERS_DIR 覆盖。
import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COVERS_DIR = process.env.COVERS_DIR || "/home/gxwtf/gxexercise-data/covers"
// groupId 是 cuid(25) 或更短的 id，只允许字母数字下划线连字符，杜绝路径穿越
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params
  const id = raw.replace(/\.(jpe?g|png|webp)$/i, "")
  if (!ID_RE.test(id)) {
    return new NextResponse("invalid cover id", { status: 400 })
  }

  const file = path.join(COVERS_DIR, `${id}.jpg`)
  try {
    // 文件名固定为 <groupId>.jpg，换封面后地址不变：用 size+mtime 做 ETag，
    // 浏览器带着 If-None-Match 来问就回 304（省流量），文件换了就自动拿到新图，
    // 不会再出现「换了图但浏览器还在用旧的」或「文件刚写好后一直 404」的假象。
    const [stat, buf] = await Promise.all([fs.stat(file), fs.readFile(file)])
    const etag = `"${stat.size}-${Math.floor(stat.mtimeMs)}"`
    const headers = {
      ETag: etag,
      "Cache-Control": "public, max-age=60, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    }
    if (_request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers })
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        ...headers,
        "Content-Type": "image/jpeg",
        "Content-Length": String(buf.byteLength),
      },
    })
  } catch {
    return new NextResponse("cover not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    })
  }
}
