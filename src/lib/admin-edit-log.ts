// 题库编辑审计日志（管理员改题存档）
//
// 需求：管理员在「题库管理」里改了哪个题组 / 哪道小题的什么字段，要能事后查得到。
// 日志写进独立表 AdminEditLog（不建外键），与业务更新放在同一个事务里，保证「改了必有记录」。
//
// 字段级 diff 的形状（存进 `changes` Json 列）：
//   { title: { before: "旧标题", after: "新标题" },
//     content: { before: "前 800 字…", after: "前 800 字…", beforeLength: 12345, afterLength: 12345 } }
// 正文 / 选项这类长字段只留预览，长度单独记，避免日志表被题干撑爆。

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"

/** 改动动作 */
export type AdminEditAction = "update-group" | "update-question" | "upload-cover" | "delete-cover"

/** 改动对象类型 */
export type AdminEditTargetType = "group" | "question"

/** 单个字段的改动（before/after 都是展示用字符串；null 表示该字段原本为空 / 被清空） */
export interface FieldChange {
  before: string | null
  after: string | null
  /** 仅长文本字段才有：改动前的原始长度（字符数） */
  beforeLength?: number
  /** 仅长文本字段才有：改动后的原始长度（字符数） */
  afterLength?: number
}

export type FieldChanges = Record<string, FieldChange>

/** diff 里每个字段最多保留的字符数 */
export const CHANGE_PREVIEW_MAX = 800
/** targetLabel 的最大长度（与 schema 的 VarChar(255) 对齐） */
export const TARGET_LABEL_MAX = 255

/** 把一个字段值转成「日志里能存、界面上能读」的字符串预览 */
function toPreview(value: unknown): { text: string | null; length: number } {
  if (value === null || value === undefined) return { text: null, length: 0 }
  if (Array.isArray(value) || typeof value === "object") {
    const json = JSON.stringify(value)
    return { text: json.length > CHANGE_PREVIEW_MAX ? `${json.slice(0, CHANGE_PREVIEW_MAX)}…` : json, length: json.length }
  }
  const text = String(value)
  return { text: text.length > CHANGE_PREVIEW_MAX ? `${text.slice(0, CHANGE_PREVIEW_MAX)}…` : text, length: text.length }
}

/**
 * 比较改动前后的对象，只收集真正变了的字段。
 * @param before 改动前的完整记录（Prisma 查出来的）
 * @param after  改动后的部分字段（请求体里通过校验的部分）
 * @param fields 允许记录的字段白名单（顺序即界面展示顺序）
 */
export function buildFieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
): FieldChanges {
  const changes: FieldChanges = {}
  for (const field of fields) {
    if (!(field in after)) continue
    const prev = toPreview(before[field])
    const next = toPreview(after[field])
    if (prev.text === next.text && prev.length === next.length) continue
    const entry: FieldChange = { before: prev.text, after: next.text }
    // 长字段补长度，方便看出「只改了一个字」还是「整段重写」
    if (prev.length > CHANGE_PREVIEW_MAX || next.length > CHANGE_PREVIEW_MAX) {
      entry.beforeLength = prev.length
      entry.afterLength = next.length
    }
    changes[field] = entry
  }
  return changes
}

/** 这次改动涉及的字段名（界面上展示成 Badge 用） */
export function changedFields(changes: FieldChanges | null | undefined): string[] {
  return changes ? Object.keys(changes) : []
}

/** 从请求头取真实客户端 IP（nginx 已按真实 IP 架构写死 X-Forwarded-For） */
export function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first.slice(0, 64)
  }
  const realIp = request.headers.get("x-real-ip")?.trim()
  return realIp ? realIp.slice(0, 64) : null
}

/** 截断成符合 schema 限制的字符串 */
export function truncateLabel(text: string, max = TARGET_LABEL_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

export interface AdminEditLogInput {
  /** 管理员 SSO userId */
  adminId: number
  /** 管理员用户名（adminName 允许为空） */
  adminName?: string | null
  action: AdminEditAction
  targetType: AdminEditTargetType
  targetId: string
  /** 题组标题 / 小题题干摘要 */
  targetLabel: string
  groupId?: string | null
  groupTitle?: string | null
  changes?: FieldChanges | null
  ip?: string | null
}

/**
 * 写一条审计日志。
 *
 * 传 Prisma 事务客户端（`tx`）进来，与业务更新同一个事务：
 * 更新成功日志一定落地，更新回滚日志也不会留下幽灵记录。
 */
export async function writeAdminEditLog(
  client: Prisma.TransactionClient | typeof prisma,
  input: AdminEditLogInput,
) {
  return client.adminEditLog.create({
    data: {
      adminId: input.adminId,
      adminName: input.adminName?.slice(0, 100) ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: truncateLabel(input.targetLabel),
      groupId: input.groupId ?? null,
      groupTitle: input.groupTitle ? input.groupTitle.slice(0, 255) : null,
      changes: (input.changes ?? null) as unknown as Prisma.InputJsonValue,
      ip: input.ip ?? null,
    },
  })
}
