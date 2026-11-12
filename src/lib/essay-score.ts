/**
 * 语文大作文（chinese-essay）的**确定性算分** —— jab《北京卷议论文批阅复现规格 v1.5》§4。
 *
 * 为什么不采信模型给的总分：v1.5 的分数是「43 起评 + L 亮点 − B/C/D/A7′ 扣分，再套 A 级上限」的
 * 算术，口径固定到每一条都能机械执行。让模型自己算，它会（a）把公式顺序搞反（先扣分后封顶）、
 * （b）把三段式当 L1 加 2 分、（c）把 A 级当「停止判分」。所以模型**只输出结构化命中判断**
 * （命中哪些编号、A7′ 档位、体裁、判词、建议），分数、档位、区间一律由本文件算出：
 *
 * - 同一篇作文永远得到同一个分（提示词与模型再怎么飘，落到分值上只可能差 4 / 2 / 1 / 0.5 的台阶）；
 * - 字数由程序数（`countEssayWords()`，与做题页 textarea 显示一致），不让模型数；
 * - 模型输出不合格（缺字段 / 不是对象 / 命中编号非法）**直接抛错**，不写假分数进库 ——
 *   Worker 会保持 pending 下次重试（且有失败次数上限，见 grading-worker.ts）。
 *
 * 规格原文：`~/gxwtf_docs/essay-spec-v15/SPEC.md`；对外契约（档位表 / 公开字段 / 清洗函数）：
 * `src/lib/essay-review.ts`；提示词：`src/lib/grading-prompts/chinese-essay/`。
 */

import {
  countEssayWords,
  essayBandOf,
  sanitizeEssaySuggestion,
  ESSAY_RUBRIC_VERSION,
  type EssayReviewInternal,
  type EssayReviewStored,
} from "./essay-review"

/** grading-prompts 的 config.json 里用这个值开启本文件的算分（见 ai-service.gradeWithConfig） */
export const ESSAY_SCORING_KIND = "essay-v15"

/** 该题的算分口径是不是「语文作文 v1.5」 */
export function isEssayScoring(kind: string | null | undefined): boolean {
  return kind === ESSAY_SCORING_KIND
}

// ─────────────────────────────── 条款表 ───────────────────────────────
// 数值全部来自 SPEC，**不要在这里调**；要改口径请先改规格（规格已冻结）。

/** A 级 · 硬伤（10 条，只做上限，不扣分） */
const A_CODES = ["A1", "A2", "A3", "A4", "A5", "A6", "A8", "A9", "A10", "A11"] as const
/** B 级 · 重错（8 条，每条 −4） */
const B_CODES = ["B1", "B2", "B4", "B5", "B6", "B7", "B9", "B12"] as const
/** C 级 · 中错（11 条，每条 −2） */
const C_CODES = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11"] as const
/** D 级 · 微瑕（10 条，每条 −1，合计最多 −3） */
const D_CODES = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10"] as const

/** §11 L 级 · 亮点分值（合计上限 +9） */
const L_POINTS: Record<string, number> = {
  L1: 2,
  L2: 1.5,
  L3: 1.5,
  L4: 1,
  L5: 1,
  L6: 1.5,
  L7: 1.5,
  L9: 1.5,
}

/** 条款存在但**本版未启用**（SPEC §16）：模型写了也不加分，不因此判分失败 */
const L_DISABLED = new Set(["L8", "L10", "L11"])

/** L 合计上限（§11） */
const L_CAP = 9
/** D 级最多计 3 条（§10） */
const D_CAP = 3

/**
 * 由**程序**判定、不接受模型自报的编号：
 * - A7 不在 A 级（以例代议改走 `a7Band` 分级扣分，见 §7）；
 * - A10（<600 字）/ C7（600–699 字）由 `countEssayWords()` 的结果判，模型数不准；
 * - C8（错别字）是 §9 里**唯一分两档**的条款（≥3 处 −1 / ≥6 处 −2），编号本身带不了档位，
 *   所以改由 `counts.c8ErrorCount` 判（见 `resolveC8Penalty()`）。老提示词/老数据没有这个计数时，
 *   退回「模型写了 C8 就按 ≥6 档 −2」的旧行为，不炸。
 */
const A_IGNORED_FROM_MODEL = new Set(["A7", "A10"])
const C_IGNORED_FROM_MODEL = new Set(["C7", "C8"])

/** C 级 · 单条扣分（C8 除外：它按错别字处数分 −1 / −2 两档） */
const C_PENALTY = 2

/** §7 A7′ 档位 → 扣分。`lt-half` 与 `none` 都是 0（不足 1/2 主体段不扣） */
const A7_PENALTY: Record<string, number> = { none: 0, "lt-half": 0, mid: 2, high: 4, all: 6 }

/** 模型可能写出来的 A7′ 档位别名（归一化用） */
const A7_ALIASES: Record<string, string> = {
  none: "none",
  no: "none",
  "0": "none",
  zero: "none",
  "lt-half": "lt-half",
  lt_half: "lt-half",
  lessthanhalf: "lt-half",
  "less-than-half": "lt-half",
  "1/2以下": "lt-half",
  "<1/2": "lt-half",
  mid: "mid",
  middle: "mid",
  "1/2-2/3": "mid",
  "介于1/2与2/3": "mid",
  high: "high",
  ">=2/3": "high",
  "ge-2/3": "high",
  "2/3以上": "high",
  all: "all",
  every: "all",
  whole: "all",
  "全篇": "all",
  "全篇皆例": "all",
}

/** 体裁跳过（不是议论文，v1.5 这把尺子量不了）的落库文案 */
export const ESSAY_SKIP_FEEDBACK = {
  "non-argumentative":
    "这篇是记叙文，AI 批改目前只按北京卷议论文标准（v1.5）判分，本次未评分。",
} as const

export type EssaySkipReason = keyof typeof ESSAY_SKIP_FEEDBACK

// ─────────────────────────────── 输入 / 输出 ───────────────────────────────

export interface EssayScoreInput {
  /** 模型原始 JSON（`GradeResult.raw`）；拿不到 JSON 时传 undefined → 抛错 */
  raw: Record<string, unknown> | undefined
  /** 学生作文原文（字数由它数） */
  userAnswer: string
  /** 题目满分（题库里有 40 / 45 / 48 / 50 / 60 分制） */
  maxScore: number
  /** 模型标识，写进 internal 便于对比不同模型的判分表现 */
  model?: string
  /** 本次模型调用耗时（毫秒） */
  elapsedMs?: number
}

export interface EssayScoredResult {
  status: "scored"
  /** 按题目满分换算后的最终分（= `QuestionSubmission.score`） */
  score: number
  /** v1.5 的 50 分制原始值（档位 / 区间都按它取） */
  scoreFifty: number
  /** 面向学生的纯文本兜底版（判词 + 建议列表；回顾页有结构化渲染） */
  feedback: string
  essayReview: EssayReviewStored
}

export interface EssaySkippedResult {
  status: "skipped"
  /** 落库原因码（写进 `aiFeedback.essaySkipReason`） */
  reason: EssaySkipReason
  /** 面向学生的说明（写进 `aiFeedback.feedback`） */
  message: string
}

export type EssayScoreOutcome = EssayScoredResult | EssaySkippedResult

// ─────────────────────────────── 小工具 ───────────────────────────────

/** 模型输出不合格（缺字段 / 编号非法）：抛错让 Worker 保持 pending 重试，**不要**写假分数 */
class EssayFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EssayFormatError"
  }
}

const fmt = (n: number) => String(Math.round(n * 10) / 10)

function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function truthy(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1"
}

/** "a1（与题干无关）" → { code: "A1", note: "与题干无关" }；识别不出编号时 code 为空 */
function parseCodeEntry(value: unknown): { code: string; note: string } {
  const text = String(value ?? "").trim()
  if (!text) return { code: "", note: "" }
  // NFKC：把全角「Ａ１」「Ｄ１０」这类归一成 ASCII，再统一去掉撇号
  const normalized = text.normalize("NFKC").replace(/[′'’]/g, "").toUpperCase()
  const m = normalized.match(/^([ABCDL])\s*[_\-]?\s*(\d{1,2})/)
  if (!m) return { code: "", note: normalized }
  return { code: `${m[1]}${Number.parseInt(m[2], 10)}`, note: normalized.slice(m[0].length) }
}

/**
 * 读一个「编号数组」字段并校验合法性。
 *
 * @param ignored 允许出现但**一律忽略**的编号（A7 / 由程序判的字数条款）；
 *                不在 `allowed ∪ ignored` 里的编号视为模型胡写 → 抛错。
 */
function readCodes(
  raw: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
  ignored?: Set<string>,
): { codes: string[]; notes: string[] } {
  const value = raw[field]
  if (!Array.isArray(value)) {
    throw new EssayFormatError(`模型输出缺字段 ${field}（应为编号数组，实际 ${JSON.stringify(value)?.slice(0, 80)}）`)
  }
  const allowedSet = new Set(allowed)
  const codes: string[] = []
  const notes: string[] = []
  for (const item of value) {
    if (typeof item !== "string") {
      throw new EssayFormatError(`${field} 里出现非字符串项：${JSON.stringify(item)?.slice(0, 80)}`)
    }
    if (!item.trim()) continue
    const { code, note } = parseCodeEntry(item)
    if (!code || (!allowedSet.has(code) && !ignored?.has(code))) {
      throw new EssayFormatError(`${field} 里出现非法编号「${item}」（不在 v1.5 条款表内）`)
    }
    if (ignored?.has(code)) {
      // A7 走 a7Band；A10 / C7 由程序按字数判 —— 模型写的这两类不算命中
      continue
    }
    if (!codes.includes(code)) codes.push(code)
    if (note) notes.push(`${code}${note}`)
  }
  return { codes, notes }
}

/** 归一化 A7′ 档位；认不出来就抛错（宁可重试，也不要瞎扣 2/4/6 分） */
function parseA7Band(value: unknown): string {
  const text = toStr(value).toLowerCase().replace(/[\s–—−]/g, "-")
  if (!text) {
    throw new EssayFormatError("模型输出缺字段 a7Band")
  }
  const canonical = A7_ALIASES[text] ?? A7_ALIASES[text.replace(/^-+|-+$/g, "")]
  if (!canonical) {
    throw new EssayFormatError(`a7Band 取值非法「${String(value)}」（应为 none / lt-half / mid / high / all）`)
  }
  return canonical
}

/**
 * 模型判的是记叙文吗（v1.5 是议论文专用尺子，记叙文不出分）。
 *
 * `genre` 是**必需键**：北京卷作文题常年是「(1) 议论文 (2) 记叙文，任选一题」，
 * 学生完全可能写记叙文。拿议论文的尺子去量记叙文会稳定掉到二类下 / 三类，
 * 那是误伤，比「不评分」糟得多 —— 所以缺这个字段宁可让这次判分失败重试，也不瞎出分。
 */
function isNarrative(raw: Record<string, unknown>): boolean {
  const genre = toStr(raw.genre)
  if (!genre) throw new EssayFormatError("模型输出缺字段 genre（应为 议论 / 记叙）")
  return /记叙|叙事|叙述|narrative|narrat/i.test(genre)
}

/**
 * C8（错别字）的扣分档位 —— SPEC §9：**≥3 处 −1；≥6 处 −2**。
 *
 * 为什么要单列：`cHits` 只给编号、带不了档位，而这一条是全表唯一分两档的扣分项。
 * 按编号一律 −2 会**系统性多扣 1 分**（且可能跨档，如 42 → 41），所以改由模型只报处数、
 * 程序判档位（与 A10 / C7 同一个思路：能数的条款交给程序）。
 */
function c8PenaltyOf(count: number): 0 | 1 | 2 {
  if (count >= 6) return 2
  if (count >= 3) return 1
  return 0
}

/** 从 `raw.counts.c8ErrorCount` 读错别字处数；缺失/非法时返回 null（= 走兼容路径） */
function readC8Count(raw: Record<string, unknown>): { value: number | null; note?: string } {
  const counts = raw.counts
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) return { value: null }
  const v = (counts as Record<string, unknown>).c8ErrorCount
  if (v === undefined || v === null || v === "") return { value: null }
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : Number.NaN
  if (!Number.isFinite(n)) {
    return { value: null, note: `counts.c8ErrorCount 非法（${JSON.stringify(v)}），已忽略` }
  }
  const value = Math.max(0, Math.floor(n))
  return { value, note: n !== value ? `counts.c8ErrorCount=${n} 已取整为 ${value}` : undefined }
}

/** 模型是否还在 cHits 里写了 C8（老提示词会写；新版由 counts.c8ErrorCount 取代） */
function modelReportedC8(raw: Record<string, unknown>): boolean {
  const value = raw.cHits
  if (!Array.isArray(value)) return false
  return value.some((item) => typeof item === "string" && parseCodeEntry(item).code === "C8")
}

function readEvidence(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const out: Record<string, string> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const text = toStr(item)
    if (key && text) out[key] = text
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** 学生可见的纯文本兜底版：判词 + 建议列表 + 最该动的一处（**不含任何条款编号**） */
function buildFeedbackText(verdict: string, suggestions: string[], direction: string): string {
  const lines: string[] = [verdict]
  if (suggestions.length > 0) {
    lines.push("", "修改建议：")
    suggestions.forEach((item, i) => lines.push(`${i + 1}. ${item}`))
  }
  if (direction) lines.push("", `最该改的一处：${direction}`)
  return lines.join("\n").trim()
}

// ─────────────────────────────── 主函数 ───────────────────────────────

/**
 * 把模型的结构化命中判断算成最终分数与批阅结果。
 *
 * 抛错（`EssayFormatError`）= 模型输出不可用，调用方应让该条作答保持 pending 重试。
 * 返回 `status: "skipped"` = 体裁不是议论文，**终态跳过**（不算失败，不消耗重试次数）。
 */
export function computeEssayScore(input: EssayScoreInput): EssayScoreOutcome {
  const raw = input.raw
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new EssayFormatError("模型没有输出 JSON 对象，无法按 v1.5 算分")
  }

  const userAnswer = input.userAnswer ?? ""
  const maxScore =
    Number.isFinite(input.maxScore) && input.maxScore > 0 ? input.maxScore : 50
  const wordCount = countEssayWords(userAnswer)

  // ① 体裁闸门：记叙文用 v1.5（议论文尺子）判会误伤到二类下 / 三类，直接不出分，交管理员人工处理
  if (isNarrative(raw)) {
    return {
      status: "skipped",
      reason: "non-argumentative",
      message: ESSAY_SKIP_FEEDBACK["non-argumentative"],
    }
  }

  // ② 九个键必须齐全（提示词明令输出；缺了就是模型没照做，写个分进去比不写更糟）
  //    genre 已在上面单独校验（它是「要不要出分」的闸门，比其他字段更要紧）
  for (const key of [
    "aHits",
    "a7Band",
    "lHits",
    "bHits",
    "cHits",
    "dHits",
    "verdict",
    "suggestions",
    "direction",
  ]) {
    if (!(key in raw)) throw new EssayFormatError(`模型输出缺字段 ${key}`)
  }

  const aRead = readCodes(raw, "aHits", A_CODES, A_IGNORED_FROM_MODEL)
  const a7Band = parseA7Band(raw.a7Band)
  const lRead = readCodes(raw, "lHits", [...Object.keys(L_POINTS), ...L_DISABLED] as string[], L_DISABLED)
  const bRead = readCodes(raw, "bHits", B_CODES)
  const cRead = readCodes(raw, "cHits", C_CODES, C_IGNORED_FROM_MODEL)
  const dRead = readCodes(raw, "dHits", D_CODES)

  // C8 单独判档：有 counts.c8ErrorCount 就以它为准（模型误写 cHits 里的 C8 忽略）；
  // 没有这个计数则退回旧行为（写了 C8 就按 ≥6 档 −2），保证老提示词/老数据不会炸。
  const c8Read = readC8Count(raw)
  const c8FromModel = modelReportedC8(raw)
  const c8Count = c8Read.value
  const c8Penalty = c8Count !== null ? c8PenaltyOf(c8Count) : c8FromModel ? 2 : 0
  const c8Note =
    c8Count !== null
      ? `C8 按 counts.c8ErrorCount=${c8Count} 判：${c8Penalty > 0 ? `−${c8Penalty}` : "不足 3 处，不计"}`
      : c8FromModel
        ? "C8 缺 counts.c8ErrorCount，退回按 ≥6 档执行（−2）"
        : c8Read.note ?? ""

  // ③ 字数条款：只有 **50 分制**的题才套（题库里 40 / 45 / 48 / 60 分制的老题字数要求各不相同，
  //    套 v1.5 的 600 / 700 阈值会平白扣分；分数最后按满分等比换算，档位仍按 50 分制给）
  const appliesWordRule = Math.abs(maxScore - 50) < 1e-9
  const aHits = [...aRead.codes]
  // cBase = 按编号计 −2 的 C 级（含程序补的 C7）；C8 不进这里，它按处数分档
  const cBase = [...cRead.codes]
  if (appliesWordRule) {
    if (wordCount < 600) aHits.push("A10")
    else if (wordCount < 700) cBase.push("C7")
  }
  const cHits = c8Penalty > 0 ? [...cBase, "C8"] : [...cBase]
  const cPenalty = C_PENALTY * cBase.length + c8Penalty

  // ④ §4 公式，顺序不可交换
  const lRaw = lRead.codes.reduce((sum, code) => sum + (L_POINTS[code] ?? 0), 0)
  const lTotal = Math.min(lRaw, L_CAP)
  const base = 43 + lTotal
  const baseCapped = Math.min(base, 50)
  const a7Penalty = A7_PENALTY[a7Band] ?? 0
  const dCount = Math.min(dRead.codes.length, D_CAP)
  const deducted =
    baseCapped - 4 * bRead.codes.length - cPenalty - 1 * dCount - a7Penalty
  // .5 向上取整（43 + 1.5 − … 只会出现 .5），减 1e-9 防浮点误差把 44 抬成 45
  const scoreBeforeCaps = Math.max(0, Math.ceil(deducted - 1e-9))
  let scoreFifty = scoreBeforeCaps

  // ⑤ 第六步：A 级上限（A 级是上限，不是「停止判分」）
  const caps: string[] = []
  const applyCap = (cap: number, label: string) => {
    if (scoreFifty > cap) {
      scoreFifty = cap
      caps.push(`${label} → ${cap}`)
    }
  }
  if (aHits.length >= 3) applyCap(32, `A 级 ${aHits.length} 条`)
  else if (aHits.length === 2) applyCap(35, "A 级 2 条")
  else if (aHits.length === 1) applyCap(39, "A 级 1 条")

  const a1Unrelated =
    truthy(raw.a1Unrelated) || aRead.notes.some((note) => /^A1.*(无关|离题|不符)/.test(note))
  const a2Pervasive =
    truthy(raw.a2Pervasive) || aRead.notes.some((note) => /^A2.*(贯穿|通篇|全文)/.test(note))
  if (aHits.includes("A1") && a1Unrelated) applyCap(32, "A1 与题干毫无关系")
  if (aHits.includes("A2") && a2Pervasive) applyCap(32, "A2 贯穿全文")
  if (a7Band === "all") applyCap(39, "A7′ 全篇皆例")
  if (appliesWordRule && wordCount < 400) applyCap(25, `字数 ${wordCount} < 400`)

  // ⑥ 非 50 分制：按 50 分制结果等比换算，取 0.5 粒度（档位仍按 50 分制档位给）
  const exact = (scoreFifty * maxScore) / 50
  const score = Math.min(maxScore, Math.max(0, Math.round(exact * 2) / 2))
  const band = essayBandOf(scoreFifty)

  // ⑦ 学生可见文本
  const verdict = toStr(raw.verdict)
  if (!verdict) throw new EssayFormatError("模型输出的 verdict 为空")
  if (!Array.isArray(raw.suggestions)) {
    throw new EssayFormatError("模型输出的 suggestions 不是数组")
  }
  if (raw.suggestions.some((item) => typeof item !== "string")) {
    throw new EssayFormatError("模型输出的 suggestions 里出现非字符串项")
  }
  const suggestions = (raw.suggestions as string[])
    .map((item) => sanitizeEssaySuggestion(item))
    .filter((item) => item.length > 0)
  const direction = toStr(raw.direction)

  // ⑧ 算式留痕（管理员 / 排查用，绝不下发学生）
  const parts: string[] = []
  parts.push(
    `L=${fmt(lRaw)}${lRaw > L_CAP ? `（封顶 ${L_CAP}）` : ""}` +
      (lRead.codes.length > 0 ? `（${lRead.codes.join("、")}）` : ""),
  )
  parts.push(`43+${fmt(lTotal)}=${fmt(base)}`)
  parts.push(`封顶 50 → ${fmt(baseCapped)}`)
  const terms: string[] = []
  if (bRead.codes.length > 0) terms.push(`−4×${bRead.codes.length}（${bRead.codes.join("、")}）`)
  if (cBase.length > 0) terms.push(`−${C_PENALTY}×${cBase.length}（${cBase.join("、")}）`)
  if (c8Penalty > 0) {
    terms.push(`−${c8Penalty}（C8：${c8Count !== null ? `${c8Count} 处错别字` : "旧口径 ≥6 档"}）`)
  }
  if (dRead.codes.length > 0) {
    terms.push(
      `−1×${dCount}（${dRead.codes.join("、")}${dRead.codes.length > D_CAP ? `，${dRead.codes.length} 条最多计 ${D_CAP}` : ""}）`,
    )
  }
  if (a7Penalty > 0) terms.push(`−${a7Penalty}（A7′=${a7Band}）`)
  parts.push(terms.length > 0 ? terms.join(" ") : "无扣分")
  if (c8Note) parts.push(c8Note)
  parts.push(`= ${fmt(deducted)}`)
  parts.push(`取整 → ${scoreBeforeCaps}`)
  if (caps.length > 0) parts.push(`上限 ${caps.join("；")}`)
  if (aHits.length > 0) parts.push(`A 级命中 ${aHits.join("、")}（共 ${aHits.length} 条）`)
  // 主体段数是 A7′ 的分母，模型给了就留痕（可选字段，缺了不影响算分）
  const mainBodyCount = Number.parseInt(toStr(raw.mainBodyCount), 10)
  if (Number.isFinite(mainBodyCount) && mainBodyCount > 0) parts.push(`主体段 ${mainBodyCount}`)
  if (!appliesWordRule) {
    parts.push(`字数 ${wordCount}（满分 ${maxScore} ≠ 50，不套字数条款）`)
    parts.push(`50 分制 ${scoreFifty} × ${maxScore}/50 → ${score}`)
  } else {
    parts.push(`字数 ${wordCount}`)
  }
  parts.push(`〔${ESSAY_RUBRIC_VERSION}〕`)

  const coreConcept = toStr(raw.coreConcept)
  const propositionType = toStr(raw.type) || toStr(raw.propositionType)
  const evidence = readEvidence(raw.evidence)
  const internal: EssayReviewInternal = {
    aHits,
    a7Band,
    lHits: lRead.codes,
    bHits: bRead.codes,
    cHits,
    dHits: dRead.codes,
    formula: parts.join(" → "),
    caps,
    ...(coreConcept ? { coreConcept } : {}),
    ...(propositionType ? { propositionType } : {}),
    ...(evidence ? { evidence } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(Number.isFinite(input.elapsedMs) ? { elapsedMs: input.elapsedMs } : {}),
  }

  const essayReview: EssayReviewStored = {
    score,
    maxScore,
    band: band.band,
    range: band.range,
    verdict,
    suggestions,
    direction,
    wordCount,
    internal,
  }

  return {
    status: "scored",
    score,
    scoreFifty,
    feedback: buildFeedbackText(verdict, suggestions, direction),
    essayReview,
  }
}
