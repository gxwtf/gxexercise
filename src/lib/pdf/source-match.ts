/**
 * 「套卷 → 素材目录文件」匹配的公共逻辑（find-source-pdf.ts / find-source-answer.ts 共用）：
 * 素材根目录与卷别列表、卷别/学期冲突判定、文件名规范化与相似度，以及「答案文件」的识别。
 */
import { readdirSync, statSync } from "node:fs"

export const SUBJECT_ROOT = process.env.EXAM_SOURCE_ROOT || "/home/gxwtf/jingshibang/gaozhong"
// 素材目录的卷别（上期中 曾经漏了，导致期中卷匹配不到、被模糊匹配成上期末）
export const TYPES = ["一模", "二模", "上期中", "下期中", "上期末", "下期末", "真题"]

/** 卷别阶段：期中 ≠ 期末、一模 ≠ 二模。标题与文件名阶段不一致时一律不许匹配 */
const STAGE_RULES: Array<[string, RegExp]> = [
  ["一模", /一模|第一次模拟/],
  ["二模", /二模|第二次模拟/],
  ["期中", /期中/],
  ["期末", /期末/],
  ["真题", /真题|高考/],
]

/** 学期：上 ≠ 下（「高三上期中」和「高三下期中」只差一个字，相似度同样很高） */
const TERM_RULES: Array<[string, RegExp]> = [
  ["上", /上期中|上期末/],
  ["下", /下期中|下期末/],
]

/** 取卷名里的卷别阶段（期中 / 期末 / 一模 / 二模 / 真题），没有则 null */
export function examStageOf(name: string): string | null {
  for (const [stage, re] of STAGE_RULES) if (re.test(name)) return stage
  return null
}

/** 取卷名里的学期（上 / 下），没有则 null */
export function examTermOf(name: string): string | null {
  for (const [term, re] of TERM_RULES) if (re.test(name)) return term
  return null
}

const DISTRICT_RE =
  /海淀|西城|东城|朝阳|丰台|石景山|门头沟|房山|通州|顺义|昌平|大兴|怀柔|平谷|密云|延庆|燕山/

/** 取卷名里的区县（海淀 / 西城 / …），没有则 null */
export function districtOf(name: string): string | null {
  return name.match(DISTRICT_RE)?.[0] ?? null
}

/** 取卷名里的 4 位年份（2026），没有则 null */
export function yearOf(name: string): string | null {
  return name.match(/(20\d{2})/)?.[1] ?? null
}

/**
 * 年份 / 区县是不是同一批卷：两边都写得出来、却不一致 → 一定不是同一套卷。
 * 答案匹配必须过这一关：标题只差年份时相似度也有 0.92（2025 海淀 vs 2026 海淀），
 * 只差区县时也有 0.84（西城 vs 海淀），模糊兜底会把别人的答案发出去。
 */
export function sameExamBatch(a: string, b: string): boolean {
  const ya = yearOf(a)
  const yb = yearOf(b)
  if (ya && yb && ya !== yb) return false
  const da = districtOf(a)
  const db = districtOf(b)
  if (da && db && da !== db) return false
  return true
}

/** 标题与候选文件的卷别/学期冲突（两边都取得到、却不相同） */
export function conflicts(title: string, candidate: string): boolean {
  const s1 = examStageOf(title)
  const s2 = examStageOf(candidate)
  if (s1 && s2 && s1 !== s2) return true
  const t1 = examTermOf(title)
  const t2 = examTermOf(candidate)
  if (t1 && t2 && t1 !== t2) return true
  return false
}

/** 规范化：去掉版本后缀、学科名、空白与括号差异，便于比较 */
export function normalize(input: string, subject: string): string {
  return input
    .replace(/（教师版）|\(教师版\)|（反馈卷）|反馈卷|含答案|教师版/g, "")
    .replace(new RegExp(subject, "g"), "")
    .replace(/[（）()【】\[\]\s·・_\-—－]/g, "")
    .replace(/数学|语文|英语|物理|化学/g, "")
    .toLowerCase()
}

/** 编辑距离 */
function distance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

export const similarity = (a: string, b: string) => {
  const len = Math.max(a.length, b.length)
  return len === 0 ? 1 : 1 - distance(a, b) / len
}

/**
 * 答案文件名关键词：参考答案 / 答案 / 评分说明 / 解析。
 * 注意「含答案」是**卷子本体**的老命名（如「2024北京海淀高三（上）期中数学含答案.pdf」），不算答案文件。
 */
const ANSWER_WORD_RE = /参考答案|答案|评分说明|解析/

/** 是否是答案文件（按文件名判断） */
export function isAnswerFile(name: string): boolean {
  return ANSWER_WORD_RE.test(name) && !/含答案/.test(name)
}

/** 去掉文件名里的「答案」类关键词，剩下卷名部分用于和标题比较 */
export function stripAnswerWords(name: string): string {
  return name.replace(/参考答案|答案|评分说明|解析/g, "")
}

/** 答案文件允许的扩展名（PDF 与 Word 都支持；Word 在下载接口里按原格式返回） */
export const ANSWER_EXT_RE = /\.(pdf|docx)$/i

/** 按扩展名给下载接口用的 Content-Type */
export function answerContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case "pdf":
      return "application/pdf"
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    default:
      return "application/octet-stream"
  }
}

/** 在某个卷别目录里列出文件（目录不存在时返回空数组） */
export function listFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

/** 判断完整路径是否普通文件 */
export function isFile(file: string): boolean {
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
}
