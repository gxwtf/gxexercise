import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupIds = searchParams.get("groupIds");
    const testPaperIds = searchParams.get("testPaperIds");

    const result: { groups?: Record<string, number>; testPapers?: Record<string, number> } = {};

    const promises: Promise<void>[] = [];

    if (groupIds) {
      const ids = groupIds.split(",");
      promises.push(
        prisma.questionGroupSubmission
          .groupBy({
            by: ["questionGroupId"],
            where: { questionGroupId: { in: ids } },
            _count: { id: true },
          })
          .then((rows) => {
            const groups: Record<string, number> = {};
            for (const id of ids) groups[id] = 0;
            for (const row of rows) groups[row.questionGroupId] = row._count.id;
            result.groups = groups;
          })
      );
    }

    if (testPaperIds) {
      const ids = testPaperIds.split(",");
      promises.push(
        prisma.testPaperSubmission
          .groupBy({
            by: ["testPaperId"],
            where: { testPaperId: { in: ids } },
            _count: { id: true },
          })
          .then((rows) => {
            const testPapers: Record<string, number> = {};
            for (const id of ids) testPapers[id] = 0;
            for (const row of rows) testPapers[row.testPaperId] = row._count.id;
            result.testPapers = testPapers;
          })
      );
    }

    await Promise.all(promises);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching submission counts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch submission counts" },
      { status: 500 }
    );
  }
}