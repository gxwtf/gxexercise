import { prisma } from "@/lib/prisma"
import { doubleNewlinesPreserveTables, normalizeQuestionMdx } from "@/lib/mdx-text"
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
import { toPublicEssayReview, type EssayReviewPublic } from "@/lib/essay-review"
import { isSubjectiveQuestion } from "@/lib/excellent-answer-rules"
import { isPickOneMode, pickIndexFromRows } from "@/lib/pick-one"
import { findExcellentAnswers } from "@/lib/excellent-answers"
import { isQuestionBankReviewer } from "@/lib/question-bank-auth"
import {
  annotateMaterialScores,
  annotateStemScore,
  stemHasOwnNumber,
  usesScoreAnnotation,
} from "@/lib/score-annotate"

interface PageProps {
  params: Promise<{
    id: string
    questionIndex: string
  }>
}

function escapeLatexBraces(input: string): string {
  input = normalizeQuestionMdx(input)
  // <br> 必须自闭合（MDX 会报 "Expected a closing tag for <br>"，语文表格里常见）
  const content = input.replace(/<br\s*\/?>/gi, '<br />')
  let result = ''
  let inTag = 0
  let inMath = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (ch === '$' && inTag === 0) {
      inMath = !inMath
      result += ch
    } else if (ch === '<') {
      if (inMath) {
        result += ch // 公式里的 < 是关系符
      } else if (/^<\/?[A-Za-z][A-Za-z0-9-]*(\s[^<>]*)?\/?>/.test(content.slice(i))) {
        inTag++
        result += ch
      } else {
        result += '&lt;'
      }
    } else if (ch === '>') {
      if (inMath) {
        result += ch
      } else if (inTag > 0) {
        inTag = Math.max(0, inTag - 1)
        result += ch
      } else {
        result += '&gt;'
      }
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
  // 语文大作文（题组类型 chinese-essay）：答案字段是脏数据、另有 AI 批阅单要下发，下面多处要用
  const isChineseEssay = questionGroup.questionType === "chinese-essay"

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
  const gradingStatus = selectedSubmission?.gradingStatus ?? null

  // 历史 / 地理 / 政治大题：材料里内联设问 + <AnswerBox>，设问句末补「（6分）」；
  // 右侧「本题设问」也同样补一次（学生在这里看分值与得分对照）。
  const scoreAnnotated = usesScoreAnnotation(questionGroup.questionType)

  const articleMdx = questionGroup.content
    ? await serialize(
        escapeLatexBraces(
          scoreAnnotated
            ? annotateMaterialScores(
                questionGroup.content,
                questionGroup.groupItems.map((item) => item.question.score)
              )
            : questionGroup.content
        ),
        { mdxOptions }
      )
    : null

  const stemText = scoreAnnotated
    ? annotateStemScore(currentQuestion.content, currentQuestion.score)
    : currentQuestion.content
  const stemMdx = stemText
    ? await serialize(escapeLatexBraces(stemText), { mdxOptions })
    : null

  const analysisMdx = currentQuestion.analysis
    ? await serialize(escapeLatexBraces(currentQuestion.analysis), { mdxOptions })
    : null

  // 参考答案里的 `##` 表示「多个可接受答案」（判分端按任一命中处理），展示时换成「或」
  //
  // 语文大作文**不展示「参考答案」板块**：题库里 chinese-essay 的 answer 字段是脏数据
  // （有的录入批次把文言文参考译文塞进了作文题的 answer），给学生看是错的。
  // 这里连序列化都跳过，脏文本也不会进 RSC 载荷；作文的「参考」由 AI 批阅单承担。
  const answerForDisplay = isChineseEssay
    ? ''
    : (currentQuestion.answer || '').replace(/\s*##\s*/g, ' 或 ')
  const correctAnswerMdx = answerForDisplay
    ? await serialize(doubleNewlinesPreserveTables(escapeLatexBraces(answerForDisplay)), { mdxOptions })
    : null

  const userAnswerMdx = userAnswer
    ? await serialize(doubleNewlinesPreserveTables(escapeLatexBraces(userAnswer)), { mdxOptions })
    : null

  const questionSwitcherItems: QuestionSwitcherItem[] = questions.map((item, idx) => {
    const sub = questionSubmissions.find((s) => s.questionId === item.question.id)
    let status: "correct" | "wrong" | "unanswered" | "reviewing" = "unanswered"
    if (sub) {
      if (sub.gradingStatus === "pending" && isSubjectiveQuestion(item.question.questionType, questionGroup.questionType)) {
        status = "reviewing"
      } else if (sub.isCorrect === null) {
        status = "unanswered"
      } else {
        status = sub.isCorrect ? "correct" : "wrong"
      }
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
        answerMdx = await serialize(doubleNewlinesPreserveTables(escapeLatexBraces(answer)), { mdxOptions })
      }
    } catch {}
    return {
      id: sub.id,
      answer,
      answerMdx,
      isCorrect: sub.isCorrect,
      gradingStatus: sub.gradingStatus,
      score: sub.score,
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
  const allBlankCorrect: Record<string, boolean> = {}
  questions.forEach((item, idx) => {
    const sub = questionSubmissions.find((s) => s.questionId === item.question.id)
    const blankId = String(idx + 1)
    if (sub?.content) {
      const answer = (sub.content as { answer?: string }).answer
      if (answer) allUserBlanks[blankId] = answer
    }
    allCorrectBlanks[blankId] = item.question.answer || ''
    if (sub && typeof sub.isCorrect === 'boolean') allBlankCorrect[blankId] = sub.isCorrect
  })

  const isSubjective = isSubjectiveQuestion(currentQuestion.questionType, questionGroup.questionType)

  // 优秀解答：仅主观题、且只有登录用户能看到
  const excellentAnswerRecords = isSubjective && userId > 0
    ? await findExcellentAnswers(currentQuestion.id, questionGroup.questionType, currentQuestion.score ?? 0)
    : []
  const excellentAnswers = await Promise.all(
    excellentAnswerRecords.map(async (item) => {
      let answerMdx: MDXRemoteSerializeResult | null = null
      try {
        answerMdx = await serialize(doubleNewlinesPreserveTables(escapeLatexBraces(item.answer)), { mdxOptions })
      } catch {
        answerMdx = null
      }
      return {
        id: item.id,
        userId: item.userId,
        userName: item.userName || `同学${item.userId}`,
        score: item.score,
        maxScore: item.maxScore,
        answer: item.answer,
        answerMdx,
        isMine: item.userId === userId,
      }
    })
  )

  let avgScore: number | null = null
  let correctRate: number | null = null
  const allSubmissionsWithScore = await prisma.questionSubmission.findMany({
    where: {
      questionId: currentQuestion.id,
      score: { not: null },
    },
    select: { score: true, isCorrect: true },
  })
  if (allSubmissionsWithScore.length > 0) {
    const total = allSubmissionsWithScore.reduce((sum, s) => sum + (s.score ?? 0), 0)
    avgScore = total / allSubmissionsWithScore.length
    const judgedSubmissions = allSubmissionsWithScore.filter(s => s.isCorrect !== null)
    if (judgedSubmissions.length > 0) {
      const correctCount = judgedSubmissions.filter(s => s.isCorrect === true).length
      correctRate = correctCount / judgedSubmissions.length
    }
  }

  const userScore = selectedSubmission?.score ?? null
  const questionScore = currentQuestion.score ?? 0
  const aiFeedbackRaw = selectedSubmission?.aiFeedback as Record<string, unknown> | null
  const aiFeedback = (aiFeedbackRaw?.feedback as string) ?? null

  // 语文大作文的 AI 批阅单（判分标准 v1.5，北京卷议论文）：
  // **只把 toPublicEssayReview() 剥过的学生可见部分下发** —— score / maxScore / band /
  // range / verdict / suggestions / direction / wordCount。aiFeedback.essayReview 里的
  // internal（A/B/C/D/L 条款编号、命中条数、起点分、上限、扣分算式）绝不进 RSC 载荷，
  // 给学生的界面里一个内部过程都不许出现。
  const essayReview: EssayReviewPublic | null = isChineseEssay
    ? toPublicEssayReview(aiFeedbackRaw?.essayReview)
    : null
  // 「明确不评分」是终态：后端判到记叙文等非议论文时会跳过判分并写明理由
  // （aiFeedback.essaySkipReason = "non-argumentative"，说明文案在 aiFeedback.feedback）。
  const essaySkipReason =
    isChineseEssay && typeof aiFeedbackRaw?.essaySkipReason === "string"
      ? aiFeedbackRaw.essaySkipReason
      : null

  // 评分明细（内容/语言/结构三条进度条）的判定：作文（en-writing）照旧一律走明细；
  // 其它题型（如阅读表达第 4 题 43）只要 aiFeedback 里带 subScores 也走同一套明细。
  const hasSubScores = !!aiFeedbackRaw?.subScores && typeof aiFeedbackRaw.subScores === "object"
  const detailedFeedback =
    questionGroup.questionType === "en-writing" || hasSubScores ? aiFeedbackRaw : null

  const detailedSubMaxes = detailedFeedback
    ? (() => {
        const contentMax = Math.round(questionScore * 0.4)
        const languageMax = Math.round(questionScore * 0.4)
        const structureMax = questionScore - contentMax - languageMax
        return { contentMax, languageMax, structureMax }
      })()
    : null

  // 以下四项只有作文的 aiFeedback 才有，其它题型取不到值时自然是 null
  const overallCommentMdx = detailedFeedback?.overallComment
    ? await serialize(String(detailedFeedback.overallComment), { mdxOptions })
    : null
  const lineCorrectionsMdx = detailedFeedback?.lineCorrections
    ? await serialize(String(detailedFeedback.lineCorrections), { mdxOptions })
    : null
  const correctionsMdx = detailedFeedback?.corrections
    ? await serialize(String(detailedFeedback.corrections), { mdxOptions })
    : null
  const betterExpressionsMdx = detailedFeedback?.betterExpressions
    ? await serialize(String(detailedFeedback.betterExpressions), { mdxOptions })
    : null
  const modelEssayMdx = detailedFeedback?.modelEssay
    ? await serialize(String(detailedFeedback.modelEssay), { mdxOptions })
    : null

  // 任选一题（二选一 / 三选一）：回顾页要知道「用户选的是第几题、得了多少分」
  const pickOneEnabled = isPickOneMode(questionGroup.answerMode)
  const pickedQuestionId = pickOneEnabled
    ? pickIndexFromRows(questionSubmissions.map((s) => ({ questionId: s.questionId, score: s.score, isCorrect: s.isCorrect })))
    : null
  const pickedIndex = pickedQuestionId
    ? questions.findIndex((item) => item.question.id === pickedQuestionId) + 1
    : 0
  const pickedSubmission = pickedQuestionId
    ? questionSubmissions.find((s) => s.questionId === pickedQuestionId) ?? null
    : null
  const pickedQuestion = pickedQuestionId
    ? questions.find((item) => item.question.id === pickedQuestionId)?.question ?? null
    : null
  const pickOne = pickOneEnabled
    ? {
        enabled: true,
        total: questions.length,
        pickedIndex: pickedIndex > 0 ? pickedIndex : null,
        pickedScore: pickedSubmission?.score ?? null,
        pickedGradingStatus: pickedSubmission?.gradingStatus ?? null,
        pickedMax: pickedQuestion?.score ?? questionGroup.score,
        isCurrentPicked: currentQuestion.id === pickedQuestionId,
      }
    : null

  return {
    questionGroup: {
      id: questionGroup.id,
      title: questionGroup.title,
      questionType: questionGroup.questionType,
      category: questionGroup.category,
    },
    articleMdx,
    stemMdx,
    // 政治 / 历史 / 地理的题干自带「（1）（2）」卷面编号时，右侧不再叠一层系统题号
    // （否则回顾页会显示成「1.（1）结合材料…」）
    stemHasOwnNumber: scoreAnnotated && stemHasOwnNumber(currentQuestion.content),
    analysisMdx,
    questionSwitcherItems,
    currentQuestion,
    options,
    correctAnswer: isChineseEssay ? "" : currentQuestion.answer || "",
    correctAnswerMdx,
    userAnswer,
    userAnswerMdx,
    isCorrect,
    gradingStatus,
    currentIndex: questionIndex,
    historyItems,
    correctRate,
    allUserBlanks,
    allCorrectBlanks,
    allBlankCorrect,
    currentSubmissionId: selectedSubmission?.id ?? null,
    // 本次回顾的是哪一次作答：头部显示「作答时间」用（从 /records 或作答记录点进来时是那一次）
    submittedAt: selectedSubmission?.createdAt ?? null,
    isSubjective,
    userScore,
    questionScore,
    avgScore,
    excellentAnswers,
    shareAsExcellent: selectedSubmission ? selectedSubmission.shareAsExcellent : null,
    aiFeedback,
    essayReview,
    essaySkipReason,
    detailedFeedback,
    detailedSubMaxes,
    overallCommentMdx,
    lineCorrectionsMdx,
    correctionsMdx,
    betterExpressionsMdx,
    modelEssayMdx,
    pickOne,
  }
}

export default async function ReviewQuestionPage({ params }: PageProps) {
  const { id, questionIndex } = await params
  const index = parseInt(questionIndex, 10)

  if (isNaN(index) || index < 1) {
    redirect(`/question/${id}/review/1`)
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  const userId = session.userid || 0

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

  // 题库管理权限（网站管理员 / 题目审核名单成员）：只决定页头是否显示「管理题目」入口，
  // 编辑器页自身会再校验一次，这里不做任何写入。
  const canManageQuestions =
    Boolean(session.admin) || (await isQuestionBankReviewer(session.username))

  return (
    <ReviewContent
      data={{ ...data, canManageQuestions }}
      basePath={basePath}
    />
  )
}