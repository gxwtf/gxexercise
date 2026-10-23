/**
 * 读取图片像素尺寸（只覆盖题库素材里的 PNG / JPEG / GIF，够用即可）
 *
 * 用途：LibreOffice 的 HTML 导入会忽略 img 的 CSS 宽高，只认 width/height 属性，
 * 所以生成打印稿时要按原图像素算出一个合适的显示尺寸，否则一张 350×293 的插图
 * 会按 350pt 印出来、把整页占满。
 */
import { readFileSync } from "node:fs"

export interface ImageSize {
  width: number
  height: number
}

const cache = new Map<string, ImageSize | null>()

function parsePng(buf: Buffer): ImageSize | null {
  // 89 50 4E 47 0D 0A 1A 0A | len(4) | IHDR | width(4) height(4)
  if (buf.length < 24) return null
  if (buf.readUInt32BE(0) !== 0x89504e47) return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function parseGif(buf: Buffer): ImageSize | null {
  if (buf.length < 10) return null
  if (buf.toString("ascii", 0, 3) !== "GIF") return null
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
}

function parseJpeg(buf: Buffer): ImageSize | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let offset = 2
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = buf[offset + 1]
    // SOF0-SOF15（C4/C8/CC 不是 SOF）
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) }
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    if (offset + 3 >= buf.length) break
    offset += 2 + buf.readUInt16BE(offset + 2)
  }
  return null
}

/** 读取本地图片尺寸；读不到（或不是本地文件）返回 null */
export function readImageSize(filePath: string): ImageSize | null {
  if (cache.has(filePath)) return cache.get(filePath) ?? null
  let size: ImageSize | null = null
  try {
    const buf = readFileSync(filePath)
    size = parsePng(buf) ?? parseJpeg(buf) ?? parseGif(buf)
  } catch {
    size = null
  }
  cache.set(filePath, size)
  return size
}
