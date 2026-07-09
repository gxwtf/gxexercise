import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { serialize } from "next-mdx-remote/serialize"
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
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
  const mdxOptions = {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  };

  function escapeLatexBraces(content: string): string {
    let result = ''
    let inTag = 0
    let inMath = false
    for (let i = 0; i < content.length; i++) {
      const ch = content[i]
      if (ch === '$' && inTag === 0) {
        inMath = !inMath
        result += ch
      } else if (ch === '<') {
        inTag++
        result += ch
      } else if (ch === '>') {
        inTag = Math.max(0, inTag - 1)
        result += ch
      } else if (ch === '{' && inTag === 0 && !inMath) {
        result += '\\{'
      } else if (ch === '}' && inTag === 0 && !inMath) {
        result += '\\}'
      } else {
        result += ch
      }
    }
    return result
  }

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
    ? await serialize(escapeLatexBraces(questionGroup.content), { mdxOptions })
    : null

  const stemMdx = currentQuestion.content
    ? await serialize(escapeLatexBraces(currentQuestion.content), { mdxOptions })
    : null

  const analysisMdx = currentQuestion.analysis
    ? await serialize(escapeLatexBraces(currentQuestion.analysis), { mdxOptions })
    : null

  const correctAnswerMdx = currentQuestion.answer
    ? await serialize(escapeLatexBraces(currentQuestion.answer), { mdxOptions })
    : null

  const userAnswerMdx = userAnswer
    ? await serialize(escapeLatexBraces(userAnswer), { mdxOptions })
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

  const rawOptions = (currentQuestion.options as Array<{ id: string; label: string }>) || []

  const options = await Promise.all(
    rawOptions.map(async (opt) => {
      try {
        const escaped = escapeLatexBraces(opt.label)
        const labelMdx = await serialize(escaped, { mdxOptions })
        return { ...opt, labelMdx }
      } catch {
        return { ...opt, labelMdx: null }
      }
    })
  )

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