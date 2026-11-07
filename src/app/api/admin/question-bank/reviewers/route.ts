// 题库审核名单的增删查（仅网站管理员可操作）
//
// 「题库管理」权限 = 网站管理员 或 本名单里的同学；
// 名单按广学账号用户名（SSO session.username）标识，大小写不敏感。

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { getRequestIp, writeAdminEditLog } from "@/lib/admin-edit-log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function errorJson(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status })
}

function normalizeName(value: unknown): string | null {
  const name = typeof value === "string" ? value.trim() : ""
  if (!name) return null
  if (name.length > 100) return null
  return name
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const reviewers = await prisma.questionBankReviewer.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, userName: true, userId: true, grade: true, note: true, createdBy: true, createdAt: true },
  })
  return NextResponse.json({ success: true, data: reviewers })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const adminName = auth.session.username || null

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return errorJson("请求体解析失败", 400)
  }
  const userName = normalizeName(body.userName)
  if (!userName) return errorJson("请填写广学账号用户名（1–100 字）", 400)
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 200) : null
  // 从账号中心搜索结果带过来的 userId / 年级（可选；不传的话等对方登录时自动补齐）
  const userIdRaw = body.userId === undefined || body.userId === null ? null : Number(body.userId)
  if (userIdRaw !== null && (!Number.isInteger(userIdRaw) || userIdRaw <= 0)) {
    return errorJson("userId 不合法", 400)
  }
  const gradeRaw = body.grade === undefined || body.grade === null ? null : Number(body.grade)
  if (gradeRaw !== null && (!Number.isInteger(gradeRaw) || gradeRaw < 7 || gradeRaw > 13)) {
    return errorJson("年级不合法", 400)
  }

  const exists = await prisma.questionBankReviewer.findFirst({
    where: { userName: { equals: userName, mode: "insensitive" } },
    select: { id: true },
  })
  if (exists) return errorJson("该用户名已经在审核名单里", 400)

  const reviewer = await prisma.questionBankReviewer.create({
    data: { userName, userId: userIdRaw, grade: gradeRaw, note, createdBy: adminName },
  })

  try {
    await writeAdminEditLog(prisma, {
      adminId: auth.userId,
      adminName,
      action: "update-reviewer",
      targetType: "reviewer",
      targetId: reviewer.id,
      targetLabel: userName,
      changes: { reviewer: { before: null, after: userName } },
      summary: `加入题库审核名单${note ? `（备注：${note}）` : ""}`,
      ip: getRequestIp(request),
    })
  } catch (error) {
    console.error("记录审核名单变更失败:", error)
  }

  return NextResponse.json({ success: true, data: reviewer })
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const adminName = auth.session.username || null

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return errorJson("请求体解析失败", 400)
  }
  const userName = normalizeName(body.userName)
  if (!userName) return errorJson("请指定要移除的用户名", 400)

  const reviewer = await prisma.questionBankReviewer.findFirst({
    where: { userName: { equals: userName, mode: "insensitive" } },
  })
  if (!reviewer) return errorJson("该用户名不在审核名单里", 404)

  await prisma.questionBankReviewer.delete({ where: { id: reviewer.id } })

  try {
    await writeAdminEditLog(prisma, {
      adminId: auth.userId,
      adminName,
      action: "update-reviewer",
      targetType: "reviewer",
      targetId: reviewer.id,
      targetLabel: reviewer.userName,
      changes: { reviewer: { before: reviewer.userName, after: null } },
      summary: "移出题库审核名单",
      ip: getRequestIp(request),
    })
  } catch (error) {
    console.error("记录审核名单变更失败:", error)
  }

  return NextResponse.json({ success: true })
}
