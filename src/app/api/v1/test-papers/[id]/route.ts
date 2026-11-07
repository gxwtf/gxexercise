// GET /api/v1/test-papers/<id> —— 套卷结构（按顺序展开题组与单题，含答案解析）
//
// 返回 items: [{ orderIndex, itemType: "group" | "question", group?/question? }]
// 题组内再给 questions（含 orderIndex），方便直接渲染整卷。

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiKey } from "@/lib/api-key"
import { serializeGroupDetail, serializeQuestion, serverError } from "@/lib/api-v1"

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
    const paper = await prisma.testPaper.findUnique({
      where: { id },
      include: { paperItems: { orderBy: { orderIndex: "asc" } } },
    })

    if (!paper) {
      return NextResponse.json(
        { success: false, error: "套卷不存在" },
        { status: 404 },
      )
    }

    const groupIds = paper.paperItems
      .filter((item) => item.itemType === "group")
      .map((item) => item.itemId)
    const questionIds = paper.paperItems
      .filter((item) => item.itemType === "question")
      .map((item) => item.itemId)

    const [groups, questions] = await Promise.all([
      groupIds.length
        ? prisma.questionGroup.findMany({
            where: { id: { in: groupIds } },
            include: {
              groupItems: {
                include: { question: true },
                orderBy: { orderIndex: "asc" },
              },
            },
          })
        : Promise.resolve([]),
      questionIds.length
        ? prisma.question.findMany({ where: { id: { in: questionIds } } })
        : Promise.resolve([]),
    ])

    const groupMap = new Map(groups.map((group) => [group.id, group]))
    const questionMap = new Map(questions.map((question) => [question.id, question]))

    const items = paper.paperItems.map((item) => {
      if (item.itemType === "group") {
        const group = groupMap.get(item.itemId)
        return {
          orderIndex: item.orderIndex,
          itemType: "group" as const,
          group: group ? serializeGroupDetail(group) : null,
        }
      }
      const question = questionMap.get(item.itemId)
      return {
        orderIndex: item.orderIndex,
        itemType: "question" as const,
        question: question ? serializeQuestion(question) : null,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: paper.id,
        title: paper.title,
        description: paper.description ?? null,
        subject: paper.subject,
        source: paper.source,
        grade: paper.grade ?? null,
        year: paper.year ?? null,
        totalScore: paper.totalScore ?? null,
        duration: paper.duration ?? null,
        tags: paper.tags ?? [],
        itemCount: paper.paperItems.length,
        items,
      },
    })
  } catch (error) {
    return serverError("test-papers/[id]", error)
  }
}
