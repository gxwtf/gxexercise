import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { TestPaperResult } from "./TestPaperResult"

interface PageProps {
  params: Promise<{
    id: string
    submissionId: string
  }>
}

export default async function TestPaperResultPage({ params }: PageProps) {
  const { id, submissionId } = await params

  const testPaper = await prisma.testPaper.findUnique({
    where: { id },
  })

  if (!testPaper) {
    notFound()
  }

  const submission = await prisma.testPaperSubmission.findUnique({
    where: { id: submissionId },
    include: {
      groupSubmissions: {
        include: {
          questionGroup: {
            select: { id: true, title: true, questionType: true, score: true },
          },
          submissions: {
            select: { isCorrect: true, score: true, questionId: true },
          },
        },
      },
    },
  })

  if (!submission) {
    notFound()
  }

  const allSubmissions = await prisma.testPaperSubmission.findMany({
    where: {
      testPaperId: id,
      userId: submission.userId,
    },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      score: true,
      submittedAt: true,
    },
  })

  const paperItems = await prisma.paperItem.findMany({
    where: { paperId: id, itemType: "questionGroup" },
    orderBy: { orderIndex: "asc" },
    select: { itemId: true, orderIndex: true },
  })

  const groupItemCounts = await prisma.groupItem.groupBy({
    by: ["groupId"],
    where: { groupId: { in: paperItems.map((p) => p.itemId) } },
    _count: { id: true },
  })
  const countMap = new Map(groupItemCounts.map((g) => [g.groupId, g._count.id]))

  const groupSubMap = new Map(submission.groupSubmissions.map((gs) => [gs.questionGroupId, gs]))

  let globalQuestionNum = 0
  const rawResults = paperItems.map((pi) => {
    const gs = groupSubMap.get(pi.itemId)
    if (!gs) {
      globalQuestionNum += countMap.get(pi.itemId) ?? 0
      return null
    }
    const totalNum = countMap.get(pi.itemId) ?? gs.submissions.length
    const hasUnreviewed = gs.submissions.some((s) => s.isCorrect === null)
    const hasWrong = gs.submissions.some((s) => s.isCorrect === false)
    const allCorrect = gs.submissions.length > 0 && gs.submissions.every((s) => s.isCorrect === true)

    const questionSubmissions = gs.submissions.map((s, idx) => {
      globalQuestionNum++
      return {
        questionId: s.questionId,
        questionNumber: globalQuestionNum,
        questionIndex: idx + 1,
        isCorrect: s.isCorrect,
      }
    })

    return {
      id: gs.questionGroup.id,
      groupSubmissionId: gs.id,
      title: gs.questionGroup.title,
      questionType: gs.questionGroup.questionType,
      score: gs.score,
      maxScore: gs.questionGroup.score,
      correctNum: gs.correctNum,
      totalNum,
      isCorrect: gs.isCorrect,
      hasUnreviewed,
      hasWrong,
      allCorrect,
      questionSubmissions,
    }
  })
  const groupResults = rawResults.filter((r): r is NonNullable<typeof r> => r !== null)

  return (
    <TestPaperResult
      testPaperId={id}
      testPaperTitle={testPaper.title}
      totalScore={submission.score}
      totalDuration={submission.duration}
      totalScoreMax={testPaper.totalScore}
      groupResults={groupResults}
      submissionHistory={allSubmissions}
      currentSubmissionId={submissionId}
    />
  )
}