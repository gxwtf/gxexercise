// 题库编辑器（客户端）用的纯函数工具：标签解析、草稿 diff、保存前校验。
//
// 为什么不放 src/lib/：这些只在客户端表单里用，且不能把 prisma / 服务端依赖带进浏览器包。

import type { GroupFormValues, QuestionFormValues } from "@/components/admin/question-bank/types"

/** 把「英文逗号 / 中文逗号 / 换行」分隔的标签文本解析成数组（去空白、去重、保序） */
export function parseTagsInput(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split(/[,，\n]+/)) {
    const tag = raw.trim()
    if (!tag) continue
    if (!out.includes(tag)) out.push(tag)
  }
  return out
}

/** 标签数组 → 输入框文本 */
export function tagsToInput(tags: string[]): string {
  return tags.join(", ")
}

/** 稳定的值比较（数组 / 对象按 JSON 比，数字 0 与 "0" 不等） */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || a === undefined || b === undefined) return a === b
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b)
  if (typeof a === "object" && typeof b === "object") return JSON.stringify(a) === JSON.stringify(b)
  return false
}

/** 取 after 里相对 before 真正变了的字段（用于只提交改动字段，审计日志更干净） */
export function pickChangedFields<T extends object>(before: T, after: T, keys: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {}
  for (const key of keys) {
    if (!sameValue(before[key], after[key])) out[key] = after[key]
  }
  return out
}

/** 草稿是否有改动 */
export function hasChanges<T extends object>(before: T, after: T, keys: readonly (keyof T)[]): boolean {
  return Object.keys(pickChangedFields(before, after, keys)).length > 0
}

/** 「基本信息」板块的字段（标题 / 学科 / 分类 / 题型 / 标签 / 封面等元信息） */
export const GROUP_BASIC_KEYS = [
  "title",
  "subject",
  "category",
  "questionType",
  "grade",
  "source",
  "answerMode",
  "tags",
  "imageUrl",
] as const satisfies readonly (keyof GroupFormValues)[]

/** 「题组正文」板块的字段（阅读材料 / 语料，单独一个大编辑器） */
export const GROUP_CONTENT_KEYS = ["content"] as const satisfies readonly (keyof GroupFormValues)[]

/** 题组级字段全集：保存时按这个范围算 diff（两个板块共用同一个草稿） */
export const GROUP_FORM_KEYS = [
  ...GROUP_BASIC_KEYS,
  ...GROUP_CONTENT_KEYS,
] as const satisfies readonly (keyof GroupFormValues)[]

export const QUESTION_FORM_KEYS = [
  "questionType",
  "content",
  "options",
  "answer",
  "analysis",
  "score",
  "tags",
  "category",
  "grade",
  "year",
  "source",
] as const satisfies readonly (keyof QuestionFormValues)[]

/** 保存题组前的校验：返回第一个错误文案（null = 通过） */
export function validateGroupDraft(draft: GroupFormValues): string | null {
  if (!draft.title.trim()) return "标题不能为空"
  if (draft.title.trim().length > 255) return "标题不能超过 255 字"
  if (!draft.subject.trim()) return "请选择学科"
  if (!draft.questionType.trim()) return "请选择题型"
  if (!draft.category.trim()) return "类别不能为空"
  if (!draft.source.trim()) return "来源不能为空"
  if (draft.tags.length > 40) return "标签最多 40 个"
  if (draft.tags.some((t) => t.length > 30)) return "单个标签不能超过 30 字"
  if (draft.content.length > 200_000) return "题组正文不能超过 20 万字"
  if (draft.imageUrl.length > 500) return "封面地址不能超过 500 字"
  return null
}

/** 保存小题前的校验 */
export function validateQuestionDraft(draft: QuestionFormValues): string | null {
  if (!draft.questionType.trim()) return "请选择题型"
  if (draft.content.length > 200_000) return "题干不能超过 20 万字"
  if (draft.answer.length > 5_000) return "答案不能超过 5000 字"
  if (draft.analysis.length > 200_000) return "解析不能超过 20 万字"
  if (draft.tags.length > 40) return "标签最多 40 个"
  if (draft.tags.some((t) => t.length > 30)) return "单个标签不能超过 30 字"
  if (draft.year !== null && (!Number.isInteger(draft.year) || draft.year < 1900 || draft.year > 2100)) {
    return "年份应在 1900–2100 之间"
  }
  if (draft.options) {
    if (draft.options.length > 20) return "选项最多 20 个"
    const ids = draft.options.map((o) => o.id.trim())
    if (ids.some((id) => !id)) return "选项的 ID 不能为空"
    if (ids.some((id) => id.length > 10)) return "选项 ID 不能超过 10 个字符"
    if (new Set(ids).size !== ids.length) return "选项 ID 不能重复"
    if (draft.options.some((o) => o.label.length > 5_000)) return "单个选项不能超过 5000 字"
  }
  return null
}

/** 小题在列表里的状态色：有答案 / 无答案 */
export function answerState(draft: QuestionFormValues): "empty" | "ok" {
  return draft.answer.trim() ? "ok" : "empty"
}
