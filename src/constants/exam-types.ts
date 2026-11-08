// 卷别筛选（「高考真题 / 各区一模 / 各区二模 / 各区期中 / 各区期末」）
//
// 以前是「选项 → tag」的映射，实际数据里 tag 不可靠：图片版化学卷的 tags 一度全写成「二模」，
// 而期末卷基本没打「期末」tag。所以改成按**卷名/来源里的关键词**匹配（题组 title 与 source
// 都以卷名为前缀），tag 只作为「真题」的补充命中。

export interface ExamTypeFilter {
  value: string
  label: string
  keywords: string[]
}

export const EXAM_TYPE_FILTERS: ExamTypeFilter[] = [
  { value: "高考真题", label: "高考真题", keywords: ["真题", "高考"] },
  { value: "各区一模", label: "一模", keywords: ["一模"] },
  { value: "各区二模", label: "二模", keywords: ["二模"] },
  { value: "各区期中", label: "期中", keywords: ["期中"] },
  { value: "各区期末", label: "期末", keywords: ["期末"] },
]

/** 选项值 → 关键词列表；不是已知卷别返回 null */
export function examTypeKeywords(value: string): string[] | null {
  return EXAM_TYPE_FILTERS.find((f) => f.value === value)?.keywords ?? null
}

/**
 * 选项值 → 查询条件片段（title/source 命中任一关键词；真题额外吃 tags）。
 * 返回 null 表示「不按卷别过滤」。
 */
export function examTypeWhere(value: string): Record<string, unknown> | null {
  const keywords = examTypeKeywords(value)
  if (!keywords) return null
  const or = keywords.flatMap((k) => [
    { title: { contains: k, mode: "insensitive" } },
    { source: { contains: k, mode: "insensitive" } },
  ])
  if (value === "高考真题") {
    return { OR: [{ tags: { has: "真题" } }, ...or] }
  }
  return { OR: or }
}
