"use client"

import { useEffect } from "react"
import { readListUrl, readPracticeEntry, rememberPracticeEntry } from "@/lib/practice-entry"

/**
 * 给「一套卷里的每个题组」补一条来路记录，供做题页 / 回顾页的「返回」使用。
 *
 * 以前是拿 document.referrer 推的：站内跳转是客户端路由，referrer 永远停在整页加载那一页，
 * 经常推出「上一页是首页 / 上上个列表」这种错值。现在统一用列表页现场记下的地址
 * （含 ?year=2020 这类筛选条件），且**不覆盖**点卡片时已经按 id 记好的那份。
 */
export function PracticeEntryTracker({ groupIds }: { groupIds: string[] }) {
  const key = groupIds.join(",")
  useEffect(() => {
    if (typeof window === "undefined") return
    const listUrl = readListUrl()
    if (!listUrl) return
    const current = window.location.pathname + window.location.search
    if (listUrl === current) return
    for (const id of key.split(",").filter(Boolean)) {
      if (!readPracticeEntry(id)) rememberPracticeEntry(id, listUrl)
    }
  }, [key])
  return null
}
