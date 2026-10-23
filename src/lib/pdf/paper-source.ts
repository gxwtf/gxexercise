/**
 * 把 Prisma 查出来的题组数据整理成「纸质作答卷」需要的最小结构
 * （不直接依赖 Prisma 生成类型，方便单测 / 脚本复用）
 */
import type { PaperGroupInput, PaperOption, PaperQuestionInput } from "./paper-doc"

export interface QuestionSource {
  id: string
  questionType: string
  content: string | null
  options: unknown
  score: number
}

export interface GroupSource {
  id: string
  title: string
  questionType: string
  category: string
  content: string | null
  score: number
  groupItems: { question: QuestionSource }[]
}

/** options 在库里是 Json：正常是 [{id,label}]，脏数据里也可能出现字符串项 */
export function toOptions(value: unknown): PaperOption[] {
  if (!Array.isArray(value)) return []
  const out: PaperOption[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    const id = typeof rec.id === "string" ? rec.id : ""
    const label =
      typeof rec.label === "string" ? rec.label : typeof rec.text === "string" ? rec.text : ""
    if (!id && !label) continue
    out.push({ id, label })
  }
  return out
}

/** 题组列表 → 卷面结构，题号按各组小题数连续编排 */
export function toPaperGroups(groups: GroupSource[], startNumber = 1): PaperGroupInput[] {
  let offset = startNumber
  return groups.map((group) => {
    const start = offset
    const questions: PaperQuestionInput[] = group.groupItems.map((item, index) => ({
      number: start + index,
      questionType: item.question.questionType,
      content: item.question.content ?? "",
      options: toOptions(item.question.options),
      score: item.question.score ?? 0,
    }))
    offset += questions.length
    return {
      id: group.id,
      title: group.title,
      questionType: group.questionType,
      category: group.category,
      content: group.content ?? "",
      score: group.score ?? 0,
      startNumber: start,
      questions,
    }
  })
}
