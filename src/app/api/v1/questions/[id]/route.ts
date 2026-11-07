// GET /api/v1/questions/<questionGroupId> —— 题组详情（含正文、选项、答案、解析）
//
// 注意：id 是 QuestionGroup 的 id（与 /question/<id> 页面一致），不是单题 id。
// 单题没有独立详情页，只能作为题组的 items 出现。

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiKey } from "@/lib/api-key"
import { serializeGroupDetail, serverError } from "@/lib/api-v1"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  const denied = requireApiKey(request)
  if (denied) return denied

  const { id } = await params

  try {
    const group = await prisma.questionGroup.findUnique({
      where: { id },
      include: {
        groupItems: {
          include: { question: true },
          orderBy: { orderIndex: "asc" },
        },
      },
    })

    if (!group) {
      return NextResponse.json(
        { success: false, error: "题组不存在" },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: serializeGroupDetail(group) })
  } catch (error) {
    return serverError("questions/[id]", error)
  }
}
