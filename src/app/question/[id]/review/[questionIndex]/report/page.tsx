import { redirect } from "next/navigation"

interface PageProps {
  params: Promise<{ id: string; questionIndex: string }>
}

/**
 * 旧的「批改报告」预览页已弃用：
 * PDF 改为服务端生成、直接下载（/question/<id>/review/<i>/pdf），不再前端预览。
 * 这里保留路由做重定向，避免旧链接 404。
 */
export default async function EssayReportPage({ params }: PageProps) {
  const { id, questionIndex } = await params
  redirect(`/question/${id}/review/${questionIndex}/pdf`)
}
