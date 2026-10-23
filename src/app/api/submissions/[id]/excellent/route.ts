import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLogin } from "@/lib/api-auth"

// 修改「本次作答是否允许作为优秀解答展示给其他同学」
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireLogin()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  let body: { allowed?: unknown } | null = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  if (typeof body?.allowed !== "boolean") {
    return NextResponse.json({ success: false, error: "参数错误" }, { status: 400 })
  }

  const submission = await prisma.questionSubmission.findUnique({
    where: { id },
    select: { id: true, userId: true },
  })

  if (!submission) {
    return NextResponse.json({ success: false, error: "作答不存在" }, { status: 404 })
  }

  // 只能改自己的作答
  if (submission.userId !== auth.userId) {
    return NextResponse.json({ success: false, error: "无权修改" }, { status: 403 })
  }

  const updated = await prisma.questionSubmission.update({
    where: { id },
    data: { shareAsExcellent: body.allowed },
    select: { shareAsExcellent: true },
  })

  return NextResponse.json({ success: true, shareAsExcellent: updated.shareAsExcellent })
}
