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
 *
 * ⚠️ LibreOffice（HTML→PDF）的排版怪癖（都是实测结论，改版式前务必看这里）：
 * 1. CSS 的 `border` / `width` / `vertical-align` / `text-indent` **用在表格和单元格上全部无效**，
 *    边框只认 HTML 属性 `border="1" cellpadding cellspacing width="100%"`，单元格边框只能用
 *    `td` 上的**内联 style**（`style="border-bottom:0.8pt solid #666"`）。class 选择器命不中 `td`。
 * 2. 块元素（div / p / h2 …）上的 CSS `border` **不会**印出来，要画横线只能用「单行表格 + 内联
 *    td 边框」（见 answerLines / sectionHeading / coverHtml / foot）或 `<hr/>`。
 * 3. `margin: 12pt 0 6pt` 这类**简写会让段落出现左缩进**（LO 解析 bug），所有样式一律写
 *    longhand（margin-top / margin-bottom / margin-left / margin-right）。
 * 4. `page-break-before/after: always` 生效；`page-break-inside: avoid` / `avoid` **不生效**
 *    （表格行也会被拆开），所以分页只能靠「大题强制另起一页」这种结构手段。
 * 5. `&ensp;` 拼选项会参差不齐，选项一律走表格网格；单元格间距靠内联 padding，不能用 cellpadding
 *    （cellpadding 对行高无效）。
 */
import { markdownToHtml, inlineToHtml, type MarkdownOptions } from "./markdown"

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

/* ---------------------------------------------------------------- 表格工具 */

/**
 * 作答横线：单列表格，每行一个带 border-bottom 的 td。
 * 实测：只有 td 的内联 style 边框能印出来，行距 ≈ 26pt（约 9mm，正好手写），
 * 宽度 = 版心宽度（和正文左右边界对齐），比 `_`×88 的伪造横线干净得多。
 */
function answerLines(count: number, rule = "0.8pt solid #666666"): string {
  const rows = `<tr><td style="border-bottom:${rule}">&nbsp;</td></tr>`.repeat(Math.max(0, count))
  return `<table class="lines" width="100%" cellpadding="0" cellspacing="0" style="margin-top:3pt;margin-bottom:2pt">${rows}</table>`
}

/** 选项文字宽度（中日韩字符算 2，用来决定排几列） */
function displayWidth(s: string): number {
  let n = 0
  for (const ch of s) n += ch.charCodeAt(0) >= 0x2e80 ? 2 : 1
  return n
}

/** 有意义的选项文字：图片版题目把 A–D 画在图片里，库里只剩 [{"id":"A","label":"A"}] 这种空壳 */
function meaningfulOptions(options: PaperOption[]): PaperOption[] {
  return options.filter((opt) => {
    const label = String(opt.label ?? "").trim()
    if (!label) return false
    return !/^[A-Za-z]$/.test(label)
  })
}

/** 按选项长度挑列数：短选项 4 列网格，中等 2 列，长选项一行一个 */
function pickOptionCols(options: PaperOption[]): 1 | 2 | 4 {
  if (options.length <= 1) return 1
  if (options.length === 2) return 2
  const max = Math.max(...options.map((o) => displayWidth(String(o.label ?? "").trim())))
  if (max <= 16) return 4
  if (max <= 40) return 2
  return 1
}

interface OptionRow {
  /** 卷面题号（完形那种「只有选项没有题干」的小题把题号放第一列） */
  number?: number
  options: PaperOption[]
}

/**
 * 选项网格：字母列 + 文字列成对出现，所以折行时会自然对齐到文字列（悬挂缩进），
 * 不同小题之间也共用同一组列宽 → 四列能真正对齐。
 * 一个小题的选项超过列数时自动折成多行；同题内的续行加一点段前距。
 */
function optionsTable(rows: OptionRow[], cols: number): string {
  const hasNumber = rows.some((r) => r.number !== undefined)
  const numberW = hasNumber ? 5 : 0
  const letterW = 4
  const labelW = Math.round(((100 - numberW - cols * letterW) / cols) * 100) / 100

  const trs: string[] = []
  for (const row of rows) {
    const chunkCount = Math.max(1, Math.ceil(row.options.length / cols))
    for (let ci = 0; ci < chunkCount; ci++) {
      const cells: string[] = []
      const pad = ci > 0 ? "padding-top:2.5pt;" : ""
      const cellStyle = `${pad}line-height:150%`
      if (hasNumber) {
        const showNumber = ci === 0 && row.number !== undefined
        cells.push(
          `<td width="${numberW}%" valign="top" style="${cellStyle}">${
            showNumber ? `<span class="qno">${row.number}.</span>` : "&nbsp;"
          }</td>`
        )
      }
      for (let c = 0; c < cols; c++) {
        const opt = row.options[ci * cols + c]
        if (!opt) {
          cells.push(`<td colspan="2" valign="top" style="${cellStyle}">&nbsp;</td>`)
          continue
        }
        const id = esc(String(opt.id || "").toUpperCase())
        cells.push(`<td width="${letterW}%" valign="top" style="${cellStyle}">${id}.</td>`)
        cells.push(
          `<td width="${labelW}%" valign="top" style="${cellStyle}">${inlineToHtml(opt.label || "")}</td>`
        )
      }
      trs.push(`<tr>${cells.join("")}</tr>`)
    }
  }

  return `<table class="opts" width="100%" cellpadding="0" cellspacing="0" style="margin-top:2pt;margin-bottom:2pt">${trs.join("")}</table>`
}

/** 图片版题目（化学图片题）整题就是一张图，允许铺满版心 */
const IMAGE_FULL_WIDTH = { imageMaxWidthPt: 510, imageMaxHeightPt: 4000 }

function mdOptions(group: PaperGroupInput, blankStart: number): MarkdownOptions {
  return {
    blankMode: "number" as const,
    blankStart,
    ...(group.questionType === "chemistry-image" ? IMAGE_FULL_WIDTH : {}),
  }
}

/* ----------------------------------------------------------- 材料 / 题干文本 */

const HEADING_RE = /<h([1-4])>([\s\S]*?)<\/h\1>/g

/**
 * markdown 渲染 + 标题改写：
 * - 阅读材料里的 `A` / `B` / `C` 这种单字母标题 → 紧凑左对齐的篇目标签（原来居中 + 上下大留白）
 * - 其它标题 → 紧凑的居中粗体（div 而不是 h 标签：LO 的 h 标签自带左缩进）
 */
function passageHtml(md: string, options: MarkdownOptions): string {
  return markdownToHtml(md, options).replace(HEADING_RE, (_m, level: string, inner: string) => {
    const text = String(inner).replace(/<[^>]+>/g, "").trim()
    if (/^[A-Z]$/.test(text)) return `<div class="ptitle">${inner}</div>`
    return `<div class="ph ph${level}">${inner}</div>`
  })
}

/** 某题组的材料 / 情境文本 → HTML（填空按题号编号） */
function groupContentHtml(group: PaperGroupInput): string {
  const text = (group.content || "").trim()
  if (!text) return ""
  return `<div class="passage">${passageHtml(text, mdOptions(group, group.startNumber))}</div>`
}

const hasAnswerBracket = (content: string) => /（\s*[　\s]*）|\(\s*\)/.test(content || "")

/** 作答括号：用不断行空格粘在题干末尾，尽量不让它单独掉到下一行 */
const ANSWER_BOX = `<span class="ansbox" style="white-space:nowrap">&nbsp;（&emsp;&emsp;）</span>`

/** 把题号塞进题干第一段，末尾补一个作答括号，避免题号单独占一行 */
function stemWithNumber(number: number, stemHtml: string, tail = ""): string {
  const prefix = `<span class="qno">${number}.</span>&emsp;`
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

/* --------------------------------------------------------------- 小题区块 */

/** 单道小题的卷面区块（不含只靠材料填空的题组） */
function questionBlock(group: PaperGroupInput, q: PaperQuestionInput): string {
  const hasStem = Boolean(q.content?.trim())
  const stemHtml = hasStem ? passageHtml(q.content, mdOptions(group, q.number)) : ""
  const qClass = group.questionType === "chemistry-image" ? "q q-image" : "q"

  if (isChoice(q.questionType)) {
    // 选项文字为空的（图片版题目把选项画在图片里）不印 "A. B. C. D." 这种空壳
    const options = meaningfulOptions(q.options)

    // 图片版题目：整题就是一张图，题号 + 作答括号单独一行放图上面
    // （号和 img 同处一个 <p> 时，行内图片会把「1.」压到图片最后一行的高度上，看起来像挂在选项 D 后面）
    if (group.questionType === "chemistry-image") {
      const bracket = `<p><span class="qno">${q.number}.</span>&emsp;（&emsp;&emsp;）</p>`
      return `<div class="${qClass}">${bracket}${stemHtml}${
        options.length ? optionsTable([{ options }], pickOptionCols(options)) : ""
      }</div>`
    }

    // 完形填空这类小题只有选项、没有题干：题号做第一列，选项成网格
    if (!hasStem && options.length) {
      return `<div class="q q-bare">${optionsTable([{ number: q.number, options }], pickOptionCols(options))}</div>`
    }
    // 题干里已经有「（　　）」就不再补，避免印两个括号
    const ansBox = options.length && !hasAnswerBracket(q.content) ? ANSWER_BOX : ""
    return `<div class="${qClass}">${stemWithNumber(q.number, stemHtml, ansBox)}${
      options.length ? optionsTable([{ options }], pickOptionCols(options)) : ""
    }</div>`
  }

  if (q.questionType === "text" || isWriting(group.questionType)) {
    const lines = answerLineCount(group.questionType, q.score)
    return `<div class="${qClass} q-text">${stemWithNumber(q.number, stemHtml)}${answerLines(lines)}</div>`
  }

  // input / input2：横线已经在题干里
  return `<div class="${qClass}">${stemWithNumber(q.number, stemHtml)}</div>`
}

/** 写作类题组：材料（或题目）通篇是写作要求，给一大片作答区 */
function writingBlock(group: PaperGroupInput, newPage: boolean): string {
  const first = group.questions[0]
  const prompt = (group.content || "").trim() || (first?.content ?? "").trim()
  const promptHtml = prompt ? passageHtml(prompt, { blankMode: "number", blankStart: group.startNumber }) : ""
  const lines = answerLineCount(group.questionType, first?.score ?? group.score)
  const number = first?.number ?? group.startNumber
  const block = `<div class="q q-text q-writing">${stemWithNumber(number, promptHtml)}${answerLines(lines)}</div>`
  if (!newPage) return block
  // LO 的 div 上的 page-break-before 不生效，只有表格层面的 inline page-break-before 能分页
  return `<table width="100%" cellpadding="0" cellspacing="0" style="page-break-before:always;margin-top:0;margin-bottom:0"><tr><td style="padding:0">${block}</td></tr></table>`
}

/** 完形填空这类「整组小题都只有选项」的情况：合成一张表，20 小题共用同一组列宽 */
function bareQuestionsTable(questions: PaperQuestionInput[]): string | null {
  const rows = questions
    .map((q) => ({
      number: q.number,
      options: meaningfulOptions(q.options),
    }))
    .filter((row) => row.options.length)
  if (!rows.length) return null
  const cols = pickOptionCols(rows.flatMap((r) => r.options))
  return optionsTable(rows, cols)
}

/* --------------------------------------------------------------- 大题区块 */

function groupBlock(group: PaperGroupInput, opts: { newPage?: boolean } = {}): string {
  const parts: string[] = []

  if (group.questionType === "seven-choose-five") {
    parts.push(groupContentHtml(group))
    parts.push(
      `<p class="ins">根据短文内容，从短文后的七个选项中选出能填入空白处的最佳选项。选项中有两项为多余选项。</p>`
    )
    const options = group.questions[0]?.options ?? []
    // 七选五的 A–G 一行一个，字母列 + 文字列对齐，折行自然悬挂
    if (options.length) parts.push(optionsTable([{ options }], 1))
    return parts.join("\n")
  }

  if (isContentOnly(group.questionType)) {
    parts.push(groupContentHtml(group))
    return parts.join("\n")
  }

  if (isWriting(group.questionType)) {
    parts.push(writingBlock(group, Boolean(opts.newPage)))
    return parts.join("\n")
  }

  // 单词库 / 选词填空：材料是词表，单独框起来
  if (group.questionType === "word-choice") {
    const bank = (group.content || "").trim()
    if (bank) {
      parts.push(
        `<table class="bank" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4pt;margin-bottom:8pt"><tr>` +
          `<td style="border:0.8pt solid black;padding:5pt 7pt">${inlineToHtml(bank)}</td></tr></table>`
      )
    }
  } else {
    parts.push(groupContentHtml(group))
  }

  // 整组都是「只有选项、没有题干」的小题（完形填空）：合并成一张表，四列才真正对齐
  const choiceQuestions = group.questions.filter((q) => q.content?.trim() || q.options.length)
  const allBare =
    choiceQuestions.length > 1 &&
    choiceQuestions.every((q) => isChoice(q.questionType) && !q.content?.trim() && q.options.length)
  if (allBare) {
    const table = bareQuestionsTable(choiceQuestions)
    if (table) parts.push(`<div class="q q-bare">${table}</div>`)
    return parts.join("\n")
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

/**
 * 大题标题：标题文字 + 一条通栏细线（线只能用 td 内联边框画）。
 * `breakBefore` 时整个标题表格另起一页 —— LO 不支持 keep-with-next，
 * 强制「每个大题从新页开始」是唯一能稳定避免「标题被挤到页底、正文在下一页」的办法。
 */
function sectionHeading(section: Section, index: number, breakBefore: boolean): string {
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
  const brk = breakBefore ? "page-break-before:always;" : ""
  return (
    `<table width="100%" cellpadding="0" cellspacing="0" style="${brk}margin-top:12pt;margin-bottom:6pt">` +
    `<tr><td style="border-bottom:0.8pt solid black;padding:0 0 2pt 0">` +
    `<span style="font-size:12pt;font-weight:bold">${number}、${esc(section.category)}</span>` +
    (extra ? `<span style="font-size:9pt;font-weight:normal;color:dimgray">（${extra}）</span>` : "") +
    `</td></tr></table>`
  )
}

/* ----------------------------------------------------------------- 封面 */

/**
 * 封面信息行：无边框表格分栏 + `<u>` 下划线。
 * 原来是 `姓名：____&emsp;&emsp;班级：____` 用字符拼的，右端不齐；表格负责把四栏对齐成列，
 * 下划线用原生 `<u>`（LibreOffice 支持 u 标签，比手写 `_` 干净）。
 */
function infoField(label: string, spaces: number, width: number): string {
  return `<td width="${width}%" valign="bottom"><span>${label}</span><u>${"　".repeat(spaces)}</u></td>`
}

function infoTable(kind: "group" | "paper"): string {
  const cells =
    kind === "paper"
      ? [
          infoField("姓名：", 6, 25),
          infoField("班级：", 6, 25),
          infoField("学号：", 8, 25),
          infoField("得分：", 5, 25),
        ].join("")
      : [
          infoField("姓名：", 8, 25),
          infoField("得分：", 5, 25),
          `<td width="25%">&nbsp;</td>`,
          `<td width="25%">&nbsp;</td>`,
        ].join("")
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6pt;margin-bottom:0"><tr>${cells}</tr></table>`
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
      infoTable("paper"),
      `<p class="tip">本卷为纸质作答版：选择题把答案写在题后括号里，填空题写在横线上，主观题写在答题格内。</p>`,
    ].join("\n")
  }

  return [
    `<h1>${esc(input.title)}</h1>`,
    `<p class="meta">${metaParts.join(" · ")}</p>`,
    `<p class="meta">${totals.questions} 小题${totalScore ? ` · 共 ${totalScore} 分` : ""}</p>`,
    infoTable("group"),
    `<p class="tip">本卷为纸质作答版：答案请写在题目下方的空白处。</p>`,
  ].join("\n")
}

/* ----------------------------------------------------------------- 入口 */

export function paperDocHtml(input: PaperDocInput): string {
  const parts: string[] = [coverHtml(input)]

  if (input.kind === "group") {
    parts.push(input.groups.map((g) => groupBlock(g)).join("\n"))
  } else {
    const sections = buildSections(input.groups)
    sections.forEach((section, index) => {
      // 大题标题不强制分页（LO 没有 keep-with-next，强制分页会在题量不足一页时留下大片空白）；
      // 只有同一大题里的第二篇作文才另起一页，避免两篇作文的作答区挤在一起。
      parts.push(sectionHeading(section, index, false))
      parts.push(
        section.groups
          .map((g, gi) => groupBlock(g, { newPage: gi > 0 && isWriting(g.questionType) }))
          .join("\n")
      )
    })
  }

  // 末尾塞一个 1pt 的隐形段：LibreOffice 导入 HTML 后会在文末补一个空段落，
  // 内容刚好顶到页底时那个空段落会被挤到新的一页（整页空白），1pt 的尾巴能把这点空隙吃掉。
  parts.push(`<p style="font-size:1pt;line-height:1pt;margin-top:0;margin-bottom:0">&nbsp;</p>`)
  return parts.join("\n")
}

/** 纸质作答卷的页面外壳（打印稿自带浅色配色，不参与深色模式） */
export function paperPageHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>
  /* 注意：所有 margin 都写 longhand —— LO 解析 3 值简写会给段落加左缩进 */
  /* ⚠️ size 只能写两个长度值：LibreOffice 的 HTML 导入会忽略只写 A4 关键字的写法（会落到 Letter
     612×792），只认 size: 210mm 297mm，否则纸张比 A4 矮 21mm，页数变多、大片空白 */
  @page { size: 210mm 297mm; margin: 14mm 13mm 12mm; }
  body { font-family: "Times New Roman", "SimSun", "宋体", serif; font-size: 10.5pt; line-height: 160%; color: black;
         margin-top: 0; margin-bottom: 0; margin-left: 0; margin-right: 0; }
  p { margin-top: 0; margin-bottom: 4pt; margin-left: 0; margin-right: 0; text-align: justify; }
  h1 { font-size: 16pt; font-weight: bold; text-align: center; margin-top: 0; margin-bottom: 3pt; margin-left: 0; margin-right: 0; letter-spacing: .5pt; }
  .meta { font-size: 9pt; color: dimgray; text-align: center; margin-top: 0; margin-bottom: 2pt; margin-left: 0; margin-right: 0; }
  .tip { font-size: 8.5pt; color: dimgray; margin-top: 4pt; margin-bottom: 6pt; margin-left: 0; margin-right: 0; }
  .passage { margin-top: 4pt; margin-bottom: 6pt; margin-left: 0; margin-right: 0; }
  .passage p { margin-top: 0; margin-bottom: 4pt; margin-left: 0; margin-right: 0; text-align: justify; }
  .passage ul, .passage ol { margin-top: 4pt; margin-bottom: 6pt; margin-left: 18pt; margin-right: 0; padding-left: 0; }
  .passage li { margin-top: 0; margin-bottom: 2pt; margin-left: 0; margin-right: 0; }
  /* 篇目标题：单字母 A/B/C 紧凑左对齐（原来居中 + 上下大留白，像孤零零的一行字） */
  .ptitle { font-size: 10.5pt; font-weight: bold; text-align: left; margin-top: 8pt; margin-bottom: 2pt; margin-left: 0; margin-right: 0; }
  .ph { font-weight: bold; text-align: center; margin-top: 8pt; margin-bottom: 3pt; margin-left: 0; margin-right: 0; }
  .ph1 { font-size: 11pt; }
  .ph2 { font-size: 11pt; }
  .ph3 { font-size: 10.5pt; }
  .ph4 { font-size: 10.5pt; }
  .center { text-align: center; }
  .right-align { text-align: right; color: dimgray; }
  .q { margin-top: 6pt; margin-bottom: 8pt; margin-left: 0; margin-right: 0; }
  .qno { font-weight: bold; margin-right: 3pt; }
  .stem { display: block; }
  .stem p { margin-top: 0; margin-bottom: 3pt; margin-left: 0; margin-right: 0; text-align: justify; }
  .ins { font-size: 9.5pt; color: black; margin-top: 2pt; margin-bottom: 4pt; margin-left: 0; margin-right: 0; }
  .blank { letter-spacing: .5pt; }
  .underline, u { text-decoration: underline; }
  .superscript { vertical-align: super; font-size: 75%; }
  .math-disp { display: block; text-align: center; }
  .q-writing .stem p { text-indent: 2em; }
  .figure { text-align: center; margin-top: 4pt; margin-bottom: 6pt; margin-left: 0; margin-right: 0; }
  img { max-width: 100%; max-height: 62mm; }
  /* 图片版题目（化学图片题）：整题就是一张裁好的图，按版心宽度铺满 */
  .q-image img, .q-image p img { max-width: 100%; max-height: none; width: 100%; }
  th, td { font-size: 10.5pt; vertical-align: top; }
</style></head>
<body>${body}</body></html>`
}
