import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const questionIds = searchParams.get("questionIds");

    if (!questionIds) {
      return NextResponse.json(
        { success: false, error: "Missing questionIds" },
        { status: 400 }
      );
    }

    const ids = questionIds.split(",");

    const [totalStats, correctStats] = await Promise.all([
      prisma.questionSubmission.groupBy({
        by: ["questionId"],
        where: {
          questionId: { in: ids },
          isCorrect: { not: null },
        },
        _count: { id: true },
        _avg: { score: true },
      }),
      prisma.questionSubmission.groupBy({
        by: ["questionId"],
        where: {
          questionId: { in: ids },
          isCorrect: true,
        },
        _count: { id: true },
      }),
    ]);

    const correctMap: Record<string, number> = {};
    for (const row of correctStats) {
      correctMap[row.questionId] = row._count.id;
    }

    const stats: Record<string, { correctRate: number; avgScore: number; totalSubmissions: number }> = {};

    for (const row of totalStats) {
      const total = row._count.id;
      const correct = correctMap[row.questionId] || 0;
      stats[row.questionId] = {
        correctRate: total > 0 ? Math.round((correct / total) * 100) / 100 : 0,
        avgScore: row._avg.score ? Math.round(row._avg.score * 100) / 100 : 0,
        totalSubmissions: total,
      };
    }

    for (const id of ids) {
      if (!stats[id]) {
        stats[id] = { correctRate: 0, avgScore: 0, totalSubmissions: 0 };
      }
    }

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching question stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch question stats" },
      { status: 500 }
    );
  }
}