/**
 * 考区（区县）筛选的统一口径。
 *
 * 排序规则（与首页新版一致，产品指定）：
 *   全部 → 北京真题 → 海淀 → 西城 → 东城 → 朝阳 → 丰台 → 石景山 → 其余郊区
 * 郊区按「副中心 / 体量 / 考生规模」大致排：通州、昌平、大兴、顺义、房山，再到门头沟、延庆、怀柔、平谷、密云、燕山。
 *
 * 注意：卷子的区县写在同一份卷的 `source`（= 试卷标题）里，如「2024北京顺义高三一模历史」，
 * 个别老卷 `tags` 里有区县、个别没有，所以**筛选统一按 source/title 包含匹配**，不看 tags。
 */

export const DISTRICTS = [
  "海淀",
  "西城",
  "东城",
  "朝阳",
  "丰台",
  "石景山",
  "通州",
  "昌平",
  "大兴",
  "顺义",
  "房山",
  "门头沟",
  "延庆",
  "怀柔",
  "平谷",
  "密云",
  "燕山",
] as const

export type District = (typeof DISTRICTS)[number]

/** 城区（前六个）/ 郊区，只用于界面分组显示 */
export const CORE_DISTRICTS: readonly string[] = DISTRICTS.slice(0, 6)
export const OUTER_DISTRICTS: readonly string[] = DISTRICTS.slice(6)

/** 「北京真题」在区县行里的固定位置（第一项） */
export const DISTRICT_ZHENTI = "真题"

export interface DistrictOption {
  value: string
  label: string
}

/** 区县筛选按钮（含「全部」与「北京真题」） */
export const DISTRICT_OPTIONS: DistrictOption[] = [
  { value: "all", label: "全部" },
  { value: DISTRICT_ZHENTI, label: "北京真题" },
  ...DISTRICTS.map((d) => ({ value: d, label: d })),
]

export function isDistrictValue(v: string): boolean {
  return v === DISTRICT_ZHENTI || (DISTRICTS as readonly string[]).includes(v)
}
