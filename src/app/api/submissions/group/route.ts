import { prisma } from "@/lib/prisma"
import { isAnswerCorrect, isCaseSensitiveAnswer } from "@/lib/answer-check"
import { NextResponse } from "next/server"
import { requireLogin } from "@/lib/api-auth"
import { isSubjectiveQuestion, isUngradedQuestion } from "@/lib/excellent-answer-rules"

export async function POST(request: Request) {
  // 身份一律取自登录会话，绝不信任请求体里的 userId
  const auth = await requireLogin()
  if (!auth.ok) return auth.response
  const userId = auth.userId

  try {
    const { questionGroupId, questionSubmissions, duration } = await request.json();

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

    const userName = auth.session.username?.trim() || null;
    await prisma.user.upsert({
      where: { id: userId },
      update: userName ? { userName } : {},
      create: { id: userId, userName }
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

        if (isUngradedQuestion(questionGroup.questionType)) {
          return {
            userId,
            questionId: sub.questionId,
            content: { answer: userAnswer },
            score: null,
            isCorrect: null,
            gradingStatus: "skipped",
          };
        }

        if (isSubjective) {
          if (!userAnswer.trim()) {
            return {
              userId,
              questionId: sub.questionId,
              content: { answer: "" },
              score: 0,
              isCorrect: false,
              gradingStatus: "graded",
            };
          }
          return {
            userId,
            questionId: sub.questionId,
            content: { answer: userAnswer },
            score: null,
            isCorrect: null,
            gradingStatus: "pending",
          };
        }

        if (!userAnswer.trim()) {
          return {
            userId,
            questionId: sub.questionId,
            content: { answer: "" },
            score: 0,
            isCorrect: false,
            gradingStatus: "graded",
          };
        }

        // 语法填空 / 选词填空的答案是单词，大小写有意义，判分不能忽略大小写
        const isCorrect = isAnswerCorrect(userAnswer, correctAnswer, {
          caseSensitive: isCaseSensitiveAnswer(
            question.question.questionType,
            questionGroup.questionType,
            correctAnswer,
          ),
        });
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
        score: isUngradedQuestion(questionGroup.questionType) ? null : 0,
        isCorrect: isUngradedQuestion(questionGroup.questionType) ? null : false,
        gradingStatus: isUngradedQuestion(questionGroup.questionType) ? "skipped" : "graded",
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
          groupSubmissionId: groupSubmission.id,
          // 提交时默认允许计入优秀解答，回顾页可逐次修改
          shareAsExcellent: true
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