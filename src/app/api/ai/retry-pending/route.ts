import { prisma } from "@/lib/prisma";
import { gradeWithConfig, preCheckGrade } from "@/lib/ai-service";
import { getGradingPrompt } from "@/lib/grading-prompts";
import { gradingStem } from "@/lib/grading-stem";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isEssayScoring } from "@/lib/essay-score";
import { buildAiFeedback } from "@/lib/ai-feedback";

/** 语文大作文（chinese-essay）：**不在本接口的批改范围**，见下方 POST 里的注释 */
const ESSAY_GROUP_TYPE = "chinese-essay";

export async function POST() {
  // 此接口会批量触发 AI 批改，属于高成本操作，仅限管理员调用
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    // 这个接口是**同步**批量跑 AI 的管理员按钮（一次请求里串行/并发判完再返回）。
    // 语文大作文单篇要 8.8k prompt tokens、7–12 秒，批量同步必然超过 nginx 的 60s
    // proxy_read_timeout（管理员看到的是 504，实际还在后台烧 token）。所以作文一律排除，
    // 交给后台 Worker（10 秒一轮的队列）处理 —— 它在提交后自己就会跑，不需要管理员点这里。
    const pendingSubmissions = await prisma.questionSubmission.findMany({
      where: {
        gradingStatus: "pending",
        groupSubmission: { questionGroup: { questionType: { not: ESSAY_GROUP_TYPE } } },
      },
      include: {
        question: {
          select: {
            content: true,
            answer: true,
            score: true,
          },
        },
        groupSubmission: {
          select: {
            questionGroup: {
              select: {
                questionType: true,
                // 物理实验题的题面在题组 content 上（单题 content 为空），批改时要用它当 {stem}
                content: true,
                groupItems: {
                  select: { questionId: true },
                  orderBy: { orderIndex: "asc" },
                },
              },
            },
          },
        },
      },
      take: 50,
    });

    if (pendingSubmissions.length === 0) {
      return NextResponse.json({ success: true, graded: 0 });
    }

    let gradedCount = 0;
    let failedCount = 0;
    const affectedGroupIds = new Set<string>();

    await Promise.all(
      pendingSubmissions.map(async (sub) => {
        try {
          const groupItems = sub.groupSubmission?.questionGroup?.groupItems ?? [];
          const idx = groupItems.findIndex((item) => item.questionId === sub.questionId);
          const questionType = sub.groupSubmission?.questionGroup?.questionType ?? "";
          const config = getGradingPrompt(questionType, idx);
          if (!config) return;
          // 双保险：即便题组类型写成别名、SQL 那层没过滤掉，这里也不批作文（原因见上面的查询注释）
          if (isEssayScoring(config.scoring)) return;

          const content = sub.content as { answer?: string } | null;
          const userAnswer = content?.answer ?? "";
          const maxScore = sub.question.score;

          const pre = preCheckGrade(userAnswer, sub.question.answer, maxScore, config.enableExactMatch ?? false);
          if (pre) {
            await prisma.questionSubmission.update({
              where: { id: sub.id },
              data: {
                score: pre.score,
                isCorrect: pre.score === maxScore,
                gradingStatus: "graded",
                aiFeedback: pre.feedback ? { feedback: pre.feedback } : undefined,
              },
            });
            if (sub.groupSubmissionId) affectedGroupIds.add(sub.groupSubmissionId);
            gradedCount++;
            return;
          }

          const result = await gradeWithConfig(
            config,
            gradingStem(questionType, sub.question.content, sub.groupSubmission?.questionGroup?.content ?? ""),
            userAnswer,
            sub.question.answer,
            maxScore,
          );

          await prisma.questionSubmission.update({
            where: { id: sub.id },
            data: {
              score: result.score,
              isCorrect: result.score === maxScore,
              gradingStatus: "graded",
              aiFeedback: buildAiFeedback(result) as any,
            },
          });
          if (sub.groupSubmissionId) affectedGroupIds.add(sub.groupSubmissionId);
          gradedCount++;
        } catch (error) {
          console.error(`Retry grading failed for ${sub.id}:`, error);
          failedCount++;
        }
      })
    );

    for (const gid of affectedGroupIds) {
      try {
        const allSubs = await prisma.questionSubmission.findMany({
          where: { groupSubmissionId: gid },
          select: { score: true, isCorrect: true, gradingStatus: true },
        });
        const newTotalScore = allSubs.reduce((sum, s) => sum + (s.score ?? 0), 0);
        const gradedSubs = allSubs.filter(s => s.gradingStatus === "graded");
        const newCorrectNum = gradedSubs.filter(s => s.isCorrect).length;
        await prisma.questionGroupSubmission.update({
          where: { id: gid },
          data: { score: newTotalScore, correctNum: newCorrectNum },
        });
      } catch (updateError) {
        console.error(`Failed to update group submission ${gid}:`, updateError);
      }
    }

    return NextResponse.json({
      success: true,
      graded: gradedCount,
      failed: failedCount,
      remaining: pendingSubmissions.length - gradedCount,
    });
  } catch (error) {
    console.error("Error in retry-pending:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retry grading" },
      { status: 500 }
    );
  }
}