import { prisma } from "./prisma"
import { gradeWithConfig, preCheckGrade } from "./ai-service"
import { getGradingPrompt, GRADING_PROMPT_REGISTRY } from "./grading-prompts"
import { aggregatePickOne, isPickOneMode } from "./pick-one"
import { gradingStem } from "./grading-stem"
import { isEssayScoring } from "./essay-score"
import { buildAiFeedback, buildEssaySkipFeedback, buildGradingErrorFeedback } from "./ai-feedback"

let running = false
let polling = false

/**
 * 语文大作文「判不动」的失败计数 —— 仅进程内（重启归零），不落库、不需要迁移。
 *
 * 为什么需要它：Worker 对批改异常的一贯作法是「保持 pending，下次轮询再试」。这对阅读表达
 * （一次 1–2k tokens、一两秒）没问题；但**语文作文单篇约 8.8k prompt tokens、7–12 秒**，
 * 如果某篇作文让模型稳定输出不出合格 JSON（长文本 + json_object 偶尔失败，或提示词与
 * 该篇的体裁/题干打架），就会变成「每 10 秒烧一次 8.8k tokens，一直烧下去」——
 * 成本比其它题型高一个量级，必须设上限。
 *
 * 口径：第 1–3 次失败保持 pending（现象就是回顾页「评阅中」，QueueStatus 继续轮询）；
 * 第 4 次失败判定为「判不动」，写成 `skipped` + `gradingError: true`，并把计数清掉。
 * 为什么用 skipped 而不是新增状态：回顾页对 skipped 已有渲染；而 regrade 里
 * chinese-essay 已不在 `isUngradedQuestion`，管理员点「重评」会正常把它重新排队，
 * 所以这不是死路。**只对语文作文计数**，其它题型口径完全不变。
 */
const ESSAY_MAX_FAILED_ATTEMPTS = 3
const essayFailures = new Map<string, number>()

export function startGradingWorker() {
  if (running) return
  running = true

  console.log("[GradingWorker] Started, polling every 10s")

  const poll = async () => {
    if (polling) return
    polling = true
    try {
      // 只捞有 AI 批改配置的题型：客观题（完形/阅读/语法/选词）在提交时就已算分，
      // 它们的 gradingStatus 仍停留在 pending，如果不过滤会把队列堵死
      // （曾导致新提交的作文永远排不到，worker 一直在重复处理 9 月的 grammar 记录）
      const gradeableTypes = Array.from(new Set(GRADING_PROMPT_REGISTRY.map((p) => p.questionType)))
      const pending = await prisma.questionSubmission.findMany({
        where: {
          gradingStatus: "pending",
          groupSubmission: {
            questionGroup: { questionType: { in: gradeableTypes } },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
        include: {
          question: {
            select: { content: true, answer: true, score: true },
          },
          groupSubmission: {
            select: {
              questionGroup: {
                select: {
                  questionType: true,
                  // 物理实验题的题面在题组 content 上（单题 content 是空的，与生物同构），
                  // 批改时要拿它当 {stem}，否则模型只能看到「参考答案 vs 学生作答」盲批
                  content: true,
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
        // 配置 / 是否语文作文先取出来：catch 里要靠它决定「这次失败要不要计数」
        const groupItems = sub.groupSubmission?.questionGroup?.groupItems ?? []
        const idx = groupItems.findIndex((item) => item.questionId === sub.questionId)
        const questionType = sub.groupSubmission?.questionGroup?.questionType ?? ""
        const config = getGradingPrompt(questionType, idx)
        if (!config) continue
        const essay = isEssayScoring(config.scoring)

        try {
          console.log(`[GradingWorker] Grading submission ${sub.id} (type: ${questionType}, question: ${sub.questionId})`)

          const content = sub.content as { answer?: string } | null
          const userAnswer = content?.answer ?? ""
          const maxScore = sub.question.score
          // 物理实验题的题面在题组材料里（单题 content 为空），其余题型仍用单题题干
          const stem = gradingStem(questionType, sub.question.content, sub.groupSubmission?.questionGroup?.content ?? "")

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
            stem,
            userAnswer,
            sub.question.answer,
            maxScore,
          )

          // 语文作文的「这次不该出分」（学生写的是记叙文，v1.5 只量议论文）：终态 skipped。
          // 它不是批改失败 —— 不写分数、**不消耗**下面的失败重试次数；管理员点「重评」会重新排队。
          if (result.skip) {
            await prisma.questionSubmission.updateMany({
              where: { id: sub.id, gradingStatus: "pending" },
              data: {
                score: null,
                isCorrect: null,
                gradingStatus: "skipped",
                aiFeedback: buildEssaySkipFeedback(result.skip.reason, result.feedback ?? "") as any,
              },
            })
            console.log(`[GradingWorker] ${sub.id} skipped: ${result.skip.reason}`)
            essayFailures.delete(sub.id)
            if (sub.groupSubmissionId) updatedGroupIds.add(sub.groupSubmissionId)
            continue
          }

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
          essayFailures.delete(sub.id)
          if (sub.groupSubmissionId) updatedGroupIds.add(sub.groupSubmissionId)
        } catch (error) {
          console.error(`[GradingWorker] Failed to grade ${sub.id}:`, error)
          // 其它题型口径不变：保持 pending，下次轮询重试
          if (!essay) continue

          // 语文作文：失败次数设上限，防止一篇判不动的作文把队列变成「每 10 秒烧 8.8k tokens」的循环
          const attempts = (essayFailures.get(sub.id) ?? 0) + 1
          essayFailures.set(sub.id, attempts)
          if (attempts <= ESSAY_MAX_FAILED_ATTEMPTS) {
            console.warn(
              `[GradingWorker] ${sub.id} 语文作文批改失败（第 ${attempts} 次），保持 pending 继续重试`,
            )
            continue
          }
          essayFailures.delete(sub.id)
          try {
            await prisma.questionSubmission.updateMany({
              where: { id: sub.id, gradingStatus: "pending" },
              data: {
                gradingStatus: "skipped",
                aiFeedback: buildGradingErrorFeedback(
                  "AI 批改暂时失败，本次已跳过；管理员可在作答详情页点「重评」重新排队。",
                ) as any,
              },
            })
            if (sub.groupSubmissionId) updatedGroupIds.add(sub.groupSubmissionId)
            console.warn(
              `[GradingWorker] ${sub.id} 语文作文连续 ${attempts} 次批改失败，已置为 skipped（管理员可「重评」重新排队）`,
            )
          } catch (updateError) {
            console.error(`[GradingWorker] 把 ${sub.id} 标记为 skipped 失败:`, updateError)
          }
        }
      }

      for (const gid of updatedGroupIds) {
        try {
        const allSubs = await prisma.questionSubmission.findMany({
          where: { groupSubmissionId: gid },
          select: { score: true, isCorrect: true, gradingStatus: true },
        })
        // 任选一题（二选一 / 三选一）板块：组分数取「已判分里得分最高的那一题」，不是相加
        const meta = await prisma.questionGroupSubmission.findUnique({
          where: { id: gid },
          select: { testSubmissionId: true, questionGroup: { select: { answerMode: true } } },
        })
        const pickOne = isPickOneMode(meta?.questionGroup?.answerMode)
        let newTotalScore: number
        let newCorrectNum: number
        let newTotalNum: number
        if (pickOne) {
          const agg = aggregatePickOne(allSubs)
          newTotalScore = agg.score
          newCorrectNum = agg.correctNum
          newTotalNum = agg.totalNum
        } else {
          newTotalScore = allSubs.reduce((sum, s) => sum + (s.score ?? 0), 0)
          const gradedSubs = allSubs.filter(s => s.gradingStatus === "graded")
          newCorrectNum = gradedSubs.filter(s => s.isCorrect).length
          newTotalNum = allSubs.length
        }
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