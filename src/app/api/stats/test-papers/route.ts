import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const testPaperIds = searchParams.get("testPaperIds");

    if (!testPaperIds) {
      return NextResponse.json(
        { success: false, error: "Missing testPaperIds" },
        { status: 400 }
      );
    }

    const ids = testPaperIds.split(",");

    const stats = await prisma.testPaperSubmission.groupBy({
      by: ["testPaperId"],
      where: {
        testPaperId: { in: ids },
      },
      _count: { id: true },
      _avg: { score: true },
    });

    const result: Record<string, { avgScore: number; totalSubmissions: number }> = {};

    for (const row of stats) {
      result[row.testPaperId] = {
        avgScore: row._avg.score ? Math.round(row._avg.score * 100) / 100 : 0,
        totalSubmissions: row._count.id,
      };
    }

    for (const id of ids) {
      if (!result[id]) {
        result[id] = { avgScore: 0, totalSubmissions: 0 };
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching test paper stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch test paper stats" },
      { status: 500 }
    );
  }
}