"use client"

import { PageBar } from "@/components/PageBar"

interface RecordsPagerProps {
  page: number
  pageCount: number
  /** 当前筛选条件（可序列化），用于拼分页链接 */
  query: Record<string, string>
}

/** 分页条：在客户端根据筛选条件拼 href（服务端组件不能直接传函数给客户端组件） */
export function RecordsPager({ page, pageCount, query }: RecordsPagerProps) {
  const build = (p: number) => {
    const params = new URLSearchParams(query)
    if (p > 1) params.set("page", String(p))
    else params.delete("page")
    const qs = params.toString()
    return qs ? `/records?${qs}` : "/records"
  }
  return <PageBar page={page} pageCount={pageCount} hrefForPage={build} showLabel={false} />
}
