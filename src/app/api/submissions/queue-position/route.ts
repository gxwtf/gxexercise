import { prisma } from "@/lib/prisma";
import { GRADING_PROMPT_REGISTRY } from "@/lib/grading-prompts";
import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/api-auth";

/**
 * 查询 AI 批改排队位次（与 grading-worker 的队列口径一致：
 * 只看「有批改配置的题型」的 pending，按提交时间先进先出）
 */
export async function GET(request: Request) {
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

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
      // 限定本人提交，避免用别人的 submissionId 探测批改状态
      where: { id: { in: ids }, userId: userId },
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

      // 同一次提交里的多个空 createdAt 可能相同，用 id 做二级排序（cuid 近似时间有序），
      // 否则同一批提交会全部显示「正在批改」（position=0）
      const ahead = await prisma.questionSubmission.count({
        where: {
          gradingStatus: "pending",
          groupSubmission: { questionGroup: { questionType: { in: gradeableTypes } } },
          OR: [
            { createdAt: { lt: sub.createdAt } },
            { createdAt: sub.createdAt, id: { lt: sub.id } },
          ],
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
