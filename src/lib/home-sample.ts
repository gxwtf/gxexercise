/**
 * 首页「先做一道真题」体验位的取题判据（纯函数，接口与自检脚本共用）。
 *
 * 首页那块是**纯文本渲染**（`whitespace-pre-wrap`）：不跑 Markdown、不加载图片、
 * 不加载 KaTeX、也不认识 MDX 语义标签。所以只要题干或选项里带了这些东西，
 * 用户看到的就会是 `![…](…)`、`$…$`、`<Dot>` 之类的原始标记 —— 体验位直接废掉。
 *
 * 这里把「能上首页的题」的判据集中成一处，接口（/api/home-sample）和
 * 录入后的自检脚本（scripts/audit-home-sample.ts）共用同一套逻辑，
 * 免得以后学科变多时又出现「筛不干净」的问题。
 *
 * 判据分三层：
 * 1. **渲染层**：题干与四个选项都不能含图片 / 表格 / 公式 / 裸 LaTeX 命令；
 *    语义标签（`<Dot>` `<U>` 等）不算问题，展示前直接去掉标签本身；
 * 2. **可答层**：题干不能靠图或表才能做（「如图」「下表」之类指代），
 *    也不能是题组里的一小问（「据此回答 1、2 题」）；
 * 3. **自包含层**（在 SQL 侧判定，见 /api/home-sample/route.ts）：
 *    题目不能依赖题目之外的题组材料（语文阅读、文言文、古诗等就是这样，
 *    材料在 QuestionGroup.content 里，只发小问根本没法做）。
 */

/** 首页只发四选一，且答案必须落在这四个字母里 */
export const HOME_SAMPLE_OPTION_IDS = ["A", "B", "C", "D"] as const

/** 题干长度上下限：太短没信息量，太长首页卡片撑爆 */
export const HOME_SAMPLE_MIN_LEN = 12
export const HOME_SAMPLE_MAX_LEN = 420

export interface HomeSampleOption {
  id: string
  label: string
}

/** 图片：markdown 图片 或 题库自定义的 `<QImg …>` */
const IMG_RE = /!\[[^\]]*\]\(|<QImg/i
/** 表格：markdown 表格（行首竖线）或 HTML 表格 */
const TABLE_RE = /^\s*\|/m
/** 公式：`$…$` / `$$…$$`（含落单的 `$`），以及躲开定界符的裸 LaTeX 命令（`\frac` `\sqrt` `\mathrm`） */
const MATH_RE = /\$|\\[A-Za-z]{2,}/
/** 指代图/表：题干里出现这些词，基本等于「没图做不了」 */
const FIG_REF_RE =
  /读图|如图|图中|下图|上图|见图|右图|左图|据图|由图|看图|图示|图\s*[0-9一二三四五甲乙丙丁]|图\s*[（(]\s*[0-9a-zA-Z]|示意图|统计图|折线图|柱状图|曲线图|结构图|流程图|坐标图|下表|上表|如表|见下表|表中|表格/
/** 试卷级说明（「本部分共 8 小题，每小题 4 分」「本试卷满分 100 分」）：不属于题目，别放上首页 */
const PAPER_NOTE_RE = /本部分共|本试卷满分|考试时间/
/** 卷面排版指代：「加点 / 画线 / 加横线 / 波浪线」——纯文本里没法体现标记位置 */
const UNDERLINE_REF_RE = /画波浪线|波浪线|画线|加横线|下划线|加点|着重号/
/** 题库里表示「加点 / 加横线」的语义标记（展示前会去掉，但要先判断这题有没有靠它传达信息） */
const UNDERLINE_MARKUP_RE = /<Dot>|<U>/

/** 题组提示：说明这是某道大题下的一小问，题干本身不完整（注意试卷里「据此，回答第 6～8 题」这类带标点的写法） */
const GROUP_HINT_RE =
  /据此\s*[、,，]?\s*回答|回答\s*第?\s*\d+\s*[、,，～~\-—至]\s*\d*\s*题|完成下面(?:小)?题|完成下列(?:小)?题/
/** Markdown 强调符号：纯文本里会原样显示成星号 */
const MARKDOWN_EMPHASIS_RE = /\*\*/

/** 温和的语义标签：去掉标签本身、保留内容（`<br>` 换成换行） */
const BR_RE = /<br\s*\/?>/gi
const INLINE_TAG_RE =
  /<\/?(?:Dot|U|Center|RightAlign|Sup|Sub|B|I|Small|Em|Strong)(?:\s[^<>]*)?\/?>/gi
/** 还有剩余尖括号标签 → 说明有不认识的标记（多半是图片/自定义组件），不能上首页 */
const LEFTOVER_TAG_RE = /<\/?[A-Za-z][^<>]*>/

/**
 * 把题干/选项里「纯文本渲染不了」的语义标签去掉：
 * `<Dot>冗</Dot>` → `冗`，`<U>飘</U>` → `飘`，`<br>` → 换行。
 * 图片标记（`![…](…)`、`<QImg>`）不在这里处理 —— 含图的题直接不让上首页。
 */
export function stripInlineTags(text: string): string {
  return text
    .replace(BR_RE, "\n")
    .replace(INLINE_TAG_RE, "")
    .replace(/[ \t\u3000]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * 规整选项：只认 A–D、去重、必须正好四个、按字母排序。
 * 选项里只有一个字母（表格题常拿 "A"/"B"/"C"/"D" 当占位）也按不可用处理。
 */
export function normalizeOptions(raw: unknown): HomeSampleOption[] {
  if (!Array.isArray(raw)) return []
  const out: HomeSampleOption[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    const id = typeof rec.id === "string" ? rec.id.trim().toUpperCase() : ""
    const label = typeof rec.label === "string" ? stripInlineTags(rec.label) : ""
    if (!String(HOME_SAMPLE_OPTION_IDS).includes(id) || !label) continue
    if (/^[A-Da-d]$/.test(label)) continue // 占位符式选项，纯文本里等于没给
    out.push({ id, label })
  }
  const uniq = Array.from(new Map(out.map((o) => [o.id, o])).values())
  return uniq.length === 4 ? uniq.sort((a, b) => a.id.localeCompare(b.id)) : []
}

/** 去掉题干开头残留的「（4分）」、重复段落、题组提示 */
export function cleanPrompt(raw: string): string {
  let text = stripInlineTags(raw)
    .replace(/^\s*\*\*[^*\n]{0,16}(选择题|非选择题)[^*\n]{0,16}\*\*\s*/g, "")
    .replace(/^[\s\u3000]*[（(]\s*\d*\s*分\s*[）)]\s*/g, "")
    .replace(/^[ \t]*[-–—•·]\s+/gm, "")
    .trim()
  const paras = text.split(/\n{2,}/)
  const out: string[] = []
  for (const p of paras) {
    const key = p.replace(/\s+/g, "")
    const prev = out.length ? out[out.length - 1].replace(/\s+/g, "") : ""
    if (key && key === prev) continue
    out.push(p)
  }
  text = out.join("\n\n").trim()
  return text
    .replace(/[，,]?\s*据此\s*[、,，]?\s*回答\s*第?\s*\d+\s*[、,，～~\-—至]\s*\d*\s*题[．。.]?/g, "")
    .replace(/回答\s*第?\s*\d+\s*[、,，～~\-—至]\s*\d*\s*题[．。.]?/g, "")
    .trim()
}

/** 不可出的原因码（自检脚本按它统计，名字要稳定） */
export type HomeSampleReject =
  | "empty"
  | "too-short"
  | "too-long"
  | "image"
  | "table"
  | "math"
  | "figure-ref"
  | "paper-note"
  | "underline-ref"
  | "group-hint"
  | "markdown"
  | "unknown-tag"
  | "options"

/** 题干或选项里有没有「加点 / 加横线」的语义标记（要在剥标签之前判） */
function hasUnderlineMarkup(q: HomeSampleCandidate): boolean {
  const rawLabels = Array.isArray(q.options)
    ? q.options
        .map((item) =>
          item && typeof item === "object" && typeof (item as { label?: unknown }).label === "string"
            ? (item as { label: string }).label
            : "",
        )
        .join("\n")
    : ""
  return UNDERLINE_MARKUP_RE.test(`${String(q.content || "")}\n${rawLabels}`)
}

/** 一段文本里有没有「纯文本渲染不了」的东西（图片 / 表格 / 公式 / 未知标签） */
function textReject(text: string): HomeSampleReject | null {
  if (IMG_RE.test(text)) return "image"
  if (TABLE_RE.test(text)) return "table"
  if (MATH_RE.test(text)) return "math"
  if (LEFTOVER_TAG_RE.test(text)) return "unknown-tag"
  return null
}

export interface HomeSampleCandidate {
  content: string
  options: unknown
  answer: string
}

export interface HomeSampleVerdict {
  ok: boolean
  reason?: HomeSampleReject
  prompt: string
  options: HomeSampleOption[]
}

/** 题干 + 选项的渲染/可答判定（不含「材料是否内联」那一层，那层要查题组，放在 SQL 里做） */
export function inspectHomeSample(q: HomeSampleCandidate): HomeSampleVerdict {
  const prompt = cleanPrompt(String(q.content || ""))
  const options = normalizeOptions(q.options)

  // 先看题干（化学那种「题干就是一张图」的题，先报「含图片」比报「选项不合格」准确）
  if (!prompt) return { ok: false, reason: "empty", prompt, options }
  if (prompt.length < HOME_SAMPLE_MIN_LEN) return { ok: false, reason: "too-short", prompt, options }
  if (prompt.length > HOME_SAMPLE_MAX_LEN) return { ok: false, reason: "too-long", prompt, options }
  const stemReject = textReject(prompt)
  if (stemReject) return { ok: false, reason: stemReject, prompt, options }
  if (FIG_REF_RE.test(prompt)) return { ok: false, reason: "figure-ref", prompt, options }
  if (PAPER_NOTE_RE.test(prompt)) return { ok: false, reason: "paper-note", prompt, options }
  // 「加横线/加点」指的是卷面上的标记：题库在题干或选项里带 <Dot>/<U> 时，
  // 去掉标签本身还能读（标记位置本身可从上下文看出来，如「冗（rǒng）长」）；
  // 一个标记都没有的则根本没法做（不知道指哪个字），直接不下发。
  if (UNDERLINE_REF_RE.test(prompt) && !hasUnderlineMarkup(q)) {
    return { ok: false, reason: "underline-ref", prompt, options }
  }
  if (GROUP_HINT_RE.test(prompt)) return { ok: false, reason: "group-hint", prompt, options }
  if (MARKDOWN_EMPHASIS_RE.test(prompt) || prompt.includes("每小题")) {
    return { ok: false, reason: "markdown", prompt, options }
  }

  // 再看选项：真题学科变多以后，图/公式大量躲在选项里（选项图、LaTeX 选项）
  const answer = String(q.answer || "").trim().toUpperCase()
  if (options.length !== 4 || !(HOME_SAMPLE_OPTION_IDS as readonly string[]).includes(answer)) {
    return { ok: false, reason: "options", prompt, options }
  }
  for (const opt of options) {
    const optReject = textReject(opt.label)
    if (optReject) return { ok: false, reason: optReject, prompt, options }
    // 选项里也提「如图 / 上表 / 表格」→ 图或表不在题干里，纯文本下做不了
    if (FIG_REF_RE.test(opt.label)) return { ok: false, reason: "figure-ref", prompt, options }
    if (MARKDOWN_EMPHASIS_RE.test(opt.label)) {
      return { ok: false, reason: "markdown", prompt, options }
    }
  }

  return { ok: true, prompt, options }
}
