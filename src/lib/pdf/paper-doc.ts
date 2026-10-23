/**
 * 题组 / 套卷 → 「纸质作答卷」PDF 用的 HTML
 *
 * 与回顾 PDF 的区别：不带答案、不带解析，按考试卷的版式排版，留出作答空间
 * （选择题给括号、填空直接在题干横线上作答、主观题给带格线的作答区）。
 *
 * 版式约定：
 * - A4，10.5pt 正文，宋体 + Times New Roman
 * - 题组导出：标题 + 该题组材料 / 小题
 * - 套卷导出：封面信息 + 按「类别」分大题（连续同类别合并成一大题）+ 连续题号
 */
import { markdownToHtml, inlineToHtml } from "./markdown"

const esc = (s: string): string =>
  String(s ?? "").replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m] as string))

export interface PaperOption {
  id: string
  label: string
}

export interface PaperQuestionInput {
  /** 卷面题号（连续编号） */
  number: number
  /** 数据库原始题型：single / multiple / choice / input / input2 / text */
  questionType: string
  content: string
  options: PaperOption[]
  score: number
}

export interface PaperGroupInput {
  id: string
  title: string
  questionType: string
  category: string
  content: string
  score: number
  /** 该题组第一小题的卷面题号 */
  startNumber: number
  questions: PaperQuestionInput[]
}

export interface PaperDocInput {
  kind: "group" | "paper"
  title: string
  subject: string
  source?: string | null
  grade?: string | null
  year?: number | null
  totalScore?: number | null
  duration?: number | null
  groups: PaperGroupInput[]
  generatedAt: string
}

const CHINESE_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五"]

const isChoice = (t: string) => t === "single" || t === "multiple" || t === "choice"
const isWriting = (t: string) => t === "en-writing" || t === "chinese-essay" || t === "chinese-micro-writing"
/** 只靠材料里的填空作答、小题本身没有题干 */
const isContentOnly = (t: string) => t === "grammar" || t === "chinese-dictation"

/** 输入类题型的小题上限行数：按分值估一个够写的空间 */
function answerLineCount(groupType: string, score: number): number {
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
  if (groupType === "en-writing") return score >= 20 ? 16 : 14
  if (groupType === "chinese-essay") return 22
  if (groupType === "chinese-micro-writing") return 10
  if (groupType === "reading-expression") return clamp(Math.ceil(score) + 1, 3, 6)
  return clamp(Math.ceil(score) + 2, 2, 8)
}

/**
 * 作答区：用「真下划线字符」画横线。
 * LibreOffice 的 HTML 导入不会渲染空 div / td 的 border-bottom，只有文字下划线能印出来。
 */
function answerLines(count: number): string {
  const rule = "_".repeat(88)
  return `<div class="lines">${`<p class="ln">${rule}</p>`.repeat(count)}</div>`
}

/** 图片版题目（化学图片题）整题就是一张图，允许铺满版心 */
const IMAGE_FULL_WIDTH = { imageMaxWidthPt: 500, imageMaxHeightPt: 4000 }

function mdOptions(group: PaperGroupInput, blankStart: number) {
  return {
    blankMode: "number" as const,
    blankStart,
    ...(group.questionType === "chemistry-image" ? IMAGE_FULL_WIDTH : {}),
  }
}

/** 某题组的材料 / 情境文本 → HTML（填空按题号编号） */
function groupContentHtml(group: PaperGroupInput): string {
  const text = (group.content || "").trim()
  if (!text) return ""
  const html = markdownToHtml(text, mdOptions(group, group.startNumber))
  return `<div class="passage">${html}</div>`
}

function optionTag(opt: PaperOption): string {
  const id = esc(String(opt.id || "").toUpperCase())
  return `<span class="opt">${id}. ${inlineToHtml(opt.label || "")}</span>`
}

/** 选择题选项：一整行排下来，太长了自然换行（span 形式，避免题号与选项被分页拆开） */
function optionsInline(options: PaperOption[], block = false): string {
  if (!options.length) return ""
  const body = options.map(optionTag).join('<span class="opt-gap">&ensp;&ensp;</span>')
  return block ? `<div class="opts">${body}</div>` : `<span class="opts">${body}</span>`
}

/** 七选五的 A–G 选项：一行一个，便于涂写 */
function optionsStacked(options: PaperOption[]): string {
  if (!options.length) return ""
  return `<div class="opts opts-stacked">${options.map(optionTag).join("<br/>")}</div>`
}

const hasAnswerBracket = (content: string) => /（\s*[　\s]*）|\(\s*\)/.test(content || "")

/** 把题号塞进题干第一段，末尾补一个作答括号，避免题号单独占一行 */
function stemWithNumber(number: number, stemHtml: string, tail = ""): string {
  const prefix = `<span class="qno">${number}.</span>&ensp;`
  if (stemHtml.startsWith("<p>")) {
    let out = stemHtml.replace("<p>", `<p>${prefix}`)
    if (tail) {
      const index = out.lastIndexOf("</p>")
      out = index >= 0 ? `${out.slice(0, index)}${tail}${out.slice(index)}` : `${out}${tail}`
    }
    return out
  }
  return `<div class="stem">${prefix}${stemHtml}${tail}</div>`
}

function questionHead(number: number, bodyHtml: string): string {
  return `<span class="qno">${number}.</span>&ensp;${bodyHtml}`
}

/** 单道小题的卷面区块（不含只靠材料填空的题组） */
function questionBlock(group: PaperGroupInput, q: PaperQuestionInput): string {
  const hasStem = Boolean(q.content?.trim())
  const stemHtml = hasStem ? markdownToHtml(q.content, mdOptions(group, q.number)) : ""
  const qClass = group.questionType === "chemistry-image" ? "q q-image" : "q"

  if (isChoice(q.questionType)) {
    // 选项文字为空的（图片版题目把选项画在图片里）不印 "A. B. C. D." 这种空壳
    const options = q.options.filter((opt) => String(opt.label || "").trim())
    // 完形填空这类小题只有选项、没有题干
    if (!hasStem && options.length) {
      return `<div class="q q-bare">${questionHead(q.number, optionsInline(options))}</div>`
    }
    // 题干里已经有「（　　）」就不再补，避免印两个括号
    const ansBox =
      q.options.length && !hasAnswerBracket(q.content)
        ? `<span class="ansbox">（&emsp;&emsp;）</span>`
        : ""
    return `<div class="${qClass}">${stemWithNumber(q.number, stemHtml, ansBox)}${optionsInline(options, true)}</div>`
  }

  if (q.questionType === "text" || isWriting(group.questionType)) {
    const lines = answerLineCount(group.questionType, q.score)
    return `<div class="${qClass} q-text">${stemWithNumber(q.number, stemHtml)}${answerLines(lines)}</div>`
  }

  // input / input2：横线已经在题干里
  return `<div class="${qClass}">${stemWithNumber(q.number, stemHtml)}</div>`
}

/** 写作类题组：材料（或题目）通篇是写作要求，给一大片作答区 */
function writingBlock(group: PaperGroupInput): string {
  const first = group.questions[0]
  const prompt = (group.content || "").trim() || (first?.content ?? "").trim()
  const promptHtml = prompt ? markdownToHtml(prompt, { blankMode: "number", blankStart: group.startNumber }) : ""
  const lines = answerLineCount(group.questionType, first?.score ?? group.score)
  const number = first?.number ?? group.startNumber
  return `<div class="q q-text q-writing">${stemWithNumber(number, promptHtml)}${answerLines(lines)}</div>`
}

function groupBlock(group: PaperGroupInput): string {
  const parts: string[] = []

  if (group.questionType === "seven-choose-five") {
    parts.push(groupContentHtml(group))
    parts.push(
      `<p class="ins">根据短文内容，从短文后的七个选项中选出能填入空白处的最佳选项。选项中有两项为多余选项。</p>`
    )
    const options = group.questions[0]?.options ?? []
    parts.push(optionsStacked(options))
    return parts.join("\n")
  }

  if (isContentOnly(group.questionType)) {
    parts.push(groupContentHtml(group))
    return parts.join("\n")
  }

  if (isWriting(group.questionType)) {
    parts.push(writingBlock(group))
    return parts.join("\n")
  }

  // 单词库 / 选词填空：材料是词表，单独框起来
  if (group.questionType === "word-choice") {
    const bank = (group.content || "").trim()
    if (bank) parts.push(`<div class="bank">${inlineToHtml(bank)}</div>`)
  } else {
    parts.push(groupContentHtml(group))
  }

  for (const q of group.questions) {
    if (!q.content?.trim() && !q.options.length) continue
    parts.push(questionBlock(group, q))
  }
  return parts.join("\n")
}

/** 套卷：把连续的同类题组合并成一个大题（一、完形填空 …） */
interface Section {
  category: string
  groups: PaperGroupInput[]
}

function buildSections(groups: PaperGroupInput[]): Section[] {
  const sections: Section[] = []
  for (const g of groups) {
    const last = sections[sections.length - 1]
    if (last && last.category === g.category) last.groups.push(g)
    else sections.push({ category: g.category, groups: [g] })
  }
  return sections
}

function sectionHeading(section: Section, index: number): string {
  const questionCount = section.groups.reduce((n, g) => n + g.questions.length, 0)
  const score = section.groups.reduce((n, g) => n + g.score, 0)
  const first = section.groups[0]?.startNumber ?? 1
  const lastGroup = section.groups[section.groups.length - 1]
  const lastQuestion = lastGroup.questions[lastGroup.questions.length - 1]?.number ?? first
  const range = lastQuestion > first ? `第 ${first}–${lastQuestion} 题` : `第 ${first} 题`
  const count = questionCount ? `共 ${questionCount} 小题` : ""
  const scoreText = score ? `共 ${score} 分` : ""
  const extra = [range, count, scoreText].filter(Boolean).join("，")
  const number = CHINESE_NUM[index] ?? String(index + 1)
  const newPage = /作文|微写作/.test(section.category) && index > 0
  return `<h2 class="sec${newPage ? " newpage" : ""}">${number}、${esc(section.category)}${
    extra ? `<span class="cnt">（${extra}）</span>` : ""
  }</h2>`
}

function coverHtml(input: PaperDocInput): string {
  const totals = input.groups.reduce(
    (acc, g) => {
      acc.questions += g.questions.length
      acc.score += g.score
      return acc
    },
    { questions: 0, score: 0 }
  )
  const totalScore = input.totalScore ?? (totals.score || null)

  const metaParts = [input.subject, input.source, input.year ? `${input.year} 年` : "", input.grade]
    .filter(Boolean)
    .map((s) => esc(String(s)))

  if (input.kind === "paper") {
    return [
      `<h1>${esc(input.title)}</h1>`,
      `<p class="meta">${metaParts.join(" · ")}</p>`,
      `<p class="meta">${totals.questions} 小题${totalScore ? ` · 满分 ${totalScore} 分` : ""}${
        input.duration ? ` · 建议用时 ${input.duration} 分钟` : ""
      }</p>`,
      `<div class="info"><span>姓名：______________</span>&emsp;&emsp;<span>班级：______________</span>&emsp;&emsp;<span>学号：______________</span>&emsp;&emsp;<span>得分：__________</span></div>`,
      `<p class="tip">本卷为纸质作答版：选择题把答案写在题后括号里，填空题写在横线上，主观题写在答题格内。</p>`,
    ].join("\n")
  }

  return [
    `<h1>${esc(input.title)}</h1>`,
    `<p class="meta">${metaParts.join(" · ")}</p>`,
    `<p class="meta">${totals.questions} 小题${totalScore ? ` · 共 ${totalScore} 分` : ""}</p>`,
    `<div class="info"><span>姓名：______________</span>&emsp;&emsp;<span>得分：__________</span></div>`,
    `<p class="tip">本卷为纸质作答版：答案请写在题目下方的空白处。</p>`,
  ].join("\n")
}

export function paperDocHtml(input: PaperDocInput): string {
  const parts: string[] = [coverHtml(input)]

  if (input.kind === "group") {
    parts.push(input.groups.map(groupBlock).join("\n"))
  } else {
    const sections = buildSections(input.groups)
    sections.forEach((section, index) => {
      parts.push(sectionHeading(section, index))
      parts.push(section.groups.map(groupBlock).join("\n"))
    })
  }

  parts.push(`<p class="foot">广学题库 · ${esc(input.title)} · ${esc(input.generatedAt)}</p>`)
  return parts.join("\n")
}

/** 纸质作答卷的页面外壳（打印稿自带浅色配色，不参与深色模式） */
export function paperPageHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 15mm 13mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", "SimSun", "宋体", serif; font-size: 10.5pt; line-height: 1.65; color: black; margin: 0; }
  h1 { font-size: 16pt; font-weight: bold; text-align: center; margin: 0 0 4pt; letter-spacing: .5pt; }
  .meta { font-size: 9pt; color: dimgray; text-align: center; margin: 0 0 3pt; }
  .info { font-size: 10pt; margin: 8pt 0 2pt; }
  .info span { display: inline; margin-right: 14pt; white-space: nowrap; }
  .tip { font-size: 8.5pt; color: dimgray; margin: 2pt 0 10pt; }
  h2.sec { font-size: 12pt; font-weight: bold; margin: 14pt 0 6pt; padding-bottom: 2pt; border-bottom: .8pt solid black; }
  h2.sec .cnt { font-size: 9pt; font-weight: normal; color: dimgray; margin-left: 4pt; }
  h2.sec.newpage { page-break-before: always; }
  .passage { margin: 4pt 0 6pt; }
  .passage p { margin: 0 0 5pt; text-align: justify; }
  .passage h1, .passage h2, .passage h3, .passage h4 { font-size: 11pt; text-align: center; margin: 8pt 0 4pt; }
  .passage .center, .center { text-align: center; }
  .passage .right-align, .right-align { text-align: right; color: dimgray; }
  .passage ul, .passage ol { margin: 4pt 0 6pt 18pt; padding: 0; }
  .passage li { margin: 0 0 2pt; }
  table { border-collapse: collapse; margin: 4pt 0 6pt; width: 100%; }
  th, td { border: .6pt solid gray; padding: 3pt 5pt; font-size: 9.5pt; vertical-align: top; }
  th { background: whitesmoke; }
  img { max-width: 100%; max-height: 62mm; width: auto; height: auto; }
  /* 图片版题目（化学图片题）：整题就是一张裁好的图，按版心宽度铺满 */
  .q-image img, .q-image p img { max-width: 100%; max-height: none; width: 100%; }
  .figure { text-align: center; margin: 4pt 0 6pt; }
  .q { margin: 6pt 0 8pt; }
  .qno { font-weight: bold; margin-right: 3pt; }
  .stem { display: block; }
  .stem p { margin: 0 0 3pt; text-align: justify; }
  .stem h1, .stem h2, .stem h3, .stem h4 { font-size: 11pt; text-align: center; margin: 6pt 0 3pt; }
  .ansright { text-align: right; font-size: 10.5pt; margin: 2pt 0 2pt; }
  .opts { margin: 3pt 0 2pt; }
  .opts-stacked { line-height: 1.9; }
  .opt { white-space: normal; }
  .opt-gap { display: inline; }
  .bank { border: .8pt solid black; padding: 5pt 7pt; margin: 4pt 0 8pt; line-height: 1.8; }
  .ins { font-size: 9.5pt; color: black; margin: 2pt 0 5pt; }
  .lines { margin: 3pt 0 2pt; }
  .lines .ln { margin: 0; line-height: 2.7; color: gray; letter-spacing: .3pt; }
  .blank { letter-spacing: .5pt; }
  .dot { border-bottom: .8pt dotted dimgray; }
  .underline, u { text-decoration: underline; }
  .superscript { vertical-align: super; font-size: 75%; }
  .q-writing .stem p { text-indent: 2em; }
  .foot { margin-top: 16pt; padding-top: 5pt; border-top: .6pt solid silver; font-size: 8.5pt; color: dimgray; text-align: center; }
</style></head>
<body>${body}</body></html>`
}
