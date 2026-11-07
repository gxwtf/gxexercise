"use client"

import { PageBar } from "@/components/PageBar"

interface QuestionBankPagerProps {
  page: number
  pageCount: number
  /** 当前筛选条件（可序列化），用于拼分页链接 */
  query: Record<string, string>
  /** 分页链接的基础路径；修改记录页复用同一个分页条 */
  basePath?: string
}

/**
 * 题组列表分页条：链接由服务端分页决定，这里只负责拼 href。
 * 复用 PageBar（不显示「共 N 条」文案，总数已在页面副标题里给出）。
 */
export function QuestionBankPager({ page, pageCount, query, basePath = "/admin/questions" }: QuestionBankPagerProps) {
  const build = (p: number) => {
    const params = new URLSearchParams(query)
    if (p > 1) params.set("page", String(p))
    else params.delete("page")
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }
  return <PageBar page={page} pageCount={pageCount} hrefForPage={build} showLabel={false} />
}
