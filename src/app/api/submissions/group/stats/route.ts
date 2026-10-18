import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/api-auth";

export async function GET(request: Request) {
  // 身份取自会话，不再接受 query 里的 userId
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  try {
    const { searchParams } = new URL(request.url);
    const groupIds = searchParams.get('groupIds');

    if (!groupIds) {
      return NextResponse.json(
        { success: false, error: "Missing groupIds" },
        { status: 400 }
      );
    }

    const groupIdArray = groupIds.split(',');

    const submissions = await prisma.questionGroupSubmission.findMany({
      where: {
        userId: userId,
        questionGroupId: { in: groupIdArray }
      },
      select: {
        questionGroupId: true,
        correctNum: true,
        totalNum: true,
        score: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const stats: Record<string, { correctNum: number; totalNum: number; score: number | null; lastAttempt: Date }> = {};
    
    for (const sub of submissions) {
      if (!stats[sub.questionGroupId]) {
        stats[sub.questionGroupId] = {
          correctNum: sub.correctNum || 0,
          totalNum: sub.totalNum || 0,
          score: sub.score,
          lastAttempt: sub.createdAt
        };
      }
    }

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching submission stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch submission stats" },
      { status: 500 }
    );
  }
}