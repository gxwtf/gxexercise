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
            select: { isCorrect: true, score: true },
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

  const groupResults = submission.groupSubmissions.map((gs) => {
    const hasUnreviewed = gs.submissions.some((s) => s.isCorrect === null)
    const hasWrong = gs.submissions.some((s) => s.isCorrect === false)
    const allCorrect = gs.submissions.length > 0 && gs.submissions.every((s) => s.isCorrect === true)

    return {
      id: gs.questionGroup.id,
      groupSubmissionId: gs.id,
      title: gs.questionGroup.title,
      questionType: gs.questionGroup.questionType,
      score: gs.score,
      maxScore: gs.questionGroup.score,
      correctNum: gs.correctNum,
      totalNum: gs.totalNum,
      isCorrect: gs.isCorrect,
      hasUnreviewed,
      hasWrong,
      allCorrect,
    }
  })

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