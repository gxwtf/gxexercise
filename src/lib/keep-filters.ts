"use client"

/**
 * 「记忆筛选」的口径：**以离开页面那一刻地址栏里的参数为准**。
 *
 * 之前用 `useEffect` 把参数存成 state，只有 pathname 变化才刷新，
 * 于是「点清除 → 地址栏已经干净了 → 但 state 还是旧的」会导致换学科时把已清掉的筛选又带回来。
 * 所以这里统一在**点击的瞬间**读 `window.location.search`，清除之后自然就没有记忆了。
 */

/** 需要在换学科 / 换题型时带过去的参数（page 不带，避免翻到不存在的页） */
export const KEEP_FILTER_KEYS = ["cat", "district", "year", "grade", "q"] as const

/** 读当前地址栏里的筛选参数，返回 `?a=b&c=d` 或空串（"all" 视为未筛选） */
export function currentFiltersQuery(): string {
  if (typeof window === "undefined") return ""
  const sp = new URLSearchParams(window.location.search)
  const params = new URLSearchParams()
  for (const key of KEEP_FILTER_KEYS) {
    const v = sp.get(key)
    if (v && v !== "all") params.set(key, v)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

/** 目标地址 + 当前筛选 */
export function withCurrentFilters(href: string): string {
  return `${href}${currentFiltersQuery()}`
}
