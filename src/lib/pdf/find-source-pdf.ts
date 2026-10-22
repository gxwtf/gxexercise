/**
 * 在「金师邦」素材目录里找某套试卷对应的原始 PDF。
 * 文件名与库里的标题常有差异（（教师版）/含答案/反馈卷/学科名/空格/全角括号），
 * 这里做规范化后再匹配：先精确匹配，再按相似度兜底。
 */
import { readdirSync, statSync } from "node:fs"
import path from "node:path"

const SUBJECT_ROOT = process.env.EXAM_SOURCE_ROOT || "/home/gxwtf/jingshibang/gaozhong"
const TYPES = ["一模", "二模", "上期末", "下期末", "真题"]

/** 规范化：去掉版本后缀、学科名、空白与括号差异，便于比较 */
function normalize(input: string, subject: string): string {
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

const similarity = (a: string, b: string) => {
  const len = Math.max(a.length, b.length)
  return len === 0 ? 1 : 1 - distance(a, b) / len
}

interface IndexEntry {
  file: string
  name: string
  norm: string
}

const indexCache = new Map<string, IndexEntry[]>()

function buildIndex(subject: string): IndexEntry[] {
  const cached = indexCache.get(subject)
  if (cached) return cached

  const entries: IndexEntry[] = []
  for (const type of TYPES) {
    const dir = path.join(SUBJECT_ROOT, type, subject)
    let files: string[] = []
    try {
      files = readdirSync(dir)
    } catch {
      continue
    }
    for (const f of files) {
      if (!/\.pdf$/i.test(f)) continue
      const full = path.join(dir, f)
      try {
        if (!statSync(full).isFile()) continue
      } catch {
        continue
      }
      const name = f.replace(/\.pdf$/i, "")
      entries.push({ file: full, name, norm: normalize(name, subject) })
    }
  }
  indexCache.set(subject, entries)
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
  const entries = buildIndex(subject)
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
