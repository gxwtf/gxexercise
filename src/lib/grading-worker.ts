import { prisma } from "./prisma"
import { gradeWithConfig, preCheckGrade, type GradeResult } from "./ai-service"
import { getGradingPrompt } from "./grading-prompts"

function buildAiFeedback(result: GradeResult): Record<string, unknown> | undefined {
  const data: Record<string, unknown> = {}
  if (result.feedback) data.feedback = result.feedback
  if (result.subScores) data.subScores = result.subScores
  if (result.overallComment) data.overallComment = result.overallComment
  if (result.lineCorrections) data.lineCorrections = result.lineCorrections
  if (result.betterExpressions) data.betterExpressions = result.betterExpressions
  if (result.modelEssay) data.modelEssay = result.modelEssay
  return Object.keys(data).length > 0 ? data : undefined
}

let running = false
let polling = false

export function startGradingWorker() {
  if (running) return
  running = true

  console.log("[GradingWorker] Started, polling every 10s")

  const poll = async () => {
    if (polling) return
    polling = true
    try {
      const pending = await prisma.questionSubmission.findMany({
        where: { gradingStatus: "pending" },
        take: 5,
        include: {
          question: {
            select: { content: true, answer: true, score: true },
          },
          groupSubmission: {
            select: {
              questionGroup: {
                select: {
                  questionType: true,
                  groupItems: {
                    select: { questionId: true },
                    orderBy: { orderIndex: "asc" },
                  },
                },
              },
            },
          },
        },
      })

      if (pending.length === 0) return

      console.log(`[GradingWorker] Poll: found ${pending.length} pending, matching prompts...`)
      console.log(`[GradingWorker] Pending IDs: ${pending.map(s => s.id).join(", ")}`)

      const toGrade = pending.filter((sub) => {
        const groupItems = sub.groupSubmission?.questionGroup?.groupItems ?? []
        const idx = groupItems.findIndex((item) => item.questionId === sub.questionId)
        const questionType = sub.groupSubmission?.questionGroup?.questionType ?? ""
        return getGradingPrompt(questionType, idx) !== null
      })

      if (toGrade.length === 0) {
        console.log(`[GradingWorker] No prompt matched - pending types: ${pending.map(s => s.groupSubmission?.questionGroup?.questionType ?? "?").join(", ")}`)
        return
      }

      const updatedGroupIds = new Set<string>()

      for (const sub of toGrade) {
        try {
          console.log(`[GradingWorker] Grading submission ${sub.id} (type: ${sub.groupSubmission?.questionGroup?.questionType}, question: ${sub.questionId})`)
          const groupItems = sub.groupSubmission?.questionGroup?.groupItems ?? []
          const idx = groupItems.findIndex((item) => item.questionId === sub.questionId)
          const questionType = sub.groupSubmission?.questionGroup?.questionType ?? ""
          const config = getGradingPrompt(questionType, idx)
          if (!config) continue

          const content = sub.content as { answer?: string } | null
          const userAnswer = content?.answer ?? ""
          const maxScore = sub.question.score

          const pre = preCheckGrade(userAnswer, sub.question.answer, maxScore, config.enableExactMatch ?? false)
          if (pre) {
            await prisma.questionSubmission.updateMany({
              where: { id: sub.id, gradingStatus: "pending" },
              data: {
                score: pre.score,
                isCorrect: pre.score === maxScore,
                gradingStatus: "graded",
                aiFeedback: pre.feedback ? { feedback: pre.feedback } : undefined,
              },
            })
            console.log(`[GradingWorker] ${sub.id} pre-checked: score=${pre.score}`)
            if (sub.groupSubmissionId) updatedGroupIds.add(sub.groupSubmissionId)
            continue
          }

          const result = await gradeWithConfig(
            config,
            sub.question.content,
            userAnswer,
            sub.question.answer,
            maxScore,
          )

          await prisma.questionSubmission.updateMany({
            where: { id: sub.id, gradingStatus: "pending" },
            data: {
              score: result.score,
              isCorrect: result.score === maxScore,
              gradingStatus: "graded",
              aiFeedback: buildAiFeedback(result) as any,
            },
          })
          console.log(`[GradingWorker] ${sub.id} graded: score=${result.score}`)
          if (sub.groupSubmissionId) updatedGroupIds.add(sub.groupSubmissionId)
        } catch (error) {
          console.error(`[GradingWorker] Failed to grade ${sub.id}:`, error)
        }
      }

      for (const gid of updatedGroupIds) {
        try {
        const allSubs = await prisma.questionSubmission.findMany({
          where: { groupSubmissionId: gid },
          select: { score: true, isCorrect: true, gradingStatus: true },
        })
        const newTotalScore = allSubs.reduce((sum, s) => sum + (s.score ?? 0), 0)
        const gradedSubs = allSubs.filter(s => s.gradingStatus === "graded")
        const newCorrectNum = gradedSubs.filter(s => s.isCorrect).length
        const newTotalNum = allSubs.length
        const updated = await prisma.questionGroupSubmission.update({
          where: { id: gid },
          data: { score: newTotalScore, correctNum: newCorrectNum, totalNum: newTotalNum },
          select: { testSubmissionId: true },
        })
        console.log(`[GradingWorker] Group ${gid} recalculated: score=${newTotalScore}`)

        if (updated.testSubmissionId) {
          const groupSubs = await prisma.questionGroupSubmission.findMany({
            where: { testSubmissionId: updated.testSubmissionId },
            select: { score: true, correctNum: true, totalNum: true },
          })
          const tpScore = groupSubs.reduce((sum, g) => sum + (g.score ?? 0), 0)
          const tpCorrectNum = groupSubs.reduce((sum, g) => sum + (g.correctNum ?? 0), 0)
          const tpTotalNum = groupSubs.reduce((sum, g) => sum + (g.totalNum ?? 0), 0)
          await prisma.testPaperSubmission.update({
            where: { id: updated.testSubmissionId },
            data: { score: tpScore },
          })
        }
        } catch (error) {
          console.error(`[GradingWorker] Failed to recalculate group ${gid}:`, error)
        }
      }
    } catch (error) {
      console.error("[GradingWorker] Poll error:", error)
    } finally {
      polling = false
    }
  }

  poll()
  setInterval(poll, 10_000)
}