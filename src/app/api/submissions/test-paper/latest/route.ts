import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { requireLogin } from "@/lib/api-auth"

export async function GET(request: Request) {
  // 身份取自会话，不再接受 query 里的 userId（否则可越权读他人记录）
  const auth = await requireLogin()
  if (!auth.ok) return auth.response
  const userId = auth.userId

  try {
    const { searchParams } = new URL(request.url)
    const testPaperIds = searchParams.get("testPaperIds")?.split(",") || []

    const submissions = await prisma.testPaperSubmission.findMany({
      where: {
        userId: userId,
        testPaperId: testPaperIds.length > 0 ? { in: testPaperIds } : undefined,
      },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        testPaperId: true,
        submittedAt: true,
      },
    })

    const latestMap: Record<string, string> = {}
    for (const sub of submissions) {
      if (!latestMap[sub.testPaperId]) {
        latestMap[sub.testPaperId] = sub.id
      }
    }

    return NextResponse.json(latestMap)
  } catch (error) {
    console.error("Latest submissions error:", error)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}