// 管理后台（/admin/**）的服务端权限校验
//
// 注意：只在 layout 里做校验**不够** —— App Router 会并行渲染同一路由的 page 与 layout，
// page 里的数据库查询仍会执行，结果也会进入 RSC 载荷（curl 就能拿到）。
// 所以 layout 与 page **都必须**调用这里，page 在未通过校验时不得再查库。

import { cookies } from "next/headers"
import { getIronSession, type IronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"

export type AdminViewer =
  | { ok: true; session: IronSession<SessionData> }
  | { ok: false; reason: "anonymous" | "forbidden" }

/** 读取当前访客并判断是否管理员；不写 cookie、不查库。 */
export async function getAdminViewer(): Promise<AdminViewer> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) return { ok: false, reason: "anonymous" }
  if (!session.admin) return { ok: false, reason: "forbidden" }
  return { ok: true, session }
}
