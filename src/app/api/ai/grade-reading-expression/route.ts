import { prisma } from "@/lib/prisma";
import { gradeWithConfig, preCheckGrade } from "@/lib/ai-service";
import { getGradingPrompt } from "@/lib/grading-prompts";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
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
            sub.question.content,
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
              aiFeedback: result.feedback ? { feedback: result.feedback } : undefined,
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