/** 广学榜：客户端/服务端都能用的纯函数（不引入 prisma） */
export type LeaderboardMetric = "count" | "score"
export type LeaderboardPeriod = "week" | "month"

export interface LeaderboardRow {
  userId: number
  name: string
  questions: number
  score: number
}

/** 学科展示名：全部 → 总榜，数学 → 数学榜 */
export function subjectLabel(subject: string) {
  return subject === "全部" ? "总榜" : `${subject}榜`
}
