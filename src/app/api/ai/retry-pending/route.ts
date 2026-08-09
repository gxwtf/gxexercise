import { prisma } from "@/lib/prisma";
import { gradeWithConfig, preCheckGrade, type GradeResult } from "@/lib/ai-service";
import { getGradingPrompt } from "@/lib/grading-prompts";
import { NextResponse } from "next/server";

function buildAiFeedback(result: GradeResult): Record<string, unknown> | undefined {
  const data: Record<string, unknown> = {}
  if (result.feedback) data.feedback = result.feedback
  if (result.subScores) data.subScores = result.subScores
  if (result.overallComment) data.overallComment = result.overallComment
  if (result.lineCorrections) data.lineCorrections = result.lineCorrections
  if (result.betterExpressions) data.betterExpressions = result.betterExpressions
  if (result.modelEssay) data.modelEssay = result.modelEssay
  return Object.keys(data).length > 0 ? data : undefined
}

export async function POST() {
  try {
    const pendingSubmissions = await prisma.questionSubmission.findMany({
      where: { gradingStatus: "pending" },
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
            sub.question.content,
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