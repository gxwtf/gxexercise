/**
 * 在「金师邦」素材目录里找某套试卷对应的原始 PDF。
 * 文件名与库里的标题常有差异（（教师版）/含答案/反馈卷/学科名/空格/全角括号），
 * 这里做规范化后再匹配：先精确匹配，再按相似度兜底。
 *
 * 公共的规范化 / 冲突判定 / 路径常量在 source-match.ts（与 find-source-answer.ts 共用）。
 */
import path from "node:path"
import {
  SUBJECT_ROOT,
  TYPES,
  conflicts,
  isAnswerFile,
  isFile,
  listFiles,
  normalize,
  similarity,
} from "./source-match"

export { examStageOf, examTermOf } from "./source-match"

interface IndexEntry {
  file: string
  name: string
  norm: string
}

const indexCache = new Map<string, IndexEntry[]>()

function buildIndex(subject: string, includeAnswers: boolean): IndexEntry[] {
  const cacheKey = `${subject}|${includeAnswers ? "with-answers" : "papers-only"}`
  const cached = indexCache.get(cacheKey)
  if (cached) return cached

  const entries: IndexEntry[] = []
  for (const type of TYPES) {
    const dir = path.join(SUBJECT_ROOT, type, subject)
    for (const f of listFiles(dir)) {
      if (!/\.pdf$/i.test(f)) continue
      // 参考答案 PDF 默认不能混进来当原卷（否则找不到原卷时可能误配成答案）；
      // 但库里确实有「标题本身就是参考答案」的卷（如 2019丰台/朝阳期末参考答案英语），
      // 那种卷的原卷就是答案文件，由 includeAnswers 放行。
      if (!includeAnswers && isAnswerFile(f)) continue
      const full = path.join(dir, f)
      if (!isFile(full)) continue
      const name = f.replace(/\.pdf$/i, "")
      entries.push({ file: full, name, norm: normalize(name, subject) })
    }
  }
  indexCache.set(cacheKey, entries)
  return entries
}

export interface SourcePdfMatch {
  file: string
  fileName: string
  score: number
  exact: boolean
}

/** 找到与标题最匹配的原始 PDF；阈值以下视为找不到 */
export function findSourcePdf(title: string, subject: string): SourcePdfMatch | null {
  const target = normalize(title, subject)
  if (!target) return null
  // 标题本身就是「参考答案」卷时，原卷只能从答案文件里找（见 buildIndex 注释）
  const all = buildIndex(subject, isAnswerFile(title))
  if (!all.length) return null
  // 先剔掉卷别/学期对不上的候选：否则「期中」会被相似度兜底成「期末」（只差一个字，score≈0.92）
  const entries = all.filter((e) => !conflicts(title, e.name) && !conflicts(title, e.norm))
  if (!entries.length) return null

  const exact = entries.find((e) => e.norm === target)
  if (exact) return { file: exact.file, fileName: `${exact.name}.pdf`, score: 1, exact: true }

  // 包含关系（标题是文件名一部分，或反之）
  const contains = entries.find((e) => e.norm.includes(target) || target.includes(e.norm))
  if (contains) {
    const score = similarity(contains.norm, target)
    return { file: contains.file, fileName: `${contains.name}.pdf`, score, exact: false }
  }

  let best: SourcePdfMatch | null = null
  for (const e of entries) {
    const score = similarity(e.norm, target)
    if (!best || score > best.score) best = { file: e.file, fileName: `${e.name}.pdf`, score, exact: false }
  }
  if (best && best.score >= 0.82) return best
  return null
}
