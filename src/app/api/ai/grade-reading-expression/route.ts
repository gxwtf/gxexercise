import { prisma } from "@/lib/prisma";
import { gradeWithConfig, preCheckGrade, type GradeResult } from "@/lib/ai-service";
import { getGradingPrompt } from "@/lib/grading-prompts";
import { gradingStem } from "@/lib/grading-stem";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

/** 落库用的 AI 反馈（不包含 raw，那是算分用的中间数据） */
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

export async function POST(request: Request) {
  // 此接口会并发触发多条 AI 批改，属于高成本操作，仅限管理员调用
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { submissionIds } = await request.json();

    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "submissionIds is required" },
        { status: 400 }
      );
    }

    const submissions = await prisma.questionSubmission.findMany({
      where: { id: { in: submissionIds } },
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
    });

    const results = await Promise.all(
      submissions.map(async (sub) => {
        try {
          const content = sub.content as { answer?: string } | null;
          const userAnswer = content?.answer ?? "";
          const correctAnswer = sub.question.answer;
          const maxScore = sub.question.score;

          const groupItems = sub.groupSubmission?.questionGroup?.groupItems ?? [];
          const idx = groupItems.findIndex((item) => item.questionId === sub.questionId);
          const questionType = sub.groupSubmission?.questionGroup?.questionType ?? "";
          const config = getGradingPrompt(questionType, idx);
          if (!config) {
            return { id: sub.id, error: "No grading prompt configured", status: "pending" };
          }

          const pre = preCheckGrade(userAnswer, correctAnswer, maxScore, config.enableExactMatch ?? false);
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
            return { id: sub.id, score: pre.score, feedback: pre.feedback, status: "graded" };
          }

          const result = await gradeWithConfig(
            config,
            gradingStem(questionType, sub.question.content, sub.groupSubmission?.questionGroup?.content ?? ""),
            userAnswer,
            correctAnswer,
            maxScore,
          );

          await prisma.questionSubmission.update({
            where: { id: sub.id },
            data: {
              score: result.score,
              isCorrect: result.score === maxScore,
              gradingStatus: "graded",
              // 43（三维度）要带 subScores，否则回顾页/报告里没有「内容/语言/结构」明细
              aiFeedback: buildAiFeedback(result) as any,
            },
          });

          return { id: sub.id, score: result.score, feedback: result.feedback, status: "graded" };
        } catch (error) {
          console.error(`Failed to grade submission ${sub.id}:`, error);
          return { id: sub.id, error: "Failed to grade", status: "pending" };
        }
      })
    );

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Error in grade-reading-expression:", error);
    return NextResponse.json(
      { success: false, error: "Failed to grade" },
      { status: 500 }
    );
  }
}