// POST   /api/admin/question-bank/groups/[id]/cover —— 上传 / 更换题组封面
// DELETE /api/admin/question-bank/groups/[id]/cover —— 移除题组封面
//
// 为什么不用 public/：`next start` 只在启动时登记 public 文件清单，运行期新增的图会 404，
// 换封面就得重启服务。所以封面文件写到 COVERS_DIR（默认 /home/gxwtf/gxexercise-data/covers），
// 由 /api/covers/[id] 每次读盘返回，换图即时生效（见 src/app/api/covers/[id]/route.ts）。
//
// 上传流程与顺序（失败必须「不动库、不动旧封面」）：
//   1) 鉴权 → 题组存在性（先查库，不值得为一个不存在的 id 跑图片转换）
//   2) multipart 解析 → ≤8MB → MIME 白名单 + 魔数嗅探（MIME 是客户端说的，魔数是文件真的）
//   3) 原图写 os.tmpdir() → ImageMagick 转成 COVERS_DIR 下的**临时** jpg → rename 覆盖正式文件
//      （本项目没装 sharp，系统里有 /usr/bin/convert；先转临时文件再原子 rename，
//        转换失败时旧封面不会被截断成半张图）
//   4) 事务内更新 imageUrl + 写审计日志；文件写入在事务外（文件系统没有回滚）
import { execFile } from "node:child_process"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { buildFieldChanges, getRequestIp, writeAdminEditLog } from "@/lib/admin-edit-log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const run = promisify(execFile)

const COVERS_DIR = process.env.COVERS_DIR || "/home/gxwtf/gxexercise-data/covers"
const CONVERT_BIN = "/usr/bin/convert"
const MAX_BYTES = 8 * 1024 * 1024
// 与 /api/covers/[id] 保持一致：id 只允许字母数字下划线连字符，杜绝路径穿越到 COVERS_DIR 之外
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/
// 只收这三种：ImageMagick 都吃得下，转出来的 jpg 也稳
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"])

type ImageKind = "jpeg" | "png" | "webp"

/**
 * 魔数嗅探：不信 Content-Type，直接看文件头。
 * 否则把 .php / .svg 改名成 .jpg 再伪造 MIME 就能骗过校验。
 */
function sniffImageKind(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg"
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "png"
  }
  // WebP 头：RIFF....WEBP
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    return "webp"
  }
  return null
}

const KIND_EXT: Record<ImageKind, string> = { jpeg: ".jpg", png: ".png", webp: ".webp" }
const MIME_KIND: Record<string, ImageKind> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
}

function errorJson(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!ID_RE.test(id)) return errorJson("题组不存在", 404)

  // 先查题组：不存在就别浪费 CPU 去转图
  const group = await prisma.questionGroup.findUnique({ where: { id }, select: { id: true, title: true, imageUrl: true } })
  if (!group) return errorJson("题组不存在", 404)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return errorJson("上传内容解析失败（需要 multipart/form-data）", 400)
  }

  const file = form.get("file")
  if (!(file instanceof File)) return errorJson("缺少 file 字段", 400)
  if (file.size === 0) return errorJson("上传文件为空", 400)
  if (file.size > MAX_BYTES) return errorJson("图片不能超过 8MB", 400)

  const declaredMime = (file.type || "").toLowerCase()
  if (!ALLOWED_MIME.has(declaredMime)) return errorJson("只支持 JPG / PNG / WebP 图片", 400)

  const buffer = Buffer.from(await file.arrayBuffer())
  const kind = sniffImageKind(buffer)
  if (!kind) return errorJson("只支持 JPG / PNG / WebP 图片", 400)
  if (MIME_KIND[declaredMime] !== kind) return errorJson("图片实际格式与声明的类型不一致", 400)

  // 原图落临时文件（convert 需要真实路径，不读 stdin 更方便排错）
  const tmpInput = path.join(os.tmpdir(), `gxcover-${id}-${process.pid}-${Date.now()}${KIND_EXT[kind]}`)
  const targetFile = path.join(COVERS_DIR, `${id}.jpg`)
  // 同目录临时输出：rename 在同一个文件系统内是原子的，能保证「要么旧图、要么新图」
  const tmpOutput = path.join(COVERS_DIR, `.${id}-${process.pid}-${Date.now()}.tmp.jpg`)

  try {
    await fs.writeFile(tmpInput, buffer)
    await fs.mkdir(COVERS_DIR, { recursive: true })
    await run(CONVERT_BIN, [
      tmpInput,
      "-auto-orient", // 按 EXIF 摆正手机拍的照片
      "-resize",
      "1600x1600>", // 只缩不放：小图不放大，避免糊
      "-strip", // 去掉 EXIF/ICC，省体积也去掉定位信息
      "-quality",
      "86",
      tmpOutput,
    ])
    await fs.rename(tmpOutput, targetFile)
  } catch (error) {
    console.error("封面转换失败:", error)
    await fs.rm(tmpOutput, { force: true })
    return errorJson("图片转换失败，请换一张图片重试", 500)
  } finally {
    await fs.rm(tmpInput, { force: true })
  }

  // 文件名带 groupId，换封面时路径不变，因此加了 ?v= 之外还要靠较短的缓存时间（见 covers 路由）
  const imageUrl = `/api/covers/${id}.jpg`
  try {
    await prisma.$transaction(async (tx) => {
      await tx.questionGroup.update({ where: { id }, data: { imageUrl } })
      const changes = buildFieldChanges(group, { imageUrl }, ["imageUrl"])
      await writeAdminEditLog(tx, {
        adminId: auth.userId,
        adminName: auth.session.username || null,
        action: "upload-cover",
        targetType: "group",
        targetId: id,
        targetLabel: group.title,
        groupId: id,
        groupTitle: group.title,
        // 换了图但地址没变（同名覆盖）时 before === after，changes 就是空 → 存 null，
        // 但这次操作本身仍然要留痕
        changes: Object.keys(changes).length ? changes : null,
        ip: getRequestIp(request),
      })
    })
  } catch (error) {
    console.error("封面入库失败:", error)
    return errorJson("封面保存失败", 500)
  }

  return NextResponse.json({ success: true, data: { imageUrl } })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!ID_RE.test(id)) return errorJson("题组不存在", 404)

  const group = await prisma.questionGroup.findUnique({ where: { id }, select: { id: true, title: true, imageUrl: true } })
  if (!group) return errorJson("题组不存在", 404)

  // 先删文件再改库：文件不存在不算错（外链封面本就没有本地文件）
  try {
    await fs.rm(path.join(COVERS_DIR, `${id}.jpg`), { force: true })
  } catch (error) {
    console.error("封面文件删除失败:", error)
    return errorJson("封面文件删除失败", 500)
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.questionGroup.update({ where: { id }, data: { imageUrl: null } })
      const changes = buildFieldChanges(group, { imageUrl: null }, ["imageUrl"])
      await writeAdminEditLog(tx, {
        adminId: auth.userId,
        adminName: auth.session.username || null,
        action: "delete-cover",
        targetType: "group",
        targetId: id,
        targetLabel: group.title,
        groupId: id,
        groupTitle: group.title,
        changes: Object.keys(changes).length ? changes : null,
        ip: getRequestIp(request),
      })
    })
  } catch (error) {
    console.error("封面移除入库失败:", error)
    return errorJson("封面移除失败", 500)
  }

  return NextResponse.json({ success: true, data: { imageUrl: null } })
}
