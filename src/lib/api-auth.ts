// 统一的 API 鉴权工具（iron-session）
//
// 背景：本项目的 API 路由此前全部没有登录校验，包括会调用 AI 的批改接口，
// 等于把 AI 算力开放给公网；同时提交接口的 userId 直接取自请求体，
// 任何人都能伪造任意用户的提交。统一从这里取身份。

import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { NextResponse } from "next/server";
import { sessionOptions, type SessionData } from "@/lib/iron";

export type AuthResult =
  | { ok: true; session: IronSession<SessionData>; userId: number; isAdmin: boolean }
  | { ok: false; response: NextResponse };

/** 要求已登录。成功时 userId 一定是正整数。 */
export async function requireLogin(): Promise<AuthResult> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const userId = Number(session.userid);
  if (!session.isLoggedIn || !Number.isInteger(userId) || userId <= 0) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "未登录" }, { status: 401 }),
    };
  }
  return { ok: true, session, userId, isAdmin: Boolean(session.admin) };
}

/** 要求已登录且为管理员。 */
export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireLogin();
  if (!auth.ok) return auth;
  if (!auth.isAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "需要管理员权限" }, { status: 403 }),
    };
  }
  return auth;
}
