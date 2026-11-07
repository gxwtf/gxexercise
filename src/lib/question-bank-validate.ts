// 题库编辑接口的请求体解析 + 字段校验（供 groups / questions 两个 PATCH 复用）
//
// 为什么单独抽一个文件：题组和小题有近一半字段规则相同（标签、年级、来源、分值…），
// 两个 route 各写一遍必然漂移；校验口径集中在这里，写库前只有一处需要确认。
//
// 规则（对齐 .cache/plan.md 4.1 / 4.2）：
// - 全部字段可选，只校验请求体里**出现过**的字段（`null` 表示清空）。
// - 未知字段直接忽略（前端多传字段不该导致保存失败）。
// - 单行字段（标题 / 学科 / 类别 / 题型 / 年级 / 来源）去掉首尾空白后再校验，
//   避免「标题全是空格」这种脏数据进库；正文 / 答案 / 解析**不 trim**，原样保存（Markdown 有意义）。
// - 一次请求里任何一个字段不合法就整体失败（400），不做「部分保存」——改题最怕半截生效。
//
// 注意：本文件只做「校验 + 清洗」，不写库；写库与审计日志在 route 里同事务完成。

import { subjects } from "@/constants/subjects"
import { ANSWER_MODE_META } from "@/lib/question-bank-meta"

/** 校验结果：失败时 error 是给界面直接展示的中文原因 */
export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * 一次 PATCH 里允许提交的题组字段（只含出现过的键）。
 * 用 type 而非 interface：interface 没有隐式索引签名，无法传给 buildFieldChanges 的
 * `Record<string, unknown>` 参数。
 */
export type GroupPatch = {
  title?: string
  subject?: string
  category?: string
  questionType?: string
  grade?: string | null
  source?: string
  score?: number
  answerMode?: string
  tags?: string[]
  imageUrl?: string | null
  content?: string
}

/**
 * 小题选项（数据库里是 [{ id, label }]，也存过 A/B/C/D 这种大写 id）。
 * 特意用 type 而不是 interface：type 别名会被 TS 当作可赋给 Prisma 的 Json 输入类型，
 * interface 缺少索引签名会报错。
 */
export type QuestionOption = {
  id: string
  label: string
}

/** 一次 PATCH 里允许提交的小题字段（只含出现过的键）。同样用 type，理由见 GroupPatch。 */
export type QuestionPatch = {
  questionType?: string
  content?: string
  options?: QuestionOption[] | null
  answer?: string
  analysis?: string | null
  score?: number
  tags?: string[]
  category?: string
  grade?: string | null
  year?: number | null
  source?: string
}

// ---------- 长度 / 数量上限（与 plan.md 及 schema 的 VarChar 对齐） ----------

const TITLE_MAX = 255
const SUBJECT_MAX = 100
const CATEGORY_MAX = 100
const QUESTION_TYPE_MAX = 100
const GRADE_MAX = 50
const SOURCE_MAX = 200
const IMAGE_URL_MAX = 500
/** 题组正文 / 小题正文 / 解析这类 Text 字段的上限（远小于 Postgres TEXT，只是防手滑） */
const LONG_TEXT_MAX = 200_000
const ANSWER_MAX = 5_000
const TAG_MAX_COUNT = 40
const TAG_ITEM_MAX = 30
const OPTION_MAX_COUNT = 20
const OPTION_ID_MAX = 10
const OPTION_LABEL_MAX = 5_000
// 分值：0 分是合法的（主观题/附加题为 0），但有上限防止把题组分值打成 1e9
const SCORE_MIN = 0
const SCORE_MAX = 300
const YEAR_MIN = 1900
const YEAR_MAX = 2100

/** 作答模式候选直接取自共享元数据，避免与界面的下拉不一致 */
const ANSWER_MODES = ANSWER_MODE_META.map((m) => m.value)

// 封面地址：只接受站内绝对路径（/api/covers/x.jpg）或 http(s) 外链，
// 挡掉 `javascript:` / `data:` 之类会被塞进 <img src> 的东西。
const IMAGE_URL_RE = /^(\/|https?:\/\/)\S+$/

/** 字段校验失败：用异常在嵌套校验里提前返回，parse* 里统一转成 400 文案 */
class FieldError extends Error {}

function fail(message: string): never {
  throw new FieldError(message)
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key)
}

// ---------- 基础字段校验 ----------

/** 单行文本：trim → 非空 / 长度检查 */
function text(value: unknown, label: string, max: number, allowEmpty = false): string {
  if (typeof value !== "string") fail(`${label}必须是字符串`)
  const clean = value.trim()
  if (!allowEmpty && clean.length === 0) fail(`${label}不能为空`)
  if (clean.length > max) fail(`${label}最多 ${max} 个字符`)
  return clean
}

/** 多行文本（正文 / 答案）：原样保留，只查长度和类型 */
function longText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string") fail(`${label}必须是字符串`)
  if (value.length > max) fail(`${label}最多 ${max} 个字符`)
  return value
}

/** 可清空字段：null / 空串都归一成 null，写库时即「清空」 */
function nullableText(value: unknown, label: string, max: number): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") fail(`${label}必须是字符串`)
  const clean = value.trim()
  if (clean.length === 0) return null
  if (clean.length > max) fail(`${label}最多 ${max} 个字符`)
  return clean
}

/** 可清空长文本（解析）：同样把纯空白归一成 null */
function nullableLongText(value: unknown, label: string, max: number): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") fail(`${label}必须是字符串`)
  if (value.trim().length === 0) return null
  if (value.length > max) fail(`${label}最多 ${max} 个字符`)
  return value
}

/** 枚举：只接受候选值之一 */
function enumValue(value: unknown, label: string, allowed: readonly string[]): string {
  if (typeof value !== "string") fail(`${label}必须是字符串`)
  if (!allowed.includes(value)) fail(`${label}只能是：${allowed.join(" / ")}`)
  return value
}

/** 分值：number 类型（布尔、数字字符串都不接受，避免 "5" 变成 5 后前端状态对不上） */
function scoreValue(value: unknown, label: string, integerOnly: boolean): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label}必须是数字`)
  if (integerOnly && !Number.isInteger(value)) fail(`${label}必须是整数`)
  if (value < SCORE_MIN || value > SCORE_MAX) fail(`${label}必须在 ${SCORE_MIN}~${SCORE_MAX} 之间`)
  return value
}

/** 年份：整数范围校验，null 表示清空 */
function nullableYear(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "number" || !Number.isInteger(value)) fail("年份必须是整数")
  if (value < YEAR_MIN || value > YEAR_MAX) fail(`年份必须在 ${YEAR_MIN}~${YEAR_MAX} 之间`)
  return value
}

/**
 * 标签：字符串数组。
 * 逐个 trim 并丢掉空项 —— 标签输入框很容易留下空标签，为它报 400 对用户毫无意义。
 */
function tagList(value: unknown): string[] {
  if (!Array.isArray(value)) fail("标签必须是字符串数组")
  if (value.length > TAG_MAX_COUNT) fail(`标签最多 ${TAG_MAX_COUNT} 个`)
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string") fail("标签必须是字符串数组")
    const clean = item.trim()
    if (!clean) continue
    if (clean.length > TAG_ITEM_MAX) fail(`单个标签最多 ${TAG_ITEM_MAX} 个字符`)
    out.push(clean)
  }
  return out
}

/**
 * 小题选项：null / [] 都表示「没有选项」。
 * id 组内唯一（大小写不敏感：A 和 a 在判题时会被当成同一个选项，不能同时存在）。
 */
function optionList(value: unknown): QuestionOption[] | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value)) fail("选项必须是数组")
  if (value.length > OPTION_MAX_COUNT) fail(`选项最多 ${OPTION_MAX_COUNT} 个`)
  const out: QuestionOption[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) fail("每个选项必须是 { id, label } 对象")
    const raw = item as Record<string, unknown>
    const id = text(raw.id, "选项 id", OPTION_ID_MAX)
    const key = id.toLowerCase()
    if (seen.has(key)) fail(`选项 id 重复：${id}`)
    seen.add(key)
    if (typeof raw.label !== "string") fail("选项内容必须是字符串")
    if (raw.label.length > OPTION_LABEL_MAX) fail(`选项内容最多 ${OPTION_LABEL_MAX} 个字符`)
    out.push({ id, label: raw.label })
  }
  return out
}

/** 封面地址：null / "" 都存 null */
function imageUrlValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") fail("封面地址必须是字符串")
  const clean = value.trim()
  if (!clean) return null
  if (clean.length > IMAGE_URL_MAX) fail(`封面地址最多 ${IMAGE_URL_MAX} 个字符`)
  if (!IMAGE_URL_RE.test(clean)) fail("封面地址必须是站内路径或以 http(s):// 开头")
  return clean
}

/** 可以「清空」的字段（库里 NULL / "" 都表示未填写） */
export const GROUP_NULLABLE_FIELDS = ["grade", "imageUrl"] as const
export const QUESTION_NULLABLE_FIELDS = ["grade", "analysis", "year"] as const

/**
 * diff 前把旧值里的空串也归一成 null。
 *
 * 为什么需要：历史数据里 grade 既有 NULL 也有 ""（实测题组里两种都有），
 * 而请求体里的 "" 在校验层已归一成 null。若直接比较，"" 与 null 会被判成「变了」，
 * 于是前端什么都没改也会刷出一条「年级」假日志 —— 与「无实际变化不写日志」冲突。
 */
export function normalizeEmptyToNull(
  source: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...source }
  for (const field of fields) {
    if (out[field] === "") out[field] = null
  }
  return out
}

// ---------- 请求体读取 ----------

/**
 * 读 JSON 对象请求体。
 * 空 body / JSON 语法错误 / 顶层不是对象（数组、字符串、null）一律 400。
 */
export async function readJsonObject(request: Request): Promise<ValidationResult<Record<string, unknown>>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, error: "请求体不是合法的 JSON" }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "请求体必须是 JSON 对象" }
  }
  return { ok: true, data: raw as Record<string, unknown> }
}

// ---------- 题组 / 小题的字段解析 ----------

/** 校验题组 PATCH 的请求体，返回「只含出现过的字段」的 patch */
export function parseGroupPatch(body: Record<string, unknown>): ValidationResult<GroupPatch> {
  try {
    const patch: GroupPatch = {}
    if (has(body, "title")) patch.title = text(body.title, "标题", TITLE_MAX)
    if (has(body, "subject")) patch.subject = enumValue(body.subject, "学科", subjects)
    if (has(body, "category")) patch.category = text(body.category, "类别", CATEGORY_MAX, true)
    if (has(body, "questionType")) patch.questionType = text(body.questionType, "题型", QUESTION_TYPE_MAX)
    if (has(body, "grade")) patch.grade = nullableText(body.grade, "年级", GRADE_MAX)
    if (has(body, "source")) patch.source = text(body.source, "来源", SOURCE_MAX, true)
    // QuestionGroup.score 是 Int 列，只收整数；小数会被 prisma 直接报错，不如在这里挡住
    if (has(body, "score")) patch.score = scoreValue(body.score, "分值", true)
    if (has(body, "answerMode")) patch.answerMode = enumValue(body.answerMode, "作答模式", ANSWER_MODES)
    if (has(body, "tags")) patch.tags = tagList(body.tags)
    if (has(body, "imageUrl")) patch.imageUrl = imageUrlValue(body.imageUrl)
    if (has(body, "content")) patch.content = longText(body.content, "题组正文", LONG_TEXT_MAX)
    return { ok: true, data: patch }
  } catch (error) {
    if (error instanceof FieldError) return { ok: false, error: error.message }
    throw error
  }
}

/** 校验小题 PATCH 的请求体 */
export function parseQuestionPatch(body: Record<string, unknown>): ValidationResult<QuestionPatch> {
  try {
    const patch: QuestionPatch = {}
    if (has(body, "questionType")) patch.questionType = text(body.questionType, "题型", QUESTION_TYPE_MAX)
    if (has(body, "content")) patch.content = longText(body.content, "题干", LONG_TEXT_MAX)
    if (has(body, "options")) patch.options = optionList(body.options)
    // 答案不做 trim：填空/默写的答案前后空白由判题逻辑自己处理，这里不替用户改内容
    if (has(body, "answer")) patch.answer = longText(body.answer, "答案", ANSWER_MAX)
    if (has(body, "analysis")) patch.analysis = nullableLongText(body.analysis, "解析", LONG_TEXT_MAX)
    // Question.score 是 Float 列，允许小数（如完形填空每题 1.5 分）
    if (has(body, "score")) patch.score = scoreValue(body.score, "分值", false)
    if (has(body, "tags")) patch.tags = tagList(body.tags)
    if (has(body, "category")) patch.category = text(body.category, "类别", CATEGORY_MAX, true)
    if (has(body, "grade")) patch.grade = nullableText(body.grade, "年级", GRADE_MAX)
    if (has(body, "year")) patch.year = nullableYear(body.year)
    if (has(body, "source")) patch.source = text(body.source, "来源", SOURCE_MAX, true)
    return { ok: true, data: patch }
  } catch (error) {
    if (error instanceof FieldError) return { ok: false, error: error.message }
    throw error
  }
}

// 导出的上限常量给路由/测试引用（避免测试里再抄一遍数字）
export const QUESTION_BANK_LIMITS = {
  TITLE_MAX,
  SUBJECT_MAX,
  CATEGORY_MAX,
  QUESTION_TYPE_MAX,
  GRADE_MAX,
  SOURCE_MAX,
  IMAGE_URL_MAX,
  LONG_TEXT_MAX,
  ANSWER_MAX,
  TAG_MAX_COUNT,
  TAG_ITEM_MAX,
  OPTION_MAX_COUNT,
  OPTION_ID_MAX,
  OPTION_LABEL_MAX,
  SCORE_MIN,
  SCORE_MAX,
  YEAR_MIN,
  YEAR_MAX,
} as const
