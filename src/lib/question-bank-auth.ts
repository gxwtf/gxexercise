// 题库管理（/admin/questions/**）的权限校验
//
// 「题库管理」不等于「网站管理员」：
//   网站管理员（SSO session.admin）天然可用；
//   另外维护一份「题库审核名单」（QuestionBankReviewer），名单里的同学也能看、能改题目，
//   但看不到「全部作答记录」等其他管理员页面。
//
// 与 src/lib/admin-guard.ts 一样：page 里必须在查库之前调用，layout 挡住了不代表 page 不执行。

import { cookies } from "next/headers"
import { getIronSession, type IronSession } from "iron-session"
import { NextResponse } from "next/server"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { prisma } from "@/lib/prisma"

export type QuestionBankViewer =
  | {
      ok: true
      session: IronSession<SessionData>
      userId: number
      /** 网站管理员（admin 为真） */
      isAdmin: boolean
      /** 仅在题库审核名单里（非网站管理员） */
      isReviewer: boolean
    }
  | { ok: false; reason: "anonymous" | "forbidden" }

/** 判断某个用户名是否在题库审核名单里（大小写不敏感） */
export async function isQuestionBankReviewer(userName: string | null | undefined): Promise<boolean> {
  const name = (userName ?? "").trim()
  if (!name) return false
  const hit = await prisma.questionBankReviewer.findFirst({
    where: { userName: { equals: name, mode: "insensitive" } },
    select: { id: true },
  })
  return Boolean(hit)
}

/** 读取当前访客是否可管理题库；不写 cookie */
export async function getQuestionBankViewer(): Promise<QuestionBankViewer> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  const userId = Number(session.userid)
  if (!session.isLoggedIn || !Number.isInteger(userId) || userId <= 0) {
    return { ok: false, reason: "anonymous" }
  }
  if (session.admin) {
    return { ok: true, session, userId, isAdmin: true, isReviewer: false }
  }
  const isReviewer = await isQuestionBankReviewer(session.username)
  if (!isReviewer) return { ok: false, reason: "forbidden" }
  return { ok: true, session, userId, isAdmin: false, isReviewer: true }
}

/** API 用：要求「网站管理员 或 题库审核名单成员」 */
export async function requireQuestionBankEditor() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  const userId = Number(session.userid)
  if (!session.isLoggedIn || !Number.isInteger(userId) || userId <= 0) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: "未登录" }, { status: 401 }),
    }
  }
  const isAdmin = Boolean(session.admin)
  if (isAdmin) {
    return { ok: true as const, session, userId, isAdmin: true, isReviewer: false }
  }
  const isReviewer = await isQuestionBankReviewer(session.username)
  if (!isReviewer) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: "需要题库审核权限" }, { status: 403 }),
    }
  }
  return { ok: true as const, session, userId, isAdmin: false, isReviewer: true }
}
