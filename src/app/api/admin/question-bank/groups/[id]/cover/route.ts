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
//   3) 转换与落盘交给 src/lib/cover-image.ts（临时文件 + 原子 rename），与「选用候选封面」共用
//   4) 事务内更新 imageUrl + 写审计日志；文件写入在事务外（文件系统没有回滚）
import { promises as fs } from "node:fs"
import { NextResponse } from "next/server"
import { requireQuestionBankEditor } from "@/lib/question-bank-auth"
import { prisma } from "@/lib/prisma"
import { buildFieldChanges, getRequestIp, writeAdminEditLog } from "@/lib/admin-edit-log"
import {
  ALLOWED_COVER_MIME,
  COVER_ID_RE,
  MIME_KIND,
  MAX_COVER_BYTES,
  coverFilePath,
  sniffImageKind,
  writeCoverJpg,
} from "@/lib/cover-image"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function errorJson(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireQuestionBankEditor()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!COVER_ID_RE.test(id)) return errorJson("题组不存在", 404)

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
  if (file.size > MAX_COVER_BYTES) return errorJson("图片不能超过 8MB", 400)

  const declaredMime = (file.type || "").toLowerCase()
  if (!ALLOWED_COVER_MIME.has(declaredMime)) return errorJson("只支持 JPG / PNG / WebP 图片", 400)

  const buffer = Buffer.from(await file.arrayBuffer())
  const kind = sniffImageKind(buffer)
  if (!kind) return errorJson("只支持 JPG / PNG / WebP 图片", 400)
  if (MIME_KIND[declaredMime] !== kind) return errorJson("图片实际格式与声明的类型不一致", 400)

  try {
    await writeCoverJpg(id, buffer)
  } catch (error) {
    console.error("封面转换失败:", error)
    return errorJson("图片转换失败，请换一张图片重试", 500)
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
        summary: "上传本地图片",
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
  const auth = await requireQuestionBankEditor()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!COVER_ID_RE.test(id)) return errorJson("题组不存在", 404)

  const group = await prisma.questionGroup.findUnique({ where: { id }, select: { id: true, title: true, imageUrl: true } })
  if (!group) return errorJson("题组不存在", 404)

  // 先删文件再改库：文件不存在不算错（外链封面本就没有本地文件）
  try {
    await fs.rm(coverFilePath(id), { force: true })
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
        summary: "移除封面",
        ip: getRequestIp(request),
      })
    })
  } catch (error) {
    console.error("封面移除入库失败:", error)
    return errorJson("封面移除失败", 500)
  }

  return NextResponse.json({ success: true, data: { imageUrl: null } })
}
