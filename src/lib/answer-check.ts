/**
 * 客观题答案判定（统一入口）
 *
 * 之前直接用 `userAnswer === correctAnswer` 比较，只要学生答案多一个空格、
 * 大小写不同、或用了全角字符就会被判错（实测「the loneliest 」多了个尾随空格 → 判错）。
 * 这里统一做规范化后再比较：
 * - 不换行空格 / 连续空格 / 首尾空格
 * - 大小写（英语答案）
 * - 全角字母、全角括号、全角逗号等 → 半角
 * - 选择题/七选五：忽略分隔符（B,D / B D / BD 视为同一答案）
 * 正确答案支持用 "##" 分隔多个可接受写法。
 */

/** 全角转半角（只处理常见字符，避免影响中文） */
function toHalfWidth(input: string): string {
  return input
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ")
}

/** 规范化：用于比较 */
export function normalizeAnswer(answer: string | null | undefined): string {
  if (!answer) return ""
  return toHalfWidth(String(answer))
    .replace(/\u00a0/g, " ")     // 不换行空格
    .replace(/\s+/g, " ")        // 连续空白压成一个
    .trim()
    .toLowerCase()
}

/** 选择题等：把 B,D / B D / b、d 统一成 "bd" */
export function normalizeChoiceAnswer(answer: string | null | undefined): string {
  return normalizeAnswer(answer).replace(/[\s,;、，；/|]+/g, "")
}

/** 正确答案可能的多种写法 */
export function splitCorrectAnswers(correctAnswer: string | null | undefined): string[] {
  return String(correctAnswer ?? "")
    .split("##")
    .map((x) => x.trim())
    .filter(Boolean)
}

/** 判断作答是否正确（默认忽略大小写/空格/全角、忽略选择题分隔符） */
export function isAnswerCorrect(userAnswer: string | null | undefined, correctAnswer: string | null | undefined): boolean {
  const candidates = splitCorrectAnswers(correctAnswer)
  if (candidates.length === 0) return false
  const user = normalizeChoiceAnswer(userAnswer)
  if (!user) return false
  return candidates.some((c) => normalizeChoiceAnswer(c) === user)
}
