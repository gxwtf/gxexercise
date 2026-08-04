import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

    const validSubmissions = processedSubmissions.filter((s) => s !== null);
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