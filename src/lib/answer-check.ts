/**
 * 客观题答案判定（统一入口）
 *
 * 之前直接用 `userAnswer === correctAnswer` 比较，只要学生答案多一个空格、
 * 大小写不同、或用了全角字符就会被判错（实测「the loneliest 」多了个尾随空格 → 判错）。
 * 这里统一做规范化后再比较：
 * - 不换行空格 / 连续空格 / 首尾空格
 * - 大小写（**默认忽略**；语法填空、选词填空等以单词为答案的题型必须区分大小写，
 *   用 `isCaseSensitiveAnswer()` 判定后传 `caseSensitive: true`）
 * - 全角字母、全角括号、全角逗号等 → 半角
 * - 选择题/七选五：忽略分隔符（B,D / B D / BD 视为同一答案）
 * 正确答案支持用 "##" 分隔多个可接受写法。
 */

/**
 * 判分必须区分大小写的题组类型。
 *
 * 语法填空（grammar）、选词填空（word-choice）的答案本身是单词/短语，
 * 「With / with」「China / china」是不同的答案，不能因为大小写不同就判对。
 * 选择题（choice / single / multiple）的答案是选项字母，大小写没有意义，仍然忽略。
 */
const CASE_SENSITIVE_GROUP_TYPES = new Set(["grammar", "word-choice"])

/**
 * 「只是选项字母」的答案（"a" / "A" / "H" / "K"），大小写无意义。
 *
 * 不能只写 A-G：选词填空的语料框常见 A-K（实测答案里有 H/I/J/K），
 * 只豁免 a-g 会让同一个语料框里「a-g 不区分大小写、H-K 区分」，学生无从预期。
 */
const OPTION_LETTER_ONLY = /^[A-Za-z]$/

/** 判断某道题是否属于「以单词/短语作答」的题型（语法填空、选词填空） */
function isWordAnswerType(questionType?: string | null, groupType?: string | null): boolean {
  const group = (groupType ?? "").trim()
  if (CASE_SENSITIVE_GROUP_TYPES.has(group)) return true
  // 兜底：库里 questionType/questionGroup.questionType 也可能直接写中文题型名
  const combined = `${questionType ?? ""} ${group}`
  return combined.includes("语法填空") || combined.includes("选词填空")
}

/**
 * 该题判分是否必须「区分大小写」。
 *
 * - 只有语法填空 / 选词填空这类以单词作答的题型才区分大小写；
 * - 但若正确答案本身就是选项字母（少数选词填空按选项字母作答），
 *   字母大小写仍然没有意义，仍按大小写不敏感处理。
 */
export function isCaseSensitiveAnswer(
  questionType?: string | null,
  groupType?: string | null,
  correctAnswer?: string | null,
): boolean {
  if (!isWordAnswerType(questionType, groupType)) return false
  const candidates = splitCorrectAnswers(correctAnswer)
  if (candidates.length === 0) return false
  // 有一个备选答案是单词 → 就必须区分大小写
  return candidates.some((candidate) => !OPTION_LETTER_ONLY.test(candidate))
}

export interface AnswerCompareOptions {
  /** true = 区分大小写（语法填空、选词填空）；默认 false */
  caseSensitive?: boolean
}

/** 全角转半角（只处理常见字符，避免影响中文） */
function toHalfWidth(input: string): string {
  return input
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ")
}

/** 规范化：用于比较 */
export function normalizeAnswer(
  answer: string | null | undefined,
  options?: AnswerCompareOptions,
): string {
  if (!answer) return ""
  const normalized = toHalfWidth(String(answer))
    .replace(/\u00a0/g, " ")     // 不换行空格
    .replace(/\s+/g, " ")        // 连续空白压成一个
    .trim()
  return options?.caseSensitive ? normalized : normalized.toLowerCase()
}

/** 选择题等：把 B,D / B D / b、d 统一成 "bd"（大小写是否忽略由 options 决定） */
export function normalizeChoiceAnswer(
  answer: string | null | undefined,
  options?: AnswerCompareOptions,
): string {
  return normalizeAnswer(answer, options).replace(/[\s,;、，；/|]+/g, "")
}

/** 正确答案可能的多种写法 */
export function splitCorrectAnswers(correctAnswer: string | null | undefined): string[] {
  return String(correctAnswer ?? "")
    .split("##")
    .map((x) => x.trim())
    .filter(Boolean)
}

/**
 * 判断作答是否正确
 *
 * 默认忽略大小写/空格/全角、忽略选择题分隔符；
 * 语法填空、选词填空这类题要传 `{ caseSensitive: true }`（用 `isCaseSensitiveAnswer()` 判定）。
 */
export function isAnswerCorrect(
  userAnswer: string | null | undefined,
  correctAnswer: string | null | undefined,
  options?: AnswerCompareOptions,
): boolean {
  const candidates = splitCorrectAnswers(correctAnswer)
  if (candidates.length === 0) return false
  const user = normalizeChoiceAnswer(userAnswer, options)
  if (!user) return false
  return candidates.some((c) => normalizeChoiceAnswer(c, options) === user)
}
