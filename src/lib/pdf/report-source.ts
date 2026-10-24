/**
 * 把 Prisma 查出来的「一次作答」整理成分析报告需要的最小结构
 * （不直接依赖 Prisma 生成类型，方便脚本复用 / 单测）
 *
 * - 题组：一次 QuestionGroupSubmission + 它下面的 QuestionSubmission
 * - 套卷：一次 TestPaperSubmission + 它下面的各小节 QuestionGroupSubmission
 */
import { prisma } from "../prisma"
import { isSubjectiveQuestion } from "../excellent-answer-rules"
import { toOptions } from "./paper-source"
import type {
  AnalysisReportInput,
  ReportQuestionInput,
  ReportSectionInput,
} from "./report-doc"

/** 题组类型 → 卷面题型名（比小题自己的 questionType 更能说明题型） */
const GROUP_TYPE_LABELS: Record<string, string> = {
  cloze: "完形填空",
  grammar: "语法填空",
  "seven-choose-five": "七选五",
  "word-choice": "选词填空",
  reading: "阅读理解",
  "reading-choice": "阅读理解",
  "reading-expression": "阅读表达",
  "en-writing": "英语作文",
  "chinese-essay": "语文大作文",
  "chinese-micro-writing": "微写作",
  "chinese-reading": "语文阅读",
  "chemistry-image": "化学图片题",
}

/** 一次作答里单题的原始数据（QuestionSubmission） */
interface SubmissionLike {
  questionId: string
  content: unknown
  score: number | null
  isCorrect: boolean | null
  aiFeedback: unknown
  gradingStatus: string
}

interface QuestionLike {
  id: string
  questionType: string
  content: string | null
  options: unknown
  answer: string | null
  analysis: string | null
  score: number | null
}

interface GroupLike {
  id: string
  title: string
  questionType: string
  category: string
  content: string | null
  score: number
  subject?: string
  source?: string
  grade?: string | null
  groupItems: { question: QuestionLike }[]
}

const CHINESE_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五"]

/** 作答内容在库里是 Json：正常是 { answer: string }，脏数据可能是字符串 */
function answerOf(content: unknown): string {
  if (content == null) return ""
  if (typeof content === "string") return content
  if (typeof content === "object") {
    const rec = content as Record<string, unknown>
    if (typeof rec.answer === "string") return rec.answer
    if (Array.isArray(rec.answers)) return rec.answers.map((v) => String(v)).join("\n")
  }
  return ""
}

function fmtLocal(date: Date | null | undefined): string | null {
  if (!date) return null
  return new Date(date).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function toReportQuestion(
  number: number,
  question: QuestionLike,
  sub: SubmissionLike | undefined,
  group?: GroupLike
): ReportQuestionInput {
  const aiFeedback =
    sub?.aiFeedback && typeof sub.aiFeedback === "object"
      ? (sub.aiFeedback as Record<string, unknown>)
      : null
  const groupType = group?.questionType ?? ""
  const groupLabel = GROUP_TYPE_LABELS[groupType]
  return {
    number,
    questionType: question.questionType || "",
    displayType: groupLabel ?? null,
    content: question.content ?? "",
    options: toOptions(question.options),
    userAnswer: answerOf(sub?.content),
    correctAnswer: question.answer ?? "",
    analysis: question.analysis ?? "",
    isCorrect: sub?.isCorrect ?? null,
    score: sub?.score ?? null,
    maxScore: question.score ?? null,
    gradingStatus: sub?.gradingStatus ?? null,
    subjective: group ? isSubjectiveQuestion(question.questionType, groupType) : undefined,
    aiFeedback,
  }
}

/** 题组（单节练习）分析报告 */
export async function buildGroupReportInput(
  groupId: string,
  userId: number,
  submissionId?: string | null
): Promise<AnalysisReportInput | null> {
  const group = (await prisma.questionGroup.findUnique({
    where: { id: groupId },
    include: { groupItems: { include: { question: true }, orderBy: { orderIndex: "asc" } } },
  })) as GroupLike | null
  if (!group) return null

  const groupSub = submissionId
    ? await prisma.questionGroupSubmission.findFirst({
        where: { id: submissionId, userId, questionGroupId: groupId },
        include: { submissions: true },
      })
    : await prisma.questionGroupSubmission.findFirst({
        where: { userId, questionGroupId: groupId },
        orderBy: { createdAt: "desc" },
        include: { submissions: true },
      })

  const subs = (groupSub?.submissions ?? []) as SubmissionLike[]
  const subMap = new Map(subs.map((s) => [s.questionId, s]))

  const questions: ReportQuestionInput[] = group.groupItems.map((item, index) =>
    toReportQuestion(index + 1, item.question, subMap.get(item.question.id), group)
  )

  // 写作类题组：group.content 与小大题 content 常常是同一段题目说明，别在报告里印两遍
  const groupContent = String(group.content ?? "").trim()
  if (groupContent) {
    for (const q of questions) {
      const stem = String(q.content ?? "").trim()
      if (stem && (stem === groupContent || stem.startsWith(groupContent))) {
        q.content = stem === groupContent ? "" : stem.slice(groupContent.length).trim()
      }
    }
  }

  const section: ReportSectionInput = {
    groupTitle: group.title,
    material: group.content ?? "",
    questions,
  }

  const totalScore =
    questions.reduce((n, q) => n + (q.maxScore ?? 0), 0) || (group.score ?? 0) || null

  return {
    kind: "group",
    title: group.title,
    subject: group.subject ?? null,
    source: group.source ?? null,
    grade: group.grade ?? null,
    submittedAt: fmtLocal(groupSub?.createdAt),
    durationSeconds: groupSub?.duration ?? null,
    score: groupSub?.score ?? null,
    totalScore,
    correctCount: groupSub?.correctNum ?? questions.filter((q) => q.isCorrect === true).length,
    totalCount: groupSub?.totalNum ?? questions.length,
    sections: [section],
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  }
}

/** 套卷分析报告（按「大题」分节，题号连续） */
export async function buildPaperReportInput(
  paperId: string,
  testSubmissionId: string,
  userId: number
): Promise<AnalysisReportInput | null> {
  const paper = await prisma.testPaper.findUnique({
    where: { id: paperId },
    include: { paperItems: { orderBy: { orderIndex: "asc" } } },
  })
  if (!paper) return null

  const testSub = await prisma.testPaperSubmission.findFirst({
    where: { id: testSubmissionId, userId },
    include: { groupSubmissions: { include: { submissions: true } } },
  })
  if (!testSub) return null

  const items = paper.paperItems.filter((item) => item.itemType === "questionGroup")
  const groupIds = items.map((item) => item.itemId)

  const groups = (await prisma.questionGroup.findMany({
    where: { id: { in: groupIds } },
    include: { groupItems: { include: { question: true }, orderBy: { orderIndex: "asc" } } },
  })) as GroupLike[]
  const groupMap = new Map(groups.map((g) => [g.id, g]))

  const groupSubMap = new Map(
    (testSub.groupSubmissions as Array<{
      id: string
      questionGroupId: string
      score: number | null
      correctNum: number | null
      totalNum: number | null
      submissions: SubmissionLike[]
    }>).map((gs) => [gs.questionGroupId, gs])
  )

  // 连续题号 + 连续同类别合并成大题（与作答卷的版式保持一致）
  const sections: ReportSectionInput[] = []
  let number = 0
  let current: ReportSectionInput | null = null

  for (const item of items) {
    const group = groupMap.get(item.itemId)
    if (!group) continue
    const groupSub = groupSubMap.get(group.id)
    const subMap = new Map((groupSub?.submissions ?? []).map((s) => [s.questionId, s]))

    const questions = group.groupItems.map((gi) => {
      number += 1
      return toReportQuestion(number, gi.question, subMap.get(gi.question.id), group)
    })

    if (!current || current.heading !== group.category) {
      current = { heading: group.category, groupTitle: group.title, material: "", questions: [] }
      sections.push(current)
    }
    if (group.content?.trim()) {
      current.material = current.material ? `${current.material}\n\n${group.content}` : group.content
    }
    current.questions.push(...questions)
  }

  // 套卷按大题给标题加中文序号，避免报告里「一、完形填空」和「二、答题卡」混号
  sections.forEach((section, index) => {
    if (!section.heading) section.heading = `第 ${CHINESE_NUM[index] ?? index + 1} 部分`
  })

  const allQuestions = sections.flatMap((s) => s.questions)
  const summedMax = allQuestions.reduce((n, q) => n + (q.maxScore ?? 0), 0)
  const totalScore = paper.totalScore ?? (summedMax || null)
  const groupSubs = Array.from(groupSubMap.values())
  const correctCount = groupSubs.some((gs) => gs.correctNum != null)
    ? groupSubs.reduce((n, gs) => n + (gs.correctNum ?? 0), 0)
    : allQuestions.filter((q) => q.isCorrect === true).length
  const totalCount = groupSubs.some((gs) => gs.totalNum != null)
    ? groupSubs.reduce((n, gs) => n + (gs.totalNum ?? 0), 0)
    : allQuestions.length

  return {
    kind: "paper",
    title: paper.title,
    subject: paper.subject,
    source: paper.source,
    grade: paper.grade,
    year: paper.year,
    submittedAt: fmtLocal(testSub.submittedAt ?? testSub.createdAt),
    durationSeconds: testSub.duration ?? null,
    score: testSub.score ?? (groupSubs.some((gs) => gs.score != null) ? groupSubs.reduce((n, gs) => n + (gs.score ?? 0), 0) : null),
    totalScore,
    correctCount,
    totalCount,
    sections,
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  }
}
