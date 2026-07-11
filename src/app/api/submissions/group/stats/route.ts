import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const groupIds = searchParams.get("groupIds");

    if (!groupIds) {
      return NextResponse.json(
        { success: false, error: "Missing groupIds" },
        { status: 400 },
      );
    }

    const groupIdArray = [...new Set(
      groupIds
        .split(",")
        .map((groupId) => groupId.trim())
        .filter(Boolean),
    )];

    if (
      groupIdArray.length === 0 ||
      groupIdArray.length > 100 ||
      groupIdArray.some((groupId) => groupId.length > 255)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid groupIds" },
        { status: 400 },
      );
    }

    const submissions = await prisma.questionGroupSubmission.findMany({
      where: {
        userId,
        questionGroupId: { in: groupIdArray },
      },
      select: {
        questionGroupId: true,
        correctNum: true,
        totalNum: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const stats: Record<string, { correctNum: number; totalNum: number; lastAttempt: Date }> = {};

    for (const sub of submissions) {
      if (!stats[sub.questionGroupId]) {
        stats[sub.questionGroupId] = {
          correctNum: sub.correctNum || 0,
          totalNum: sub.totalNum || 0,
          lastAttempt: sub.createdAt,
        };
      }
    }

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching submission stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch submission stats" },
      { status: 500 },
    );
  }
}
