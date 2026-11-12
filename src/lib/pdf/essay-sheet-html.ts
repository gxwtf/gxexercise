/**
 * 「AI 批阅单」的 PDF 片段（单题回顾 PDF 与套卷 / 题组分析报告共用）。
 *
 * 与网页版（src/components/review/EssaySheet.tsx）同一纪律：只输出学生可见的
 * 分数 / 档位 / 分数段 / 判词 / 修改建议 / 最该动的地方 / 字数。
 * A/B/C/D/L 条款编号、命中条数、起点分、上限、扣分算式（EssayReviewInternal）
 * **在 PDF 里一个字都不出现** —— 这里只接受 toPublicEssayReview() 剥过的结构。
 *
 * 注意：这两份 PDF 都是「HTML 字符串 → LibreOffice 转 PDF」，所有文本必须过 esc()；
 * 配色写在各自页面外壳的 <style> 里（soffice.ts / report-doc.ts），本文件不带色值。
 */
import {
  ESSAY_RUBRIC_VERSION,
  sanitizeEssaySuggestion,
  toPublicEssayReview,
  type EssayReviewPublic,
} from "@/lib/essay-review"

const esc = (s: unknown) =>
  String(s ?? "").replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m] as string))

const fmtNum = (value: number) => (Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10))

/** 挖掉条款编号 / 算式后，再收拾挖空处留下的空白（与网页版 EssaySheet 的 cleanText 一致） */
const cleanText = (text: string) =>
  sanitizeEssaySuggestion(text)
    .replace(/([，、；：])\s+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()

/**
 * 从库里的 aiFeedback.essayReview 取「学生可见 + 已清洗」的批阅结果。
 * 不是作文 / 还没批完 / 结构不完整时返回 null（调用方据此整块跳过，不印空表）。
 */
export function essayReviewOf(value: unknown): EssayReviewPublic | null {
  const pub = toPublicEssayReview(value)
  if (!pub) return null
  // 与网页版同样的兜底：把模型偶尔漏出来的条款编号 / 算式痕迹挖掉
  const verdict = cleanText(pub.verdict)
  const direction = cleanText(pub.direction)
  const suggestions = pub.suggestions
    .map((item) => cleanText(item))
    .filter((item) => item.length > 0)
  if (!verdict && !direction && suggestions.length === 0) return null
  return { ...pub, verdict, direction, suggestions }
}

/** 批阅单正文（不含标题；标题由调用方按自己的章节编号体系加） */
export function essaySheetBodyHtml(review: EssayReviewPublic): string {
  // LibreOffice 的 HTML 导入只认 td 的 width 属性（CSS 列宽不生效），按「标签窄 / 值宽」分配
  const cell = (label: string, value: string, strong = false) =>
    `<td class="k" width="16%">${esc(label)}</td><td class="c${strong ? " strong" : ""}" width="34%">${esc(value)}</td>`

  const parts: string[] = []
  parts.push(
    `<table class="sheet-essay" border="1" cellpadding="5" cellspacing="0" width="100%">` +
      `<tr>${cell("得分", `${fmtNum(review.score)} / ${fmtNum(review.maxScore)}`, true)}${cell("档位", review.band)}</tr>` +
      `<tr>${cell("分数段", review.range)}${cell("字数", review.wordCount > 0 ? `${review.wordCount} 字` : "-")}</tr>` +
      `</table>`
  )

  if (review.verdict) parts.push(`<p class="essay-verdict">${esc(review.verdict)}</p>`)

  if (review.suggestions.length > 0) {
    const items = review.suggestions.map((item) => `<li>${esc(item)}</li>`).join("")
    parts.push(`<h4>修改建议</h4><ol class="sugg">${items}</ol>`)
  }

  if (review.direction) {
    parts.push(`<p class="essay-direction"><span class="strong">最该动的地方：</span>${esc(review.direction)}</p>`)
  }

  parts.push(`<p class="essay-note">AI 批阅仅供参考，以教师评分为准 · 判分标准 ${esc(ESSAY_RUBRIC_VERSION)}</p>`)
  return parts.join("\n")
}
