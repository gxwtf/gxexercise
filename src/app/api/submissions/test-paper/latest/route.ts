import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const testPaperIds = searchParams.get("testPaperIds")?.split(",") || []

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    const submissions = await prisma.testPaperSubmission.findMany({
      where: {
        userId: parseInt(userId),
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