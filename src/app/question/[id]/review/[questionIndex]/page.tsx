import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { serialize } from "next-mdx-remote/serialize"
import type { MDXRemoteSerializeResult } from "next-mdx-remote"
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
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

async function buildReviewData(
  questionGroupId: string,
  questionIndex: number,
  userId: number,
  selectedSubmissionId?: string
) {
  const mdxOptions = {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [rehypeKatex],
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
      userId,
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

  const allQuestionSubmissions = await prisma.questionSubmission.findMany({
    where: {
      userId,
      questionId: currentQuestion.id,
    },
    orderBy: { createdAt: "desc" },
  })

  let selectedSubmission = currentSubmission
  if (selectedSubmissionId) {
    selectedSubmission = allQuestionSubmissions.find(
      (s) => s.id === selectedSubmissionId
    ) ?? currentSubmission
  }

  const userAnswer = selectedSubmission?.content
    ? (selectedSubmission.content as { answer?: string }).answer ?? null
    : null

  const isCorrect = selectedSubmission?.isCorrect ?? null

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
    ? await serialize(escapeLatexBraces(currentQuestion.answer).replace(/\n/g, '\n\n'), { mdxOptions })
    : null

  const userAnswerMdx = userAnswer
    ? await serialize(escapeLatexBraces(userAnswer).replace(/\n/g, '\n\n'), { mdxOptions })
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

  const historyItems: SubmissionHistoryItem[] = await Promise.all(allQuestionSubmissions.map(async (sub) => {
    const answer = sub.content ? (sub.content as { answer?: string }).answer ?? "-" : "-"
    let answerMdx: MDXRemoteSerializeResult | null = null
    try {
      if (answer) {
        answerMdx = await serialize(escapeLatexBraces(answer).replace(/\n/g, '\n\n'), { mdxOptions })
      }
    } catch {}
    return {
      id: sub.id,
      answer,
      answerMdx,
      isCorrect: sub.isCorrect ?? false,
      createdAt: sub.createdAt,
    }
  }))

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

  const allUserBlanks: Record<string, string> = {}
  const allCorrectBlanks: Record<string, string> = {}
  questions.forEach((item, idx) => {
    const sub = questionSubmissions.find((s) => s.questionId === item.question.id)
    const blankId = String(idx + 1)
    if (sub?.content) {
      const answer = (sub.content as { answer?: string }).answer
      if (answer) allUserBlanks[blankId] = answer
    }
    allCorrectBlanks[blankId] = item.question.answer || ''
  })

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
    allUserBlanks,
    allCorrectBlanks,
    currentSubmissionId: selectedSubmission?.id ?? null,
  }
}

export default async function ReviewQuestionPage({ params }: PageProps) {
  const { id, questionIndex } = await params
  const index = parseInt(questionIndex, 10)

  if (isNaN(index) || index < 1) {
    redirect(`/question/${id}/review/1`)
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (!session.isLoggedIn || !session.userid) {
    redirect("/login")
  }

  const userId = session.userid

  // 检测 id 是 questionGroupId 还是 questionSubmissionId
  // 先尝试作为 questionSubmissionId 查找
  const questionSubmission = await prisma.questionSubmission.findUnique({
    where: { id },
  })

  let data
  let basePath: string

  if (questionSubmission) {
    // id 是 questionSubmissionId
    // 通过 questionId 找到 GroupItem，再找到 QuestionGroup
    const groupItem = await prisma.groupItem.findFirst({
      where: { questionId: questionSubmission.questionId },
      include: {
        group: true,
      },
      orderBy: { orderIndex: "asc" },
    })

    if (!groupItem) {
      notFound()
    }

    const questionGroup = groupItem.group

    // 找到这个 question 在 group 中的 index
    const allGroupItems = await prisma.groupItem.findMany({
      where: { groupId: questionGroup.id },
      orderBy: { orderIndex: "asc" },
    })

    const resolvedIndex = allGroupItems.findIndex(item => item.questionId === questionSubmission.questionId) + 1

    data = await buildReviewData(
      questionGroup.id,
      resolvedIndex > 0 ? resolvedIndex : index,
      userId,
      questionSubmission.id
    )

    // basePath 指向 questionGroupId，以便 QuestionSwitcher 正常切换
    basePath = `/question/${questionGroup.id}/review`
  } else {
    // id 是 questionGroupId（原逻辑）
    data = await buildReviewData(id, index, userId)
    basePath = `/question/${id}/review`
  }

  return (
    <ReviewContent
      data={data}
      basePath={basePath}
    />
  )
}