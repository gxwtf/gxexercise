"use client"

import { useEffect } from "react"

/**
 * 记录「进入做题页之前的那一页」。
 * 回顾页的返回按钮会优先回到这里，而不是退回到做题页本身。
 * 用 sessionStorage 按题组 id 存，避免多标签/多题组互相覆盖。
 */
export function PracticeEntryTracker({ groupIds }: { groupIds: string[] }) {
  const key = groupIds.join(",")
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const from = document.referrer || ""
      if (!from || from.includes("/review")) return
      const url = new URL(from)
      if (url.origin !== window.location.origin) return
      for (const id of key.split(",").filter(Boolean)) {
        sessionStorage.setItem(`practice_entry_${id}`, url.pathname + url.search)
      }
    } catch {
      /* 忽略 */
    }
  }, [key])
  return null
}
