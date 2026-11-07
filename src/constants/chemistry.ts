// 化学题型（非选择题）的短名 → 题库分类全名
//
// 分类全名必须和 src/constants/subjects.ts 里 categoryToRoute['化学'] 的键一致，
// 否则题库导航（/questions/chemistry/<route>）里筛不到这些题组。

/** 分类器（exam-parser/chem_category.py）输出的短名 */
export const CHEM_CATEGORY_SHORT_NAMES = ["结构", "原理", "有机", "流程", "探究"] as const
export type ChemCategoryShort = (typeof CHEM_CATEGORY_SHORT_NAMES)[number]

/** 短名 → 题库分类全名 */
export const CHEM_CATEGORY_LABELS: Record<ChemCategoryShort, string> = {
  结构: "物质结构与性质",
  原理: "化学反应原理",
  有机: "有机化学基础",
  流程: "工业流程",
  探究: "实验探究",
}

/** 套卷里「非选择题」那一段的分类名（拆分前的老分类） */
export const CHEM_FILL_CATEGORY = "非选择"

/** 短名转全名；不是已知短名就返回 null（调用方自行决定兜底） */
export function chemCategoryLabel(short: string | null | undefined): string | null {
  if (!short) return null
  return CHEM_CATEGORY_LABELS[short as ChemCategoryShort] ?? null
}
