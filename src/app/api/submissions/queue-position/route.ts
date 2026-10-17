import { prisma } from "@/lib/prisma";
import { GRADING_PROMPT_REGISTRY } from "@/lib/grading-prompts";
import { NextResponse } from "next/server";

/**
 * 查询 AI 批改排队位次（与 grading-worker 的队列口径一致：
 * 只看「有批改配置的题型」的 pending，按提交时间先进先出）
 */
export async function GET(request: Request) {
  try {
    const ids = (new URL(request.url).searchParams.get("ids") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    const gradeableTypes = Array.from(new Set(GRADING_PROMPT_REGISTRY.map((p) => p.questionType)));

    const submissions = await prisma.questionSubmission.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        gradingStatus: true,
        createdAt: true,
        groupSubmission: {
          select: { questionGroup: { select: { questionType: true } } },
        },
      },
    });

    const data: Record<string, { pending: boolean; position: number; graded: boolean }> = {};

    for (const sub of submissions) {
      const graded = sub.gradingStatus === "graded";
      const questionType = sub.groupSubmission?.questionGroup?.questionType ?? "";
      const gradeable = gradeableTypes.includes(questionType);

      if (graded || !gradeable) {
        // 已判完，或是不走 AI 批改的题型（客观题提交时已算分）
        data[sub.id] = { pending: false, position: 0, graded };
        continue;
      }

      const ahead = await prisma.questionSubmission.count({
        where: {
          gradingStatus: "pending",
          createdAt: { lt: sub.createdAt },
          groupSubmission: { questionGroup: { questionType: { in: gradeableTypes } } },
        },
      });

      data[sub.id] = { pending: true, position: ahead, graded: false };
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching queue position:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch queue position" }, { status: 500 });
  }
}
