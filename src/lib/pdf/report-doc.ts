/**
 * 题组 / 套卷 → 「作答分析报告」PDF 用的 HTML
 *
 * 与「纸质作答卷」的区别：作答卷是空白考卷（无答案、留白作答），
 * 分析报告是**批改后**的复盘：总览（得分 / 正确率 / 答题卡）+ 逐题（题目、我的作答、
 * 正确答案、解析、作文 AI 批改三维度与修改稿）+ 错题汇总。
 *
 * 版式约定（打印稿，自带浅色配色，不参与深色模式）：
 * - A4，10.5pt 正文，宋体 + Times New Roman，章节标题带下边框
 * - 表格一律用 HTML 属性（border / cellpadding / width）：LibreOffice 的 HTML 导入
 *   不认 CSS 的 border/border-collapse，只认属性，否则表格会「没有边框」
 * - 小节标题 `break-after: avoid`，避免标题孤立在页底
 */
import { markdownToHtml, inlineToHtml } from "./markdown"

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m] as string))

/** markdown 生成的表格补上属性（否则 LibreOffice 不画边框） */
function withTableAttrs(html: string): string {
  return html.replace(/<table>/g, '<table class="md-table" border="1" cellpadding="5" cellspacing="0" width="100%">')
}

function md(text: string | null | undefined): string {
  const src = String(text ?? "").trim()
  if (!src) return ""
  return withTableAttrs(markdownToHtml(src))
}

/** AI 批改的 Markdown：左对齐（两端对齐会把「行末手动换行」那行拉出巨大词间距） */
function mdAi(text: string | null | undefined): string {
  const src = String(text ?? "").trim()
  if (!src) return ""
  return `<div class="ai-md">${withTableAttrs(markdownToHtml(src))}</div>`
}

export interface ReportOption {
  id: string
  label: string
}

export interface ReportQuestionInput {
  /** 卷面题号（连续编号） */
  number: number
  /** 数据库原始题型 */
  questionType: string
  /** 展示用题型名（中文）；为空时按 questionType 映射 */
  displayType?: string | null
  content: string
  options: ReportOption[]
  /** 我的作答（原始文本；空 = 未作答） */
  userAnswer: string
  correctAnswer: string
  analysis?: string | null
  isCorrect: boolean | null
  score?: number | null
  maxScore?: number | null
  gradingStatus?: string | null
  /** 主观题（作文 / 阅读表达 等）：不参与「答对 / 正确率」统计 */
  subjective?: boolean
  /** 作文等主观题的 AI 批改原始 JSON */
  aiFeedback?: Record<string, unknown> | null
}

export interface ReportSectionInput {
  /** 大题名（套卷：完形填空 …；题组：一般为空） */
  heading?: string
  /** 该节（题组）标题，套卷里用于标明小节来源 */
  groupTitle?: string
  /** 题组材料 / 情境（阅读文章、完形文章 …） */
  material?: string
  questions: ReportQuestionInput[]
}

export interface AnalysisReportInput {
  kind: "group" | "paper"
  title: string
  subject?: string | null
  source?: string | null
  grade?: string | null
  year?: number | null
  /** 作答时间（本地化字符串） */
  submittedAt?: string | null
  /** 用时（秒） */
  durationSeconds?: number | null
  score?: number | null
  totalScore?: number | null
  correctCount?: number | null
  totalCount?: number | null
  sections: ReportSectionInput[]
  generatedAt: string
}

const CHINESE_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五"]

/** 数据库题型 → 卷面题型名 */
const TYPE_LABELS: Record<string, string> = {
  single: "单项选择",
  multiple: "多项选择",
  choice: "选择",
  input: "填空",
  input2: "填空",
  text: "主观题",
  cloze: "完形填空",
  grammar: "语法填空",
  "seven-choose-five": "七选五",
  "word-choice": "选词填空",
  "reading-expression": "阅读表达",
  "en-writing": "英语作文",
  "chinese-essay": "语文大作文",
  "chinese-micro-writing": "微写作",
  "chemistry-image": "化学图片题",
}

function typeLabelOf(q: ReportQuestionInput): string {
  if (q.displayType?.trim()) return q.displayType.trim()
  return TYPE_LABELS[q.questionType] || q.questionType || ""
}

const isEssayType = (t: string) => /en-writing|chinese-essay|writing|essay|作文/.test(t)

/** 单题结果 → 标签 / 符号 / 类名 */
type Status = { label: string; mark: string; cls: string }
function statusOf(q: ReportQuestionInput): Status {
  if (q.subjective) {
    if (q.gradingStatus === "pending") return { label: "待批改", mark: "待", cls: "wait" }
    if (q.score != null) return { label: "已评分", mark: "分", cls: "subj" }
    return { label: "已提交", mark: "—", cls: "none" }
  }
  if (q.isCorrect === true) return { label: "正确", mark: "√", cls: "ok" }
  if (q.isCorrect === false) return { label: "错误", mark: "×", cls: "bad" }
  if (q.gradingStatus === "pending") return { label: "待批改", mark: "待", cls: "wait" }
  if (!String(q.userAnswer ?? "").trim()) return { label: "未作答", mark: "—", cls: "none" }
  return { label: "已批改", mark: "—", cls: "none" }
}

const round1 = (n: number) => Math.round(n * 10) / 10

function fmtDuration(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "-"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s} 秒`
  return `${s} 秒`
}

function allQuestions(input: AnalysisReportInput): ReportQuestionInput[] {
  return input.sections.flatMap((s) => s.questions)
}

/** 头部：标题 + 来源信息 + 成绩栏 */
function headerHtml(input: AnalysisReportInput): string {
  const metaParts = [input.subject, input.source, input.year ? `${input.year} 年` : "", input.grade]
    .filter(Boolean)
    .map((s) => esc(String(s)))

  const questions = allQuestions(input)
  const totalCount = input.totalCount ?? questions.length
  const objective = questions.filter((q) => !q.subjective)
  const subjective = questions.filter((q) => q.subjective)
  const scored = questions.filter((q) => q.maxScore != null && q.maxScore > 0)
  const sumScore = questions.reduce((n, q) => n + (q.score ?? 0), 0)
  const sumMax = scored.reduce((n, q) => n + (q.maxScore ?? 0), 0)
  const score = input.score ?? (scored.length ? sumScore : null)
  const totalScore = input.totalScore ?? (sumMax || null)
  const correctCount = objective.filter((q) => q.isCorrect === true).length
  const pendingCount = questions.filter((q) => q.gradingStatus === "pending").length
  const rate = score != null && totalScore ? Math.round((score / totalScore) * 1000) / 10 : null

  const rows: string[] = []
  rows.push(
    `<tr>` +
      `<td class="k" style="white-space:nowrap">得分</td><td class="v strong">${score != null ? esc(round1(score)) : "-"}${totalScore ? ` / ${esc(round1(totalScore))}` : ""}</td>` +
      `<td class="k" style="white-space:nowrap">得分率</td><td class="v">${rate != null ? `${rate}%` : "-"}</td>` +
      `</tr>`
  )
  if (objective.length) {
    const correctRate = Math.round((correctCount / objective.length) * 1000) / 10
    rows.push(
      `<tr>` +
        `<td class="k" style="white-space:nowrap">客观题答对</td><td class="v">${correctCount} / ${objective.length} 题</td>` +
        `<td class="k" style="white-space:nowrap">正确率</td><td class="v">${correctRate}%</td>` +
        `</tr>`
    )
  }
  if (subjective.length) {
    const subjScore = subjective.reduce((n, q) => n + (q.score ?? 0), 0)
    const subjMax = subjective.reduce((n, q) => n + (q.maxScore ?? 0), 0)
    rows.push(
      `<tr>` +
        `<td class="k" style="white-space:nowrap">主观题</td><td class="v">${subjective.length} 题${subjMax ? `（${esc(round1(subjScore))} / ${esc(round1(subjMax))} 分）` : ""}</td>` +
        `<td class="k" style="white-space:nowrap">统计题数</td><td class="v">${totalCount} 题${pendingCount ? ` · ${pendingCount} 题待批改` : ""}</td>` +
        `</tr>`
    )
  }
  rows.push(
    `<tr>` +
      `<td class="k" style="white-space:nowrap">用时</td><td class="v">${esc(fmtDuration(input.durationSeconds))}</td>` +
      `<td class="k" style="white-space:nowrap">作答时间</td><td class="v">${esc(input.submittedAt || "-")}</td>` +
      `</tr>`
  )

  return [
    `<h1>${esc(input.title)}</h1>`,
    `<p class="meta">${metaParts.length ? metaParts.join(" · ") + " · " : ""}作答分析报告</p>`,
    `<table class="kv" border="1" cellpadding="5" cellspacing="0" width="100%">${rows.join("")}</table>`,
  ].join("\n")
}

/** 答题卡：每行 10 格，标出对/错/待批改/主观题得分 */
function answerSheetHtml(input: AnalysisReportInput, heading: string): string {
  const questions = allQuestions(input)
  const perRow = 10
  const rows: string[] = []
  for (let i = 0; i < questions.length; i += perRow) {
    const slice = questions.slice(i, i + perRow)
    const tds = slice
      .map((q) => {
        const st = statusOf(q)
        const mark = q.subjective && q.score != null ? String(round1(q.score)) : st.mark
        return `<td class="sheet-cell ${st.cls}"><span class="sheet-no">${q.number}</span><span class="sheet-mark">${mark}</span></td>`
      })
      .join("")
    const pad = `<td class="sheet-cell empty"></td>`.repeat(perRow - slice.length)
    rows.push(`<tr>${tds}${pad}</tr>`)
  }
  const legend = `<p class="legend">√ 正确　× 错误　待 待批改　数字 主观题得分　— 未作答/无判定</p>`
  return [
    `<h2>${heading}</h2>`,
    `<table class="sheet" border="1" cellpadding="3" cellspacing="0" width="100%">${rows.join("")}</table>`,
    legend,
  ].join("\n")
}

/** 各大题得分（套卷） */
function sectionScoreTableHtml(sections: ReportSectionInput[]): string {
  const rows = sections
    .map((section, index) => {
      const qs = section.questions
      const sum = qs.reduce((n, q) => n + (q.score ?? 0), 0)
      const max = qs.reduce((n, q) => n + (q.maxScore ?? 0), 0)
      const objective = qs.filter((q) => !q.subjective)
      const right = objective.filter((q) => q.isCorrect === true).length
      const pending = qs.filter((q) => q.gradingStatus === "pending").length
      const name = section.heading || section.groupTitle || `第 ${index + 1} 节`
      const first = qs[0]?.number
      const last = qs[qs.length - 1]?.number
      return (
        `<tr><td>（${CHINESE_NUM[index] ?? index + 1}）${esc(name)}</td>` +
        `<td class="c">${first ?? "-"}–${last ?? "-"}</td>` +
        `<td class="c">${objective.length ? `${right} / ${objective.length}` : "主观题"}</td>` +
        `<td class="c">${pending ? `${pending} 题待批改` : "-"}</td>` +
        `<td class="c">${round1(sum)}${max ? ` / ${round1(max)}` : ""}</td></tr>`
      )
    })
    .join("")
  return (
    `<table class="grid" border="1" cellpadding="5" cellspacing="0" width="100%">` +
    `<tr><th>大题</th><th class="c">题号</th><th class="c">答对</th><th class="c">待批改</th><th class="c">得分</th></tr>${rows}</table>`
  )
}

function scoreDetailHtml(q: ReportQuestionInput, aiFeedback: Record<string, unknown>): string {
  const sub = aiFeedback.subScores as Record<string, number> | undefined
  if (!sub) return ""
  const maxScore = q.maxScore ?? 0
  const contentMax = Math.round(maxScore * 0.4)
  const languageMax = Math.round(maxScore * 0.4)
  const structureMax = Math.max(0, maxScore - contentMax - languageMax)
  const maxes: Record<string, number> = { 内容: contentMax, 语言: languageMax, 结构: structureMax }
  const keys = ["内容", "语言", "结构"].filter((k) => typeof sub[k] === "number")
  if (!keys.length) return ""

  const head = `<tr><th>评分维度</th>${keys.map((k) => `<th class="c">${k}</th>`).join("")}<th class="c">合计</th></tr>`
  const rowScore = `<tr><td>得分</td>${keys.map((k) => `<td class="c strong">${esc(sub[k])}</td>`).join("")}<td class="c strong">${esc(round1(keys.reduce((n, k) => n + (sub[k] ?? 0), 0)))}</td></tr>`
  const rowMax = `<tr><td>满分</td>${keys.map((k) => `<td class="c">${maxes[k] ?? "-"}</td>`).join("")}<td class="c">${maxScore || "-"}</td></tr>`
  const rowRate = `<tr><td>得分率</td>${keys
    .map((k) => {
      const max = maxes[k] ?? 0
      return `<td class="c">${max ? `${Math.round(((sub[k] ?? 0) / max) * 100)}%` : "-"}</td>`
    })
    .join("")}<td class="c">${maxScore ? `${Math.round((keys.reduce((n, k) => n + (sub[k] ?? 0), 0) / maxScore) * 100)}%` : "-"}</td></tr>`

  return (
    `<h4>评分明细</h4>` +
    `<table class="grid" border="1" cellpadding="5" cellspacing="0" width="100%">${head}${rowScore}${rowMax}${rowRate}</table>`
  )
}

const AI_MARKDOWN_SECTIONS: Array<[string, string]> = [
  ["overallComment", "整体评价"],
  ["lineCorrections", "逐句修改"],
  ["corrections", "修改"],
  ["betterExpressions", "更优表达"],
  ["modelEssay", "最终修改稿"],
]

/** 主观题的 AI 批改部分（作文三维度 / 普通主观题评语） */
function aiFeedbackHtml(q: ReportQuestionInput): string {
  const fb = q.aiFeedback
  if (!fb) {
    if (q.gradingStatus === "pending") {
      return `<p class="pending-note">本题由 AI 批改，目前仍在批改队列中，稍后可重新导出本报告查看完整评语。</p>`
    }
    return ""
  }
  const parts: string[] = [`<h4 class="ai-head">AI 批改</h4>`]
  parts.push(scoreDetailHtml(q, fb))

  const feedbackText = typeof fb.feedback === "string" ? fb.feedback.trim() : ""
  if (feedbackText) parts.push(`<h4>评语</h4>${mdAi(feedbackText)}`)

  for (const [key, heading] of AI_MARKDOWN_SECTIONS) {
    const val = fb[key]
    if (typeof val === "string" && val.trim()) {
      parts.push(`<h4>${heading}</h4>${mdAi(val)}`)
    }
  }
  return parts.join("\n")
}

/** 单题块：题号 + 结果 + 题目 + 我的作答 + 正确答案 + 解析 + AI 批改 */
function questionHtml(q: ReportQuestionInput): string {
  const st = statusOf(q)
  const label = typeLabelOf(q)
  const bits: string[] = [`<span class="q-no">${q.number}.</span>`]
  if (label) bits.push(`<span class="qtype">${esc(label)}</span>`)
  bits.push(`<span class="qstate ${st.cls}">${st.label}</span>`)
  if (q.score != null) {
    bits.push(
      `<span class="qscore">得分 ${esc(round1(q.score))}${q.maxScore ? ` / ${esc(round1(q.maxScore))}` : ""}</span>`
    )
  }
  const head = `<h3 class="q-head">${bits.join('<span class="sep">｜</span>')}</h3>`

  const parts: string[] = [head]

  if (q.content?.trim()) parts.push(`<div class="stem">${md(q.content)}</div>`)

  // 图片版题目的选项常常只是占位符（label 就是字母本身，真正的选项画在图片里），印出来是「A. A」这种噪音
  const options = q.options.filter((o) => {
    const label = String(o.label ?? "").trim()
    const id = String(o.id ?? "").trim()
    if (!label) return false
    return !(label.length === 1 && label.toUpperCase() === id.toUpperCase())
  })
  if (options.length) {
    const items = options
      .map(
        (o) =>
          `<div class="opt"><span class="opt-id">${esc(String(o.id || "").toUpperCase())}.</span> ${inlineToHtml(o.label || "")}</div>`
      )
      .join("")
    parts.push(`<div class="opts">${items}</div>`)
  }

  // 我的作答 / 正确答案：单列表格 + 行内粗体标签
  // （LibreOffice 的 HTML 导入不认列宽，分两列会把标签列撑得很宽/竖排折行）
  const userAnswer = String(q.userAnswer ?? "").trim()
  const correct = String(q.correctAnswer ?? "").trim()
  // 短答案（如选项字母、一两个词）直接行内跟着标签，别另起一块
  const inlineAnswer = (text: string) => text.length <= 24 && !text.includes("\n")
  const answerRows: string[] = []
  answerRows.push(
    `<tr><td class="a ${st.cls}"><span class="ans-label">我的作答</span>${
      userAnswer
        ? inlineAnswer(userAnswer)
          ? inlineToHtml(userAnswer)
          : mdAi(userAnswer)
        : `<span class="muted">（未作答）</span>`
    }</td></tr>`
  )
  if (correct) {
    answerRows.push(
      `<tr><td class="a ok"><span class="ans-label">正确答案</span>${
        inlineAnswer(correct) ? inlineToHtml(correct) : md(correct)
      }</td></tr>`
    )
  }
  parts.push(
    `<table class="answers" border="1" cellpadding="5" cellspacing="0" width="100%">${answerRows.join("")}</table>`
  )

  if (q.analysis?.trim()) {
    parts.push(`<div class="analysis"><h4>题目解析</h4>${md(q.analysis)}</div>`)
  }

  if (q.aiFeedback || (q.subjective && q.gradingStatus === "pending")) {
    parts.push(aiFeedbackHtml(q))
  }

  return `<div class="q${isEssayType(typeLabelOf(q)) || isEssayType(q.questionType) ? " q-essay" : ""}">${parts.join("\n")}</div>`
}

function sectionHtml(
  section: ReportSectionInput,
  index: number,
  kind: "group" | "paper"
): string {
  const parts: string[] = []
  const name = kind === "paper" ? section.heading || section.groupTitle : ""
  if (name) {
    const count = section.questions.length
    const first = section.questions[0]?.number
    const last = section.questions[section.questions.length - 1]?.number
    const range = first != null && last != null ? `第 ${first}–${last} 题` : ""
    const extra = [range, count ? `共 ${count} 小题` : ""].filter(Boolean).join("，")
    parts.push(
      `<h2 class="section sub">（${CHINESE_NUM[index] ?? index + 1}）${esc(name)}${
        extra ? `<span class="cnt">（${extra}）</span>` : ""
      }</h2>`
    )
  }

  if (String(section.material ?? "").trim()) {
    parts.push(`<div class="passage">${md(section.material)}</div>`)
  }
  parts.push(section.questions.map(questionHtml).join("\n"))
  return parts.join("\n")
}

/** 错题汇总（只统计客观题；主观题在逐题解析里看评分） */
function wrongSummaryHtml(input: AnalysisReportInput): string {
  const all = allQuestions(input)
  const wrong = all.filter((q) => !q.subjective && q.isCorrect === false)
  const subjective = all.filter((q) => q.subjective)
  const note = subjective.length
    ? `<p class="legend">主观题共 ${subjective.length} 题，得分与 AI 批改见上方「逐题解析」。</p>`
    : ""

  if (!wrong.length) {
    return [
      `<h2 class="section">错题汇总</h2>`,
      `<p class="good-note">本次客观题没有答错的题目，继续保持。</p>`,
      note,
    ].join("\n")
  }

  const rows = wrong
    .map((q) => {
      const user = String(q.userAnswer ?? "").trim()
      const right = String(q.correctAnswer ?? "").trim()
      const clip = (s: string) => (s.length > 100 ? `${s.slice(0, 100)}…` : s)
      return (
        `<tr><td class="c strong">${q.number}</td>` +
        `<td class="c">${esc(typeLabelOf(q) || "-")}</td>` +
        `<td>${user ? esc(clip(user)) : `<span class="muted">未作答</span>`}</td>` +
        `<td>${right ? esc(clip(right)) : `<span class="muted">-</span>`}</td>` +
        `<td class="c">${q.score != null ? esc(round1(q.score)) : "-"}${q.maxScore ? ` / ${esc(round1(q.maxScore))}` : ""}</td></tr>`
      )
    })
    .join("")
  return [
    `<h2 class="section">错题汇总</h2>`,
    `<p class="legend">共 ${wrong.length} 道客观题答错。建议按「题目解析」逐题订正，再回做一遍同类题。</p>`,
    `<table class="grid wrong" border="1" cellpadding="5" cellspacing="0" width="100%">` +
      `<tr><th class="c">题号</th><th class="c">题型</th><th>我的作答</th><th>正确答案</th><th class="c">得分</th></tr>` +
      `${rows}</table>`,
    note,
  ].join("\n")
}

export function reportDocHtml(input: AnalysisReportInput): string {
  const parts: string[] = [headerHtml(input)]
  const questions = allQuestions(input)
  const showSheet = questions.length > 3
  const hasScoreTable = input.kind === "paper" && input.sections.length > 1

  let sectionIndex = 0
  const nextSectionNumber = () => CHINESE_NUM[sectionIndex++] ?? String(sectionIndex)

  if (showSheet) {
    parts.push(answerSheetHtml(input, `${nextSectionNumber()}、答题卡`))
  }
  if (hasScoreTable) {
    parts.push(`<h2>${nextSectionNumber()}、各题得分</h2>`)
    parts.push(sectionScoreTableHtml(input.sections))
  }

  parts.push(`<h2>${nextSectionNumber()}、逐题解析</h2>`)

  input.sections.forEach((section, index) => {
    parts.push(sectionHtml(section, index, input.kind))
  })

  parts.push(wrongSummaryHtml(input))
  parts.push(
    `<p class="foot">广学题库 · ${esc(input.title)} · 分析报告 · 生成于 ${esc(input.generatedAt)}</p>`
  )
  return parts.join("\n")
}

/** 分析报告的页面外壳（打印稿自带浅色配色，不参与深色模式） */
export function reportPageHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>
  /* LibreOffice 只认「两个长度值」的 @page size，写 A4 会被忽略 → 出 Letter。
     另：多值 margin 简写会让 LO 给段落加左缩进，所以样式一律写 longhand。 */
  @page { size: 210mm 297mm; margin-top: 15mm; margin-right: 14mm; margin-bottom: 14mm; margin-left: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", "SimSun", "宋体", serif; font-size: 10.5pt; line-height: 1.7; color: black; margin-top: 0; margin-right: 0; margin-bottom: 0; margin-left: 0; }
  h1 { font-size: 17pt; font-weight: bold; text-align: center; margin-top: 0; margin-right: 0; margin-bottom: 3pt; margin-left: 0; letter-spacing: .5pt; }
  .meta { font-size: 9pt; color: #555; text-align: center; margin-top: 0; margin-right: 0; margin-bottom: 10pt; margin-left: 0; }
  h2 { font-size: 13pt; font-weight: bold; margin-top: 16pt; margin-right: 0; margin-bottom: 8pt; margin-left: 0; padding-bottom: 3pt; border-bottom: 1.1pt solid black; break-after: avoid; }
  h2 .cnt { font-size: 9pt; font-weight: normal; color: #555; margin-left: 4pt; }
  h2.sub { font-size: 11.5pt; margin-top: 12pt; margin-bottom: 6pt; border-bottom: .6pt solid #999; }
  h3 { font-size: 11pt; font-weight: bold; margin-top: 10pt; margin-right: 0; margin-bottom: 4pt; margin-left: 0; break-after: avoid; }
  h4 { font-size: 10.5pt; font-weight: bold; margin-top: 8pt; margin-right: 0; margin-bottom: 3pt; margin-left: 0; color: #222; break-after: avoid; }
  h4.ai-head { margin-top: 10pt; padding-bottom: 2pt; border-bottom: .6pt solid #999; }
  p { margin-top: 0; margin-right: 0; margin-bottom: 5pt; margin-left: 0; text-align: justify; }
  ul, ol { margin-top: 3pt; margin-right: 0; margin-bottom: 6pt; margin-left: 20pt; padding-left: 0; }
  li { margin-top: 0; margin-bottom: 2pt; }
  strong { font-weight: bold; }
  del { text-decoration: line-through; color: #a11; }
  img { max-width: 100%; height: auto; }
  .figure { text-align: center; margin-top: 4pt; margin-bottom: 4pt; }
  .center, .passage .center { text-align: center; }
  .right-align { text-align: right; }
  .underline, u { text-decoration: underline; }
  .superscript { vertical-align: super; font-size: 75%; }
  .dot { border-bottom: .8pt dotted #555; }
  .blank { text-decoration: underline; }
  table { border-collapse: collapse; }
  td, th { vertical-align: top; text-align: left; font-size: 9.5pt; line-height: 1.55; }
  th { background: #f1f1f1; font-weight: bold; }
  .c { text-align: center; }
  .k { background: #f7f7f7; font-weight: bold; }
  .strong { font-weight: bold; }
  .muted { color: #666; }
  table.kv td { font-size: 10pt; }
  table.kv td.v.strong { font-size: 11.5pt; }
  /* 答题卡 */
  table.sheet td.sheet-cell { height: 26pt; text-align: center; font-size: 9.5pt; }
  table.sheet td.empty { background: #fafafa; }
  .sheet-no { font-weight: bold; margin-right: 3pt; }
  table.sheet td.ok .sheet-mark { font-weight: bold; }
  table.sheet td.bad { background: #f0f0f0; }
  table.sheet td.bad .sheet-mark { font-weight: bold; }
  table.sheet td.wait { background: #f6f6f6; }
  table.sheet td.subj .sheet-mark { font-weight: bold; }
  .legend { font-size: 8.5pt; color: #555; margin-top: 3pt; margin-bottom: 0; }
  .good-note { font-size: 10pt; color: #333; margin-top: 2pt; margin-bottom: 6pt; }
  .pending-note { font-size: 9.5pt; color: #555; margin-top: 3pt; margin-bottom: 6pt; }
  /* 逐题 */
  .q { margin-top: 0; margin-bottom: 12pt; padding-bottom: 8pt; border-bottom: .5pt dashed #bbb; }
  .q-essay { border-bottom: .5pt solid #ccc; }
  .q-head { margin-top: 10pt; margin-bottom: 4pt; }
  .q-no { font-size: 12pt; }
  .qtype { font-size: 9.5pt; color: #333; }
  .qstate { font-size: 9.5pt; font-weight: bold; }
  .qscore { font-size: 9.5pt; color: #333; }
  .sep { font-size: 8.5pt; color: #999; margin-left: 4pt; margin-right: 4pt; }
  .stem p { margin-top: 0; margin-bottom: 3pt; }
  .stem h1, .stem h2, .stem h3, .stem h4 { font-size: 11pt; text-align: center; margin-top: 6pt; margin-bottom: 3pt; }
  .opts { margin-top: 3pt; margin-bottom: 5pt; }
  .opt { margin-top: 0; margin-bottom: 1pt; padding-left: 18pt; }
  .opt-id { font-weight: bold; }
  table.answers td.a { line-height: 1.65; }
  .ans-label { font-weight: bold; color: #333; margin-right: 6pt; }
  table.grid th { text-align: center; }
  table.wrong td { font-size: 9pt; }
  .passage { margin-top: 4pt; margin-bottom: 6pt; }
  .passage h1, .passage h2, .passage h3, .passage h4 { font-size: 11pt; text-align: center; margin-top: 8pt; margin-bottom: 4pt; }
  .passage p { margin-top: 0; margin-bottom: 5pt; }
  /* AI 批改正文左对齐：两端对齐 + 行内 <br> 会被 LibreOffice 拉出巨大词间距 */
  .ai-md, .ai-md p, .ai-md li { text-align: left; }
  .ai-md p { margin-top: 0; margin-bottom: 4pt; }
  .foot { margin-top: 14pt; padding-top: 5pt; border-top: .6pt solid #999; font-size: 8.5pt; color: #555; text-align: center; }
</style></head>
<body>${body}</body></html>`
}
