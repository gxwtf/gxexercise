/**
 * 「任选一题」板块（`QuestionGroup.answerMode = 'pick-one'`，如语文作文二选一、微写作三选一）
 *
 * 口径：**只按用户实际作答的那一题计分**；多答也当作一题处理——取已作答里**得分最高**的一条，
 * 不因为多写而扣分。未作答的候选题不写 QuestionSubmission 记录（避免 0 分脏数据、回顾页难看）。
 *
 * 纯函数，服务端路由 / GradingWorker / 前端都能安全引用。
 */

export const ANSWER_MODE_ALL = "all"
export const ANSWER_MODE_PICK_ONE = "pick-one"

/** 该题组是否「任选一题」 */
export function isPickOneMode(answerMode?: string | null): boolean {
  return (answerMode ?? ANSWER_MODE_ALL) === ANSWER_MODE_PICK_ONE
}

/** 组头提示文案：二选一 / 三选一 / 任选一题 */
export function pickOneModeLabel(questionCount: number): string {
  if (questionCount === 2) return "二选一"
  if (questionCount === 3) return "三选一"
  return "任选一题"
}

/** 组头提示全文（写在一个地方，练习页与套卷练习页共用） */
export function pickOneHint(questionCount: number): string {
  return `本组为${pickOneModeLabel(questionCount)}：任选一题作答；批改与计分只算你作答的那一题（多答时取得分最高的一题）。`
}

export interface PickOneRow {
  score: number | null
  isCorrect: boolean | null
}

export interface PickOneAggregate {
  score: number
  correctNum: number
  totalNum: number
}

/**
 * pick-one 组级计分：取「已判分的那一题里得分最高」的一条。
 * - 未判分（pending / skipped，score=null）的行不参与比较；全都没判分时组分为 0；
 * - totalNum 恒为 1（组内只算一题），correctNum = 该题是否判对（主观题由 AI 按满分回写）。
 */
export function aggregatePickOne(rows: PickOneRow[]): PickOneAggregate {
  let best: PickOneRow | null = null
  for (const row of rows) {
    if (typeof row.score !== "number" || !Number.isFinite(row.score)) continue
    if (!best || (best.score as number) < row.score) best = row
  }
  return {
    score: best?.score ?? 0,
    correctNum: best?.isCorrect ? 1 : 0,
    totalNum: 1,
  }
}

/**
 * 回顾页/成绩页用：算出「用户选的是第几题」。
 *
 * 优先取已判分里得分最高的一题（与计分口径一致）；都还没判分时取唯一作答的那一题，
 * 一题都没作答则返回 null（回顾页显示「未选」）。
 */
export function pickIndexFromRows(rows: { questionId: string; score: number | null; isCorrect: boolean | null }[]): string | null {
  let bestScored: { questionId: string; score: number } | null = null
  for (const row of rows) {
    if (typeof row.score === "number" && Number.isFinite(row.score)) {
      if (!bestScored || bestScored.score < row.score) bestScored = { questionId: row.questionId, score: row.score }
    }
  }
  if (bestScored) return bestScored.questionId
  return rows.length === 1 ? rows[0].questionId : (rows[0]?.questionId ?? null)
}
