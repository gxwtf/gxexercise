/** 把「一次作答的回顾」组织成 PDF 用的 HTML 片段 */
import { markdownToHtml } from "./markdown"

const esc = (s: string) => String(s ?? "").replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m] as string))

export interface ReviewDocInput {
  title: string
  questionIndex: number
  questionType: string
  content: string
  userAnswer: string
  correctAnswer: string
  analysis?: string | null
  scoreText?: string | null
  aiFeedback?: Record<string, unknown> | null
  extraSections?: { heading: string; markdown: string }[]
  generatedAt: string
}

const isEssay = (t: string) => /en-writing|writing|essay|作文/.test(t)

export function reviewDocHtml(input: ReviewDocInput): string {
  const {
    title,
    questionIndex,
    questionType,
    content,
    userAnswer,
    correctAnswer,
    analysis,
    scoreText,
    aiFeedback,
    extraSections = [],
    generatedAt,
  } = input

  const parts: string[] = []
  parts.push(`<h1>${esc(title)}</h1>`)
  parts.push(
    `<p class="meta">第 ${questionIndex} 题${scoreText ? ` · 得分 ${esc(scoreText)}` : ""} · 生成于 ${esc(generatedAt)}</p>`
  )

  parts.push(`<h2>题目</h2>${markdownToHtml(content)}`)
  parts.push(`<h2>我的作答</h2>${userAnswer?.trim() ? markdownToHtml(userAnswer) : "<p>（未作答）</p>"}`)

  if (isEssay(questionType) && aiFeedback) {
    const sub = aiFeedback.subScores as Record<string, number> | undefined
    if (sub) {
      const keys = ["内容", "语言", "结构"].filter((k) => typeof sub[k] === "number")
      if (keys.length) {
        parts.push(
          `<h2>评分明细</h2><table><thead><tr><th>维度</th>${keys.map((k) => `<th>${k}</th>`).join("")}</tr></thead>` +
            `<tbody><tr><td>得分</td>${keys.map((k) => `<td>${sub[k]}</td>`).join("")}</tr></tbody></table>`
        )
      }
    }
    for (const [key, heading] of [
      ["overallComment", "整体评价"],
      ["lineCorrections", "逐句修改"],
      ["corrections", "修改"],
      ["betterExpressions", "更优表达"],
      ["modelEssay", "最终修改稿"],
    ] as const) {
      const val = aiFeedback[key]
      if (typeof val === "string" && val.trim()) {
        parts.push(`<h2>${heading}</h2>${markdownToHtml(val)}`)
      }
    }
  } else {
    if (correctAnswer) parts.push(`<h2>正确答案</h2>${markdownToHtml(correctAnswer)}`)
    if (analysis) parts.push(`<h2>题目解析</h2>${markdownToHtml(analysis)}`)
  }

  for (const s of extraSections) {
    if (s.markdown?.trim()) parts.push(`<h2>${esc(s.heading)}</h2>${markdownToHtml(s.markdown)}`)
  }

  parts.push(`<p class="foot">广学题库 · ${esc(title)}</p>`)
  return parts.join("\n")
}
