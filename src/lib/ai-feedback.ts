/**
 * 落库用的 AI 反馈（`QuestionSubmission.aiFeedback`）的唯一构造点。
 *
 * 为什么单独成文件：这段「哪些字段要落库」的口径原本在三个地方各抄了一份
 * （`grading-worker.ts` / `api/ai/retry-pending` / `api/ai/grade-reading-expression`），
 * 三份代码记的字段数不一样就出过「Worker 判的作文有评语、管理员点重试判的没有」这种事。
 * 语文大作文接入时又多了 `essayReview`（且**绝不能**把 `raw` 落库：那是算分中间数据，
 * 里面有 A/B/C/D/L 编号与算式，落进 aiFeedback 就有被下发到学生页面的风险），
 * 所以合并成这一份，三处一律 import。
 *
 * 注意：`raw` 故意不落库（阅读表达的三维度已经折算进 `subScores`，语文作文的结构化结果
 * 已经收进 `essayReview`，留痕字段都在 `essayReview.internal`）。
 */

import type { GradeResult } from "./ai-service"

/** 把 GRADE_RESULT 折成落库对象；一个字段都没有时返回 undefined（Prisma 会忽略该字段） */
export function buildAiFeedback(result: GradeResult): Record<string, unknown> | undefined {
  const data: Record<string, unknown> = {}
  if (result.feedback) data.feedback = result.feedback
  if (result.subScores) data.subScores = result.subScores
  if (result.overallComment) data.overallComment = result.overallComment
  if (result.lineCorrections) data.lineCorrections = result.lineCorrections
  if (result.betterExpressions) data.betterExpressions = result.betterExpressions
  if (result.modelEssay) data.modelEssay = result.modelEssay
  if (result.essayReview) data.essayReview = result.essayReview
  return Object.keys(data).length > 0 ? data : undefined
}

/**
 * 「不出分」那条记录的 aiFeedback（目前只有语文大作文的记叙文会用到）。
 *
 * 两个约定字段：
 * - `feedback`：给学生看的说明（回顾页直接显示）；
 * - `essaySkipReason`：给程序 / 管理员看的原因码（如 `"non-argumentative"`），
 *   前端据此显示「这篇为什么不评分」。**不要**在这里放分数。
 */
export function buildEssaySkipFeedback(reason: string, message: string): Record<string, unknown> {
  return { feedback: message, essaySkipReason: reason }
}

/**
 * 语文作文批改失败达到重试上限时的 aiFeedback（见 grading-worker.ts 的失败计数）。
 *
 * `gradingError: true` 让界面能区分「AI 反复失败、这次放弃了」和「本来就不批阅的题型」。
 */
export function buildGradingErrorFeedback(message: string): Record<string, unknown> {
  return { feedback: message, gradingError: true }
}
