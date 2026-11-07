// 封面图片的公共处理（上传 / 选用候选封面共用）
//
// 约定：封面统一转成 JPG 存到 COVERS_DIR（默认 /home/gxwtf/gxexercise-data/covers），
// 文件名 `<groupId>.jpg`，由 /api/covers/[id] 每次读盘返回（换图即时生效，不用重启）。
// 转换用系统 ImageMagick（/usr/bin/convert，本项目没装 sharp），流程：
//   原图落 tmp → convert 转成 COVERS_DIR 下临时 jpg → rename 覆盖正式文件
// 先临时文件再原子 rename，转换失败时旧封面不会被截断成半张图。

import { execFile } from "node:child_process"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)

export const CONVERT_BIN = "/usr/bin/convert"
export const MAX_COVER_BYTES = 8 * 1024 * 1024
/** 与 /api/covers/[id] 保持一致：id 只允许字母数字下划线连字符，杜绝路径穿越到 COVERS_DIR 之外 */
export const COVER_ID_RE = /^[A-Za-z0-9_-]{6,64}$/
/** 只收这三种：ImageMagick 都吃得下，转出来的 jpg 也稳 */
export const ALLOWED_COVER_MIME = new Set(["image/jpeg", "image/png", "image/webp"])

export type ImageKind = "jpeg" | "png" | "webp"

/** 封面目录（生产是自托管目录，可用 COVERS_DIR 覆盖） */
export function coversDir(): string {
  return process.env.COVERS_DIR || "/home/gxwtf/gxexercise-data/covers"
}

/**
 * 魔数嗅探：不信 Content-Type，直接看文件头。
 * 否则把 .php / .svg 改名成 .jpg 再伪造 MIME 就能骗过校验。
 */
export function sniffImageKind(buf: Buffer): ImageKind | null {
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

export const KIND_EXT: Record<ImageKind, string> = { jpeg: ".jpg", png: ".png", webp: ".webp" }
export const MIME_KIND: Record<string, ImageKind> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
}

/**
 * 把一张图片（任意受支持格式）转成 JPG 并原子写入 `<COVERS_DIR>/<id>.jpg`。
 * 失败时抛错（调用方负责返回 500），并清理临时文件。
 */
export async function writeCoverJpg(id: string, buffer: Buffer): Promise<void> {
  const kind = sniffImageKind(buffer)
  if (!kind) throw new Error("unsupported image kind")

  const dir = coversDir()
  // 原图落临时文件（convert 需要真实路径，不读 stdin 更方便排错）
  const tmpInput = path.join(os.tmpdir(), `gxcover-${id}-${process.pid}-${Date.now()}${KIND_EXT[kind]}`)
  // 同目录临时输出：rename 在同一个文件系统内是原子的
  const tmpOutput = path.join(dir, `.${id}-${process.pid}-${Date.now()}.tmp.jpg`)
  const targetFile = path.join(dir, `${id}.jpg`)

  try {
    await fs.writeFile(tmpInput, buffer)
    await fs.mkdir(dir, { recursive: true })
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
    await fs.rm(tmpOutput, { force: true })
    throw error
  } finally {
    await fs.rm(tmpInput, { force: true })
  }
}

/** 封面文件路径（删除时用） */
export function coverFilePath(id: string): string {
  return path.join(coversDir(), `${id}.jpg`)
}

/**
 * 候选封面的来源域名白名单。
 * 候选清单来自本地生成脚本（pixabay / wikimedia），这里只做纵深防御：
 * 即使缓存文件被改，也不会让服务端去请求任意内网/外部地址（SSRF）。
 */
const REMOTE_HOST_ALLOWLIST = new Set(["pixabay.com", "cdn.pixabay.com", "upload.wikimedia.org"])

export interface RemoteImage {
  buffer: Buffer
  mime: string
}

/**
 * 下载候选封面图片：只允许 https + 白名单域名 + ≤8MB，15 秒超时。
 * 返回图片字节（格式校验交给 writeCoverJpg / sniffImageKind）。
 */
export async function fetchRemoteCoverImage(rawUrl: string): Promise<RemoteImage> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error("候选封面地址不合法")
  }
  if (url.protocol !== "https:") throw new Error("候选封面必须是 https 地址")
  if (!REMOTE_HOST_ALLOWLIST.has(url.hostname.toLowerCase())) {
    throw new Error(`候选封面域名不在白名单内：${url.hostname}`)
  }

  let response: Response
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "gxexercise-admin-cover-picker/1.0" },
    })
  } catch {
    // 源站不可达 / 超时（实测本机直连 upload.wikimedia.org 会超时）
    throw new Error("下载候选封面超时或网络不可达，请换一张试试")
  }
  if (!response.ok) throw new Error(`下载候选封面失败（HTTP ${response.status}），请换一张试试`)

  const mime = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
  if (!ALLOWED_COVER_MIME.has(mime)) throw new Error(`候选封面格式不支持：${mime || "未知"}`)

  const declaredLength = Number(response.headers.get("content-length") || 0)
  if (declaredLength > MAX_COVER_BYTES) throw new Error("候选封面超过 8MB")

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength === 0) throw new Error("候选封面内容为空")
  if (buffer.byteLength > MAX_COVER_BYTES) throw new Error("候选封面超过 8MB")

  return { buffer, mime }
}
