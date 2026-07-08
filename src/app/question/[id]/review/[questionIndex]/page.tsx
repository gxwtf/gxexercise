import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { serialize } from "next-mdx-remote/serialize"
import type { QuestionSwitcherItem } from "@/components/review/QuestionSwitcher"
import type { SubmissionHistoryItem } from "@/components/review/SubmissionHistoryTable"
import { ReviewContent } from "./review-content"

interface PageProps {
  params: Promise<{
    id: string
    questionIndex: string
  }>
}

async function getReviewData(questionGroupId: string, questionIndex: number) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (!session.isLoggedIn || !session.userid) {
    redirect("/login")
  }

  const questionGroup = await prisma.questionGroup.findUnique({
    where: { id: questionGroupId },
    include: {
      groupItems: {
        include: {
          question: true,
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  })

  if (!questionGroup) {
    notFound()
  }

  const questions = questionGroup.groupItems

  if (questionIndex < 1 || questionIndex > questions.length) {
    notFound()
  }

  const latestGroupSubmission = await prisma.questionGroupSubmission.findFirst({
    where: {
      userId: session.userid,
      questionGroupId,
    },
    orderBy: { createdAt: "desc" },
    include: {
      submissions: true,
    },
  })

  const questionSubmissions = latestGroupSubmission?.submissions ?? []

  const currentItem = questions[questionIndex - 1]
  const currentQuestion = currentItem.question

  const currentSubmission = questionSubmissions.find(
    (s) => s.questionId === currentQuestion.id
  )

  const userAnswer = currentSubmission?.content
    ? (currentSubmission.content as { answer?: string }).answer ?? null
    : null

  const isCorrect = currentSubmission?.isCorrect ?? null

  const articleMdx = questionGroup.content
    ? await serialize(questionGroup.content)
    : null

  const stemMdx = currentQuestion.content
    ? await serialize(currentQuestion.content)
    : null

  const analysisMdx = currentQuestion.analysis
    ? await serialize(currentQuestion.analysis)
    : null

  const correctAnswerMdx = currentQuestion.answer
    ? await serialize(currentQuestion.answer)
    : null

  const userAnswerMdx = userAnswer
    ? await serialize(userAnswer)
    : null

  const questionSwitcherItems: QuestionSwitcherItem[] = questions.map((item, idx) => {
    const sub = questionSubmissions.find((s) => s.questionId === item.question.id)
    let status: "correct" | "wrong" | "unanswered" = "unanswered"
    if (sub) {
      status = sub.isCorrect ? "correct" : "wrong"
    }
    return {
      index: idx + 1,
      questionId: item.question.id,
      status,
    }
  })

  const allQuestionSubmissions = await prisma.questionSubmission.findMany({
    where: {
      userId: session.userid,
      questionId: currentQuestion.id,
    },
    orderBy: { createdAt: "desc" },
  })

  const historyItems: SubmissionHistoryItem[] = allQuestionSubmissions.map((sub) => {
    const answer = sub.content ? (sub.content as { answer?: string }).answer ?? "-" : "-"
    return {
      id: sub.id,
      answer,
      isCorrect: sub.isCorrect ?? false,
      createdAt: sub.createdAt,
    }
  })

  const options = (currentQuestion.options as Array<{ id: string; label: string }>) || []

  return {
    questionGroup: {
      id: questionGroup.id,
      title: questionGroup.title,
      questionType: questionGroup.questionType,
    },
    articleMdx,
    stemMdx,
    analysisMdx,
    questionSwitcherItems,
    currentQuestion,
    options,
    correctAnswer: currentQuestion.answer || "",
    correctAnswerMdx,
    userAnswer,
    userAnswerMdx,
    isCorrect,
    currentIndex: questionIndex,
    historyItems,
    correctRate: currentQuestion.correctRate,
  }
}

export default async function ReviewQuestionPage({ params }: PageProps) {
  const { id, questionIndex } = await params
  const index = parseInt(questionIndex, 10)

  if (isNaN(index) || index < 1) {
    redirect(`/question/${id}/review/1`)
  }

  const data = await getReviewData(id, index)

  const basePath = `/question/${id}/review`

  return (
    <ReviewContent
      data={data}
      basePath={basePath}
    />
  )
}