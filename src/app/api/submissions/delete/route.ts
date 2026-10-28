import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { DELETE_BATCH_LIMIT, deleteSubmissionRecords, parseDeleteTargets } from "@/lib/submission-delete"

/**
 * 删除作答记录（支持批量）
 * body: { items: [{ kind: "group" | "paper", id }] }
 * 兼容旧的单条写法 { kind, id }
 *
 * - group：单节练习记录；若该节属于某次套卷提交，则整份套卷记录一起删
 * - paper：整份套卷提交（连同其所有小节与题目提交）
 *
 * 只会删除当前登录用户自己的记录。
 */
export async function POST(request: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
  }
  const userId = session.userid

  let body: { items?: unknown; kind?: unknown; id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "请求体解析失败" }, { status: 400 })
  }

  const targets = parseDeleteTargets(body)
  if (targets.length === 0) {
    return NextResponse.json({ success: false, error: "参数不合法" }, { status: 400 })
  }
  if (targets.length > DELETE_BATCH_LIMIT) {
    return NextResponse.json({ success: false, error: `一次最多删除 ${DELETE_BATCH_LIMIT} 条` }, { status: 400 })
  }

  try {
    const deleted = await deleteSubmissionRecords(targets, userId)
    if (deleted.groups === 0 && deleted.papers === 0) {
      return NextResponse.json({ success: false, error: "记录不存在或无权删除" }, { status: 404 })
    }
    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    console.error("删除作答记录失败:", error)
    return NextResponse.json({ success: false, error: "删除失败" }, { status: 500 })
  }
}
