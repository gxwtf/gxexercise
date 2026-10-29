import { prisma } from "@/lib/prisma"
import { isAnswerCorrect, isCaseSensitiveAnswer } from "@/lib/answer-check"
import { NextResponse } from "next/server"
import { requireLogin } from "@/lib/api-auth"
import { isSubjectiveQuestion, isUngradedQuestion, isImageAnswer } from "@/lib/excellent-answer-rules"

export async function POST(request: Request) {
  // 身份一律取自登录会话，绝不信任请求体里的 userId
  const auth = await requireLogin()
  if (!auth.ok) return auth.response
  const userId = auth.userId

  try {
    const body = await request.json()
    const { testPaperId, duration, groupSubmissions } = body as {
      userId?: number
      testPaperId: string
      duration: number
      groupSubmissions: Array<{
        questionGroupId: string
        duration: number
        questionSubmissions: Array<{
          questionId: string
          content: { answer?: string }
        }>
      }>
    }

    if (!testPaperId || !groupSubmissions) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const userName = auth.session.username?.trim() || null
    await prisma.user.upsert({
      where: { id: userId },
      update: userName ? { userName } : {},
      create: { id: userId, userName },
    })

    const testPaper = await prisma.testPaper.findUnique({
      where: { id: testPaperId },
    })

    if (!testPaper) {
      return NextResponse.json({ error: "Test paper not found" }, { status: 404 })
    }

    let totalScore = 0
    let totalCorrectNum = 0
    let totalTotalNum = 0

    const testPaperSubmission = await prisma.testPaperSubmission.create({
      data: {
        userId,
        testPaperId,
        score: 0,
        duration,
        startedAt: new Date(Date.now() - duration * 1000),
        submittedAt: new Date(),
      },
    })

    const groupSubmissionsCreated = await Promise.all(
      groupSubmissions.map(async (groupSub) => {
        const questionGroup = await prisma.questionGroup.findUnique({
          where: { id: groupSub.questionGroupId },
          include: {
            groupItems: {
              include: { question: true },
            },
          },
        })

        if (!questionGroup) return null

        let groupCorrectNum = 0
        let groupTotalNum = questionGroup.groupItems.length
        let groupScore = 0

        const submittedIds = new Set(groupSub.questionSubmissions.map((s) => s.questionId))

        const processedSubmissions = await Promise.all(
          groupSub.questionSubmissions.map(async (sub) => {
            const question = questionGroup.groupItems.find(
              (item) => item.question.id === sub.questionId
            )

            if (!question) return null

            const userAnswer = sub.content?.answer ?? ""
            const correctAnswer = question.question.answer ?? ""
            const questionScore = question.question.score ?? 0
            const isSubjective = isSubjectiveQuestion(question.question.questionType, questionGroup.questionType)

            // 画图/补图题：参考答案是图片，无法按文字判分
        if (isImageAnswer(correctAnswer)) {
          return {
            userId,
            questionId: sub.questionId,
            content: { answer: userAnswer },
            score: null,
            isCorrect: null,
            gradingStatus: "skipped",
          };
        }

        if (isUngradedQuestion(questionGroup.questionType)) {
              return {
                questionId: sub.questionId,
                content: { answer: userAnswer },
                score: null,
                isCorrect: null,
                gradingStatus: "skipped",
              }
            }

            if (isSubjective) {
              if (!userAnswer.trim()) {
                return {
                  questionId: sub.questionId,
                  content: { answer: "" },
                  score: 0,
                  isCorrect: false,
                  gradingStatus: "graded",
                }
              }
              return {
                questionId: sub.questionId,
                content: { answer: userAnswer },
                score: null,
                isCorrect: null,
                gradingStatus: "pending",
              }
            }

            if (!userAnswer.trim()) {
              return {
                questionId: sub.questionId,
                content: { answer: "" },
                score: 0,
                isCorrect: false,
                gradingStatus: "graded",
              }
            }

            // 语法填空 / 选词填空的答案是单词，大小写有意义，判分不能忽略大小写
            const isCorrect = isAnswerCorrect(userAnswer, correctAnswer, {
              caseSensitive: isCaseSensitiveAnswer(
                question.question.questionType,
                questionGroup.questionType,
                correctAnswer,
              ),
            })
            const score = isCorrect ? questionScore : 0

            if (isCorrect) {
              groupCorrectNum++
            }
            groupScore += score

            return {
              questionId: sub.questionId,
              content: { answer: userAnswer },
              score,
              isCorrect,
            }
          })
        )

        const unansweredSubmissions = questionGroup.groupItems
          .filter((item) => !submittedIds.has(item.question.id))
          .map((item) => {
            // 未作答里，参考答案是图片的画图题不判分（避免 worker 拿图片当文字答案去批）
            const skip = isUngradedQuestion(questionGroup.questionType) || isImageAnswer(item.question.answer ?? "");
            return {
              questionId: item.question.id,
              content: { answer: "" },
              score: skip ? null : 0,
              isCorrect: skip ? null : false,
              ...(skip ? { gradingStatus: "skipped" as const } : {}),
            };
          })

        const validSubmissions = [...processedSubmissions.filter(Boolean), ...unansweredSubmissions] as NonNullable<typeof processedSubmissions[0]>[]

        const groupSubmission = await prisma.questionGroupSubmission.create({
          data: {
            userId,
            questionGroupId: groupSub.questionGroupId,
            testSubmissionId: testPaperSubmission.id,
            score: groupScore,
            isCorrect: groupTotalNum > 0 ? groupCorrectNum === groupTotalNum : null,
            correctNum: groupCorrectNum,
            totalNum: groupTotalNum,
            duration: groupSub.duration,
            submissions: {
              create: validSubmissions.map((s) => ({
                userId,
                questionId: s.questionId,
                content: s.content,
                score: s.score,
                isCorrect: s.isCorrect,
                gradingStatus: (s as any).gradingStatus || "graded",
                // 提交时默认允许计入优秀解答，回顾页可逐次修改
                shareAsExcellent: true,
              })),
            },
          },
        })

        totalScore += groupScore
        totalCorrectNum += groupCorrectNum
        totalTotalNum += groupTotalNum

        return groupSubmission
      })
    )

    await prisma.testPaperSubmission.update({
      where: { id: testPaperSubmission.id },
      data: {
        score: totalScore,
      },
    })

    return NextResponse.json({
      success: true,
      submissionId: testPaperSubmission.id,
      score: totalScore,
      duration,
      totalCorrectNum,
      totalTotalNum,
    })
  } catch (error) {
    console.error("Test paper submission error:", error)
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 })
  }
}