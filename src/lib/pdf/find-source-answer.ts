/**
 * 在「金师邦」素材目录里找某套试卷对应的**参考答案**文件（PDF / DOCX）。
 *
 * 只认文件名里带「参考答案 / 答案 / 评分说明 / 解析」的文件；「含答案」是老卷卷子本体的命名，不算答案文件。
 * 其余规则与 find-source-pdf.ts 一致：先精确匹配，再按相似度兜底，并排除卷别/学期对不上的候选。
 * 找不到就返回 null（界面上不显示「下载答案」按钮）。
 */
import path from "node:path"
import {
  ANSWER_EXT_RE,
  SUBJECT_ROOT,
  TYPES,
  answerContentType,
  conflicts,
  isAnswerFile,
  isFile,
  listFiles,
  normalize,
  sameExamBatch,
  similarity,
  stripAnswerWords,
} from "./source-match"

interface AnswerEntry {
  file: string
  /** 完整文件名（含扩展名），下载时作 filename* 用 */
  fileName: string
  norm: string
}

const indexCache = new Map<string, AnswerEntry[]>()

function buildIndex(subject: string): AnswerEntry[] {
  const cached = indexCache.get(subject)
  if (cached) return cached

  const entries: AnswerEntry[] = []
  for (const type of TYPES) {
    const dir = path.join(SUBJECT_ROOT, type, subject)
    for (const f of listFiles(dir)) {
      if (!ANSWER_EXT_RE.test(f)) continue
      if (!isAnswerFile(f)) continue
      const full = path.join(dir, f)
      if (!isFile(full)) continue
      const name = f.replace(ANSWER_EXT_RE, "")
      entries.push({ file: full, fileName: f, norm: normalize(stripAnswerWords(name), subject) })
    }
  }
  indexCache.set(subject, entries)
  return entries
}

export interface SourceAnswerMatch {
  file: string
  fileName: string
  /** 小写扩展名（pdf / docx） */
  ext: string
  contentType: string
  score: number
  exact: boolean
}

/** 找到与标题最匹配的参考答案文件；阈值以下视为找不到 */
export function findSourceAnswer(title: string, subject: string): SourceAnswerMatch | null {
  const target = normalize(title, subject)
  if (!target) return null
  const all = buildIndex(subject)
  if (!all.length) return null
  // 先剔掉卷别/学期对不上的候选（期中 ≠ 期末、上 ≠ 下），避免把上期末的答案配给期中卷；
  // 年份 / 区县对不上的也剔掉（标题只差年份/区县时相似度也很高，模糊兜底会配错）
  const entries = all.filter(
    (e) =>
      !conflicts(title, e.fileName) && !conflicts(title, e.norm) && sameExamBatch(title, e.fileName),
  )
  if (!entries.length) return null

  const toMatch = (e: AnswerEntry, score: number, exact: boolean): SourceAnswerMatch => {
    const ext = path.extname(e.fileName).slice(1).toLowerCase()
    return { file: e.file, fileName: e.fileName, ext, contentType: answerContentType(ext), score, exact }
  }

  const exact = entries.find((e) => e.norm === target)
  if (exact) return toMatch(exact, 1, true)

  // 包含关系（标题是文件名一部分，或反之）
  const contains = entries.find((e) => e.norm.includes(target) || target.includes(e.norm))
  if (contains) return toMatch(contains, similarity(contains.norm, target), false)

  let best: AnswerEntry | null = null
  let bestScore = 0
  for (const e of entries) {
    const score = similarity(e.norm, target)
    if (!best || score > bestScore) {
      best = e
      bestScore = score
    }
  }
  if (best && bestScore >= 0.82) return toMatch(best, bestScore, false)
  return null
}
