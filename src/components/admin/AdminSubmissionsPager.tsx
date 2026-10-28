"use client"

import { PageBar } from "@/components/PageBar"

interface AdminSubmissionsPagerProps {
  page: number
  pageCount: number
  /** 当前筛选条件（可序列化），用于拼分页链接 */
  query: Record<string, string>
}

/** 管理员提交记录分页条：在客户端根据筛选条件拼 href */
export function AdminSubmissionsPager({ page, pageCount, query }: AdminSubmissionsPagerProps) {
  const build = (p: number) => {
    const params = new URLSearchParams(query)
    if (p > 1) params.set("page", String(p))
    else params.delete("page")
    const qs = params.toString()
    return qs ? `/admin/submissions?${qs}` : "/admin/submissions"
  }
  return <PageBar page={page} pageCount={pageCount} hrefForPage={build} showLabel={false} />
}
