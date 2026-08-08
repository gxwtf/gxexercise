import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { gradeReadingExpression, preCheckGrade } from "@/lib/ai-service"

function isSubjectiveQuestion(questionType: string, groupType: string): boolean {
  const combined = `${questionType} ${groupType}`
  if (combined.includes("解答") || combined.includes("阅读表达") || combined.includes("reading-expression") || combined.includes("写作") || combined.includes("en-writing")) return true
  if (groupType === "chinese-reading" && questionType === "text") return true
  return false
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, testPaperId, duration, groupSubmissions } = body as {
      userId: number
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

    if (!userId || !testPaperId || !groupSubmissions) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

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
              }
            }

            const isCorrect = correctAnswer.includes("##")
              ? correctAnswer.split("##").some((ans: string) => ans.trim() === userAnswer.trim())
              : userAnswer === correctAnswer
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
          .map((item) => ({
            questionId: item.question.id,
            content: { answer: "" },
            score: 0,
            isCorrect: false,
          }))

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

    const readingExpressionGroupIds = groupSubmissionsCreated
      .filter(Boolean)
      .map((g) => g!.id);

    if (readingExpressionGroupIds.length > 0) {
      const reSubmissions = await prisma.questionSubmission.findMany({
        where: {
          groupSubmissionId: { in: readingExpressionGroupIds },
        },
        include: {
          question: { select: { content: true, answer: true, score: true } },
          groupSubmission: {
            select: {
              questionGroupId: true,
            },
          },
        },
      });

      const reGroupIds = [...new Set(reSubmissions.map((s) => s.groupSubmission?.questionGroupId).filter(Boolean))];
      const reGroups = reGroupIds.length > 0
        ? await prisma.questionGroup.findMany({
            where: { id: { in: reGroupIds as string[] } },
            include: { groupItems: { orderBy: { orderIndex: "asc" } } },
          })
        : [];

      const reGroupMap = new Map(reGroups.map((g) => [g.id, g]));
      const reGraded = reSubmissions.filter((sub) => {
        const groupId = sub.groupSubmission?.questionGroupId;
        const group = groupId ? reGroupMap.get(groupId) : undefined;
        if (!group) return false;
        const isRE = group.questionType === "reading-expression" || group.questionType === "阅读表达";
        if (!isRE) return false;
        const firstThreeIds = new Set(group.groupItems.slice(0, 3).map((item) => item.questionId));
        return firstThreeIds.has(sub.questionId);
      });

      if (reGraded.length > 0) {
        await Promise.all(
          reGraded.map(async (sub) => {
            try {
              const content = sub.content as { answer?: string } | null;
              const userAnswer = content?.answer ?? "";
              const maxScore = sub.question.score;
              const groupId = sub.groupSubmission?.questionGroupId;
              const group = groupId ? reGroupMap.get(groupId) : undefined;
              const firstTwoIds = group ? new Set(group.groupItems.slice(0, 2).map((item) => item.questionId)) : new Set<string>();
              const isFirstTwo = firstTwoIds.has(sub.questionId);

              const pre = preCheckGrade(userAnswer, sub.question.answer, maxScore, isFirstTwo);
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
                return;
              }

              const result = await gradeReadingExpression(
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
                  aiFeedback: result.feedback ? { feedback: result.feedback } : undefined,
                },
              });
            } catch (error) {
              console.error(`AI grading failed for submission ${sub.id}:`, error);
            }
          })
        );

        const groupIds = [...new Set(reGraded.map(s => s.groupSubmissionId).filter(Boolean))];
        for (const gid of groupIds) {
          const allSubs = await prisma.questionSubmission.findMany({
            where: { groupSubmissionId: gid! },
            select: { score: true, isCorrect: true, gradingStatus: true },
          });
          const newTotalScore = allSubs.reduce((sum, s) => sum + (s.score ?? 0), 0);
          const gradedSubs = allSubs.filter(s => s.gradingStatus === "graded");
          const newCorrectNum = gradedSubs.filter(s => s.isCorrect).length;
          await prisma.questionGroupSubmission.update({
            where: { id: gid! },
            data: { score: newTotalScore, correctNum: newCorrectNum },
          });
        }
      }
    }

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