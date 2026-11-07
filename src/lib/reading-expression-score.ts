/**
 * 阅读表达（reading-expression）的确定性算分。
 *
 * 为什么不直接让模型给总分：40-43 的规则是「信息点 / 冗余 / 划线 / 修改 / 三维度」的算术，
 * 小模型的算术不可靠（2 − 1 − 0.5 偶尔会算成 1）。所以让模型**只输出结构化判断**
 * （哪些信息点答到、哪几处冗余、哪几处语言错误、划线是否完整、三个维度各给几分），
 * 分数一律由本文件按规则算出来：
 *   - 同一份作答永远得到同一个分；
 *   - 最低 0 分，绝不为负；
 *   - 40/41/42 精确到 0.5，43 每个维度精确到 0.5。
 *
 * 对应的 prompt 见 src/lib/grading-prompts/reading-expression/。
 */

export type ScoringKind = "info-points" | "underline-fix" | "essay-weights"

export interface ScoredResult {
  score: number
  feedback?: string
  subScores?: Record<string, number>
}

/** 冗余 / 语言错误的单处扣分 */
const PENALTY = 0.5
/** 语言错误（语法、拼写、时态…）在 40-42 最多扣的分 */
const MAX_LANGUAGE_PENALTY = 1

const half = (n: number) => Math.round(n * 2) / 2
const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n))

function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

/** 只保留非空字符串，数组外的值一律当空 */
function toStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(toStr).filter((s) => s.length > 0)
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : Number.NaN
  return Number.isFinite(n) ? n : Number.NaN
}

/** 分数的可读写法：2 → "2"，0.5 → "0.5" */
const fmt = (n: number) => String(Math.round(n * 100) / 100)

interface Fallback {
  score: number
  feedback?: string
}

/**
 * 40/41：信息点制，满分 2 分。
 *   每个信息点分值 = 满分 ÷ 信息点个数
 *   缺一个信息点扣掉它的分值；多余/说错的信息点每处 −0.5；语言错误每处 −0.5（最多 −1）
 */
function scoreInfoPoints(raw: Record<string, unknown>, maxScore: number, fallback?: Fallback): ScoredResult {
  const points = toStrArray(raw.infoPoints)
  const hitsIn = Array.isArray(raw.hit) ? raw.hit.map((h) => h === true) : []
  // 信息点个数：以 infoPoints 为准；模型漏写 infoPoints 时退回 hit 的长度
  const count = Math.max(points.length, hitsIn.length, 1)
  const hits = Array.from({ length: count }, (_, i) => hitsIn[i] === true)
  const missedIndexes = hits.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0)

  const perPoint = maxScore / count
  const redundant = toStrArray(raw.redundant)
  const grammar = toStrArray(raw.grammarErrors)

  const rawScore =
    maxScore -
    missedIndexes.length * perPoint -
    redundant.length * PENALTY -
    Math.min(grammar.length, Math.round(MAX_LANGUAGE_PENALTY / PENALTY)) * PENALTY

  const score = clamp(half(rawScore), maxScore)

  const reasons: string[] = []
  if (missedIndexes.length > 0) {
    const names = missedIndexes.map((i) => points[i]).filter(Boolean)
    reasons.push(
      `缺信息点 ${missedIndexes.length} 处（每处 ${fmt(perPoint)} 分）` +
        (names.length ? `：${names.join("；")}` : ""),
    )
  }
  if (redundant.length > 0) {
    reasons.push(`多余/说错的信息 ${redundant.length} 处（每处 ${PENALTY} 分）：${redundant.join("；")}`)
  }
  if (grammar.length > 0) {
    reasons.push(`语言错误 ${grammar.length} 处（每处 ${PENALTY} 分，最多扣 ${MAX_LANGUAGE_PENALTY} 分）：${grammar.join("；")}`)
  }

  return {
    score,
    feedback: score >= maxScore ? "" : toStr(raw.feedback) || reasons.join("；") || fallback?.feedback || "",
  }
}

/**
 * 42：划线 1 分 + 修改 2 分（三档 2/1/0），满分 3 分。
 *   划线必须完整且位置正确才给分；划线错了照样判修改（海淀标准）；
 *   修改里夹带的无关内容每处 −0.5（从修改分里扣）；语言错误每处 −0.5（整题最多 −1）。
 */
function scoreUnderlineFix(raw: Record<string, unknown>, maxScore: number, fallback?: Fallback): ScoredResult {
  const underlineMax = Math.min(1, maxScore)
  const fixMax = maxScore - underlineMax

  const underlineOk = raw.underlineCorrect === true && raw.underlineComplete !== false
  const underlineScore = underlineOk ? underlineMax : 0

  const fixLevelIn = toNum(raw.fixLevel)
  // 三档 0/1/0 之外的值（比如 1.5）就近取整到 0/1/2，再按 fixMax 缩放
  const fixLevel = Number.isNaN(fixLevelIn) ? 0 : clamp(Math.round(fixLevelIn), 2)
  const fixBase = fixMax > 0 ? (fixLevel / 2) * fixMax : 0

  const redundant = toStrArray(raw.redundant)
  const grammar = toStrArray(raw.grammarErrors)

  const fixScore = clamp(fixBase - redundant.length * PENALTY, fixMax)
  const languagePenalty = Math.min(
    grammar.length * PENALTY,
    Math.min(MAX_LANGUAGE_PENALTY, maxScore),
  )

  const score = clamp(half(underlineScore + fixScore - languagePenalty), maxScore)

  const reasons: string[] = []
  if (!underlineOk) {
    reasons.push(
      raw.underlineCorrect === true
        ? `划线不是完整 chunk，划线不得分（−${fmt(underlineMax)}）`
        : `划线位置错误，划线不得分（−${fmt(underlineMax)}）`,
    )
  }
  if (fixLevel < 2) {
    reasons.push(
      fixLevel === 0
        ? `修改没有改对（修改 ${fmt(fixScore)}/${fmt(fixMax)} 分）`
        : `修改只对了一部分（修改 ${fmt(fixScore)}/${fmt(fixMax)} 分）`,
    )
  }
  if (redundant.length > 0) {
    reasons.push(`修改里有无关的多余内容 ${redundant.length} 处（每处 ${PENALTY} 分）：${redundant.join("；")}`)
  }
  if (grammar.length > 0) {
    reasons.push(`语言错误 ${grammar.length} 处（每处 ${PENALTY} 分，最多扣 ${MAX_LANGUAGE_PENALTY} 分）：${grammar.join("；")}`)
  }

  return {
    score,
    feedback: score >= maxScore ? "" : toStr(raw.feedback) || reasons.join("；") || fallback?.feedback || "",
  }
}

/**
 * 43：内容 2 + 语言 2 + 结构 1 = 5 分（按作文的 40% / 40% / 20% 拆）。
 *   每个维度只取 0.5 的整数倍，总分 = 三维之和，精确到 0.5，最低 0 分。
 */
function scoreEssayWeights(raw: Record<string, unknown>, maxScore: number, fallback?: Fallback): ScoredResult {
  const contentMax = Math.round(maxScore * 0.4)
  const languageMax = Math.round(maxScore * 0.4)
  const structureMax = Math.max(0, maxScore - contentMax - languageMax)
  const dims: Array<[string, number]> = [
    ["内容", contentMax],
    ["语言", languageMax],
    ["结构", structureMax],
  ]

  const sub = (raw.subScores && typeof raw.subScores === "object" ? raw.subScores : {}) as Record<string, unknown>
  const scored = dims.map(([key, max]) => {
    const v = toNum(sub[key])
    // 只允许 0.5 粒度（0.25 之类就近取到 0.5），并夹在 [0, 维度满分]
    return Number.isNaN(v) ? Number.NaN : clamp(half(v), max)
  })

  const parsedAny = scored.some((v) => !Number.isNaN(v))
  if (!parsedAny) {
    // 模型没给 subScores：退回它自己给的总分（仍夹在 [0, 满分] 且取 0.5 粒度）
    const fallbackScore = toNum(raw.score)
    const score = Number.isNaN(fallbackScore) ? clamp(half(fallback?.score ?? 0), maxScore) : clamp(half(fallbackScore), maxScore)
    return { score, feedback: score >= maxScore ? "" : toStr(raw.feedback) || fallback?.feedback || "" }
  }

  const values = scored.map((v) => (Number.isNaN(v) ? 0 : v))
  const subScores: Record<string, number> = {}
  dims.forEach(([key], i) => {
    subScores[key] = values[i]
  })
  const score = clamp(half(values.reduce((a, b) => a + b, 0)), maxScore)
  return { score, subScores, feedback: score >= maxScore ? "" : toStr(raw.feedback) || fallback?.feedback || "" }
}

/**
 * 按 kind 把模型的结构化判断折算成最终分。
 *
 * @param kind      题型对应的算分口径（写在 grading-prompts 的 config.json 里）
 * @param raw       模型输出的原始 JSON；解析失败时传 undefined
 * @param maxScore  本题满分
 * @param fallback  解析不出结构化字段时的兜底（一般用模型给的总分/评语）
 */
export function applyStructuredScoring(
  kind: ScoringKind,
  raw: Record<string, unknown> | undefined,
  maxScore: number,
  fallback?: Fallback,
): ScoredResult {
  const safeRaw = raw ?? {}
  switch (kind) {
    case "info-points":
      return scoreInfoPoints(safeRaw, maxScore, fallback)
    case "underline-fix":
      return scoreUnderlineFix(safeRaw, maxScore, fallback)
    case "essay-weights":
      return scoreEssayWeights(safeRaw, maxScore, fallback)
    default:
      return { score: clamp(half(fallback?.score ?? 0), maxScore), feedback: fallback?.feedback }
  }
}
