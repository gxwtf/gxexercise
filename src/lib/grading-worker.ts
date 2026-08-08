import { prisma } from "./prisma"
import { gradeReadingExpression, preCheckGrade } from "./ai-service"

let running = false

export function startGradingWorker() {
  if (running) return
  running = true

  console.log("[GradingWorker] Started, polling every 10s")

  const poll = async () => {
    try {
      const pending = await prisma.questionSubmission.findMany({
        where: { gradingStatus: "pending" },
        take: 5,
        include: {
          question: {
            select: { content: true, answer: true, score: true },
          },
        },
      })

      if (pending.length === 0) return

      console.log(`[GradingWorker] Found ${pending.length} pending submission(s), grading...`)

      for (const sub of pending) {
        try {
          const content = sub.content as { answer?: string } | null
          const userAnswer = content?.answer ?? ""
          const maxScore = sub.question.score

          const pre = preCheckGrade(userAnswer, sub.question.answer, maxScore, false)
          if (pre) {
            await prisma.questionSubmission.update({
              where: { id: sub.id },
              data: {
                score: pre.score,
                isCorrect: pre.score === maxScore,
                gradingStatus: "graded",
                aiFeedback: pre.feedback ? { feedback: pre.feedback } : undefined,
              },
            })
            console.log(`[GradingWorker] ${sub.id} pre-checked: score=${pre.score}`)
            continue
          }

          const result = await gradeReadingExpression(
            sub.question.content,
            userAnswer,
            sub.question.answer,
            maxScore,
          )

          await prisma.questionSubmission.update({
            where: { id: sub.id },
            data: {
              score: result.score,
              isCorrect: result.score === maxScore,
              gradingStatus: "graded",
              aiFeedback: result.feedback ? { feedback: result.feedback } : undefined,
            },
          })
          console.log(`[GradingWorker] ${sub.id} graded: score=${result.score}`)
        } catch (error) {
          console.error(`[GradingWorker] Failed to grade ${sub.id}:`, error)
        }
      }
    } catch (error) {
      console.error("[GradingWorker] Poll error:", error)
    }
  }

  poll()
  setInterval(poll, 10_000)
}