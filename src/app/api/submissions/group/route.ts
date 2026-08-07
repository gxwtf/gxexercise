import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { gradeReadingExpression } from "@/lib/ai-service"

function isSubjectiveQuestion(questionType: string, groupType: string): boolean {
  const combined = `${questionType} ${groupType}`
  if (combined.includes("解答") || combined.includes("阅读表达") || combined.includes("reading-expression") || combined.includes("写作") || combined.includes("en-writing")) return true
  if (groupType === "chinese-reading" && questionType === "text") return true
  return false
}

export async function POST(request: Request) {
  try {
    const { userId, questionGroupId, questionSubmissions, duration } = await request.json();

    const questionGroup = await prisma.questionGroup.findUnique({
      where: { id: questionGroupId },
      include: {
        groupItems: {
          include: {
            question: true
          },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!questionGroup) {
      return NextResponse.json(
        { success: false, error: "QuestionGroup not found" },
        { status: 404 }
      );
    }

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId }
    });

    let totalScore = 0;
    let correctNum = 0;
    const totalNum = questionGroup.groupItems.length;

    const submittedIds = new Set(questionSubmissions.map((s: any) => s.questionId));

    const processedSubmissions = await Promise.all(
      questionSubmissions.map(async (sub: any) => {
        const question = questionGroup.groupItems.find(
          (item) => item.question.id === sub.questionId
        );

        if (!question) {
          return null;
        }

        const userAnswer = sub.content?.answer ?? '';
        const correctAnswer = question.question.answer ?? '';
        const questionScore = question.question.score ?? 0;
        const isSubjective = isSubjectiveQuestion(question.question.questionType, questionGroup.questionType);

        if (isSubjective) {
          if (!userAnswer.trim()) {
            return {
              userId,
              questionId: sub.questionId,
              content: { answer: "" },
              score: 0,
              isCorrect: false,
            };
          }
          return {
            userId,
            questionId: sub.questionId,
            content: { answer: userAnswer },
            score: null,
            isCorrect: null
          };
        }

        if (!userAnswer.trim()) {
          return {
            userId,
            questionId: sub.questionId,
            content: { answer: "" },
            score: 0,
            isCorrect: false,
          };
        }

        const isCorrect = correctAnswer.includes("##")
          ? correctAnswer.split("##").some((ans: string) => ans.trim() === userAnswer.trim())
          : userAnswer === correctAnswer;
        const score = isCorrect ? questionScore : 0;

        if (isCorrect) {
          correctNum++;
        }
        totalScore += score;

        return {
          userId,
          questionId: sub.questionId,
          content: { answer: userAnswer },
          score,
          isCorrect
        };
      })
    );

    const unansweredSubmissions = questionGroup.groupItems
      .filter((item) => !submittedIds.has(item.question.id))
      .map((item) => ({
        userId,
        questionId: item.question.id,
        content: { answer: "" },
        score: 0,
        isCorrect: false,
      }));

    const validSubmissions = [...processedSubmissions.filter((s) => s !== null), ...unansweredSubmissions];
    const isAllCorrect = correctNum === totalNum && totalNum > 0;

    const groupSubmission = await prisma.questionGroupSubmission.create({
      data: {
        userId,
        questionGroupId,
        score: totalScore,
        isCorrect: isAllCorrect,
        correctNum,
        totalNum,
        duration
      }
    });

    if (validSubmissions.length > 0) {
      await prisma.questionSubmission.createMany({
        data: validSubmissions.map((sub: any) => ({
          ...sub,
          groupSubmissionId: groupSubmission.id
        }))
      });
    }

    const isReadingExpression = questionGroup.questionType === "reading-expression" || questionGroup.questionType === "阅读表达";
    if (isReadingExpression) {
      const readingExpressionSubmissions = await prisma.questionSubmission.findMany({
        where: { groupSubmissionId: groupSubmission.id },
        include: {
          question: {
            select: { content: true, answer: true, score: true },
          },
        },
      });

      const itemsSorted = questionGroup.groupItems.sort((a, b) => a.orderIndex - b.orderIndex);
      const firstThreeQuestionIds = new Set(itemsSorted.slice(0, 3).map((item) => item.question.id));

      const toGrade = readingExpressionSubmissions.filter((sub) =>
        firstThreeQuestionIds.has(sub.questionId)
      );

      if (toGrade.length > 0) {
        Promise.all(
          toGrade.map(async (sub) => {
            try {
              const content = sub.content as { answer?: string } | null;
              const userAnswer = content?.answer ?? "";

              if (!userAnswer.trim()) {
                await prisma.questionSubmission.update({
                  where: { id: sub.id },
                  data: { score: 0, isCorrect: false, aiFeedback: { feedback: "未作答" } },
                });
                return;
              }

              const result = await gradeReadingExpression(
                sub.question.content,
                userAnswer,
                sub.question.answer,
                sub.question.score,
              );

              await prisma.questionSubmission.update({
                where: { id: sub.id },
                data: {
                  score: result.score,
                  isCorrect: result.score === sub.question.score,
                  aiFeedback: result.feedback ? { feedback: result.feedback } : undefined,
                },
              });
            } catch (error) {
              console.error(`AI grading failed for submission ${sub.id}:`, error);
            }
          })
        ).catch((error) => {
          console.error("AI grading batch failed:", error);
        });
      }
    }

    return NextResponse.json({
      success: true,
      submissionId: groupSubmission.id
    });
  } catch (error) {
    console.error("Error creating submission:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create submission" },
      { status: 500 }
    );
  }
}