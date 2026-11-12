/** 把「一次作答的回顾」组织成 PDF 用的 HTML 片段 */
import { markdownToHtml } from "./markdown"
import { essayReviewOf, essaySheetBodyHtml } from "./essay-sheet-html"

const esc = (s: unknown) => String(s ?? "").replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m] as string))

/** markdown 表格补 HTML 属性：LibreOffice 不认 CSS border，否则表格没边框 */
function mdWithTables(text: string | null | undefined): string {
  const src = String(text ?? "").trim()
  if (!src) return ""
  return markdownToHtml(src).replace(/<table>/g, '<table border="1" cellpadding="5" cellspacing="0" width="100%">')
}

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

  const CN = ["一", "二", "三", "四", "五", "六", "七", "八"]
  let sectionIndex = 0
  const heading = (text: string) => `<h2>${CN[sectionIndex++] ?? sectionIndex}、${esc(text)}</h2>`

  const parts: string[] = []
  parts.push(`<h1>${esc(title)}</h1>`)
  parts.push(
    `<p class="meta">第 ${questionIndex} 题${scoreText ? ` · 得分 ${esc(scoreText)}` : ""} · 生成于 ${esc(generatedAt)}</p>`
  )

  parts.push(`${heading("题目")}${mdWithTables(content)}`)
  parts.push(
    `${heading("我的作答")}${userAnswer?.trim() ? `<div class="ai-md">${mdWithTables(userAnswer)}</div>` : "<p>（未作答）</p>"}`
  )

  if (aiFeedback) {  // 有 AI 批改结果就展示（作文类走下面的分项，生物填空等走通用简评）
    // 语文大作文的 AI 批阅单（v1.5）：这里只印学生可见的分数 / 档位 / 判词 / 修改建议，
    // 条款编号与计分算式（essayReview.internal）在 PDF 里一个字都不出现。
    const essayReview = essayReviewOf(aiFeedback.essayReview)
    if (essayReview) parts.push(`${heading("AI 批阅单")}${essaySheetBodyHtml(essayReview)}`)

    // 明确未评分（记叙文等非议论文，终态）：把后端给的说明原样印出来，避免「什么都没有」
    const essaySkipNote =
      !essayReview && typeof aiFeedback.essaySkipReason === "string"
        ? typeof aiFeedback.feedback === "string"
          ? aiFeedback.feedback.trim()
          : ""
        : ""
    if (essaySkipNote) parts.push(`${heading("AI 批阅")}<p class="essay-note">${esc(essaySkipNote)}</p>`)

    const sub = aiFeedback.subScores as Record<string, number> | undefined
    if (sub) {
      const parsedMax = scoreText ? Number(String(scoreText).split("/")[1]) : NaN
      const maxScore = Number.isFinite(parsedMax) ? parsedMax : 0
      const contentMax = Math.round(maxScore * 0.4)
      const languageMax = Math.round(maxScore * 0.4)
      const structureMax = Math.max(0, maxScore - contentMax - languageMax)
      const maxes: Record<string, number> = { 内容: contentMax, 语言: languageMax, 结构: structureMax }
      const keys = ["内容", "语言", "结构"].filter((k) => typeof sub[k] === "number")
      if (keys.length) {
        const total = keys.reduce((n, k) => n + (sub[k] ?? 0), 0)
        parts.push(heading("评分明细"))
        parts.push(
          `<table border="1" cellpadding="5" cellspacing="0" width="100%">` +
            `<thead><tr><th>评分维度</th>${keys.map((k) => `<th>${k}</th>`).join("")}<th>合计</th></tr></thead>` +
            `<tbody>` +
            `<tr><td>得分</td>${keys.map((k) => `<td class="c strong">${sub[k]}</td>`).join("")}<td class="c strong">${Math.round(total * 10) / 10}</td></tr>` +
            `<tr><td>满分</td>${keys.map((k) => `<td class="c">${maxes[k] || "-"}</td>`).join("")}<td class="c">${maxScore || "-"}</td></tr>` +
            `<tr><td>得分率</td>${keys
              .map((k) => `<td class="c">${maxes[k] ? `${Math.round(((sub[k] ?? 0) / maxes[k]) * 100)}%` : "-"}</td>`)
              .join("")}<td class="c">${maxScore ? `${Math.round((total / maxScore) * 100)}%` : "-"}</td></tr>` +
            `</tbody></table>`
        )
      }
    }
    for (const [key, label] of [
      ["overallComment", "整体评价"],
      ["lineCorrections", "逐句修改"],
      ["corrections", "修改"],
      ["betterExpressions", "更优表达"],
      ["modelEssay", "最终修改稿"],
    ] as const) {
      const val = aiFeedback[key]
      if (typeof val === "string" && val.trim()) {
        parts.push(`${heading(label)}<div class="ai-md">${mdWithTables(val)}</div>`)
      }
    }
  } else {
    // 语文大作文的「参考答案」是脏数据（有的录入批次把文言文参考译文塞进了作文题的 answer），
    // 回顾页已整块隐藏，PDF 里同样不印；作文的「参考」由上面的 AI 批阅单承担。
    if (correctAnswer && questionType !== "chinese-essay") {
      parts.push(`${heading("正确答案")}${mdWithTables(correctAnswer)}`)
    }
    if (analysis) parts.push(`${heading("题目解析")}${mdWithTables(analysis)}`)
  }

  for (const s of extraSections) {
    if (s.markdown?.trim()) parts.push(`${heading(s.heading)}${mdWithTables(s.markdown)}`)
  }

  parts.push(`<p class="foot">广学题库 · ${esc(title)}</p>`)
  return parts.join("\n")
}
