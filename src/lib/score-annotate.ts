/**
 * 文科大题（历史 / 地理 / 政治）的卷面分值标注
 *
 * 背景：这三科的大题是「材料里内联设问 + `<AnswerBox>` 大答题框」，一条小题对应
 * 材料里的一个 `<AnswerBox>`（入库时已校验：每组的 AnswerBox 数 == 小题数）。
 * 真实试卷上每个设问末尾都带「（6分）」，学生才知道该写多少；题库里 content 没有这
 * 个标记，所以在**渲染前**按小题分值补上。
 *
 * 四条口径：
 * 1. **只改显示**：数据库 content 不动，判分提示词（grading-stem.ts 直接读库）也不受影响；
 * 2. **幂等**：设问已经手写过「（6分）」的不再重复补；
 * 3. **只认 `<AnswerBox>`**：生物 / 物理的 `<Input>` / `<InputLong>` 是「逐空判分」的小空，
 *    不能按小题分值标注（一个题里可能十几个空），所以不在这套规则里；
 * 4. **Web 用 nowrap 包住**：中文行内可以在「6」和「分」之间折行，实测「（6分）」会被折成
 *    两行（`（6` / `分）`）很扎眼，所以给 Web MDX 版包一层 `whitespace-nowrap` 的 span；
 *    PDF（LibreOffice 导入 HTML）不认 `white-space`，那边保持纯文本（传 `html: false`）。
 */

/** 走「材料内联设问 + AnswerBox」结构、需要在设问后标分值的题组类型 */
export const SCORE_ANNOTATED_TYPES = ["history-fill", "geography-fill", "politics-fill"] as const

export function usesScoreAnnotation(questionType: string | null | undefined): boolean {
  return !!questionType && (SCORE_ANNOTATED_TYPES as readonly string[]).includes(questionType)
}

/** 「6分」：整数不带小数点（6，不是 6.0），非整数保留一位（2.5 分） */
export function scoreLabel(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(score) || score <= 0) return null
  const value = Math.round(score * 10) / 10
  return `${Number.isInteger(value) ? value.toFixed(0) : String(value)}分`
}

export interface AnnotateOptions {
  /** true（默认）= 给 Web MDX 输出 `<span className="whitespace-nowrap">`；PDF 传 false 保持纯文本 */
  html?: boolean
}

/** 已经手写的分值（全角/半角括号都算）：`（6分）`、`(6 分)`，以及 nowrap span 包过的版本 */
const EXISTING_SCORE_RE =
  /(?:<span[^>]*>)?[（(]\s*[\d.]+\s*分\s*[）)](?:\s*<\/span>)?\s*$/

/** 分值文案（可直接塞进正文的字符串） */
function labelMarkup(score: number | null | undefined, html: boolean): string | null {
  const label = scoreLabel(score)
  if (!label) return null
  return html ? `<span className="whitespace-nowrap">（${label}）</span>` : `（${label}）`
}

/**
 * `<AnswerBox></AnswerBox>` / `<AnswerBox />` 都算一个占位符。
 * 注意不能有捕获组：下面替换回调里要用 `offset`（第二个参数）判断「占位符前面是什么」。
 */
const ANSWER_BOX_TAG_RE = /<\s*AnswerBox\b[^>]*>(?:\s*<\s*\/\s*AnswerBox\s*>)?/gi

/**
 * 材料：按 `<AnswerBox>` 出现顺序（= 小题顺序）把「（6分）」插在占位符之前，
 * 也就是插在对应设问的句末。
 *
 * @param content 题组材料原文（MDX）
 * @param scores  按 GroupItem.orderIndex 排好的小题分值
 */
export function annotateMaterialScores(
  content: string | null | undefined,
  scores: Array<number | null | undefined>,
  options: AnnotateOptions = {}
): string {
  const text = content ?? ""
  if (!text || !/<\s*AnswerBox\b/i.test(text)) return text

  const html = options.html !== false
  let index = -1
  return text.replace(ANSWER_BOX_TAG_RE, (match: string, offset: number) => {
    index += 1
    const markup = labelMarkup(scores[index], html)
    if (!markup) return match
    const before = text.slice(0, offset)
    // 占位符前面没有设问（材料开头就答题框）：不补，免得出现孤零零的「（6分）」
    if (!/\S/.test(before)) return match
    // 已经手写过「（6分）」的设问：不重复补
    if (EXISTING_SCORE_RE.test(before)) return match
    return `${markup}${match}`
  })
}

/**
 * 单条题干（设问）：在句末补「（6分）」。
 * 已经带分值的不重复补；题干里万一带了 `<AnswerBox>`（理论上不会），按材料规则走。
 */
export function annotateStemScore(
  stem: string | null | undefined,
  score: number | null | undefined,
  options: AnnotateOptions = {}
): string {
  const raw = stem ?? ""
  if (!raw) return raw
  if (/<\s*AnswerBox\b/i.test(raw)) return annotateMaterialScores(raw, [score], options)

  const text = raw.trimEnd()
  const markup = labelMarkup(score, options.html !== false)
  if (!markup) return raw
  if (EXISTING_SCORE_RE.test(text)) return raw
  return `${text}${markup}`
}

/** 题干开头是否自带卷面编号：（1）/（一）/1./1．/1、/①②③ */
const OWN_NUMBER_RE =
  /^\s*(?:[（(]\s*(?:\d{1,2}|[一二三四五六七八九十]{1,3})\s*[）)]|\d{1,2}\s*[.．、](?!\d)|[①②③④⑤⑥⑦⑧⑨⑩])/

/**
 * 题干自带编号时，回顾页等处的「系统题号」就不要再叠一遍 ——
 * 否则会显示成「1.（1）结合材料…」（2026-11-12 政治大题实测）。
 * 只对走分值标注的三科调用，避免影响英语阅读等题干里本来就写死题号的题型。
 */
export function stemHasOwnNumber(text: string | null | undefined): boolean {
  return !!text && OWN_NUMBER_RE.test(text)
}
