// 作答记录页（/records 与 /admin/submissions）共用的常量与格式化函数
//
// 纯函数 + 常量，不依赖数据库；服务端组件与客户端组件都可安全引用。

/** 需要 AI 批改的题型（其余客观题提交即完成批改） */
export const AI_GRADEABLE = ["en-writing", "reading-expression", "作文", "英文写作", "英语作文", "阅读表达"]

export const needsAiGrading = (questionType: string) => AI_GRADEABLE.includes(questionType)

/** 排序方式 → Prisma orderBy */
export const ORDER_MAP: Record<string, Record<string, "asc" | "desc">[]> = {
  time_desc: [{ createdAt: "desc" }],
  time_asc: [{ createdAt: "asc" }],
  score_desc: [{ score: "desc" }, { createdAt: "desc" }],
  score_asc: [{ score: "asc" }, { createdAt: "desc" }],
}

/** 时间显示：2026/10/29 05:56 */
export function formatDateTime(date: Date | null | undefined) {
  if (!date) return "-"
  return new Date(date).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export const round1 = (n: number) => Math.round(n * 10) / 10

/** 得分显示：18 / 20（只有得分时显示 18） */
export const scoreText = (score: number | null | undefined, max: number | null | undefined) => {
  if (score == null) return "-"
  return max ? `${round1(score)} / ${max}` : `${round1(score)}`
}

/** 批改状态 → 中文文案 */
export function gradingStatusText(status: string | null | undefined) {
  switch (status) {
    case "pending":
      return "待批改"
    case "graded":
      return "已批改"
    case "failed":
      return "批改失败"
    default:
      return status || "-"
  }
}

/** 从作答内容 JSON 里取出可读文本（作文/阅读表达为 { answer }，其他题型回退为 JSON） */
export function answerText(content: unknown): string {
  if (content == null) return ""
  if (typeof content === "string") return content
  if (typeof content === "object" && "answer" in (content as Record<string, unknown>)) {
    const answer = (content as { answer?: unknown }).answer
    if (typeof answer === "string") return answer
    if (Array.isArray(answer)) return answer.map((x) => String(x)).join("\n")
  }
  try {
    return JSON.stringify(content, null, 2)
  } catch {
    return ""
  }
}
