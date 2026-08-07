import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const groupIds = searchParams.get('groupIds');

    if (!userId || !groupIds) {
      return NextResponse.json(
        { success: false, error: "Missing userId or groupIds" },
        { status: 400 }
      );
    }

    const groupIdArray = groupIds.split(',');

    const submissions = await prisma.questionGroupSubmission.findMany({
      where: {
        userId: parseInt(userId),
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