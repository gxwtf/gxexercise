import { prisma } from "@/lib/prisma"

import type { LeaderboardMetric, LeaderboardPeriod, LeaderboardRow } from "./leaderboard-shared"

export type { LeaderboardMetric, LeaderboardPeriod, LeaderboardRow }
export { subjectLabel } from "./leaderboard-shared"

/** 北京时间（UTC+8，无夏令时） */
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000

/** 周期起止（含头不含尾），按北京时间计算 */
export function periodRange(period: LeaderboardPeriod, now = new Date()): { start: Date; end: Date } {
  const local = new Date(now.getTime() + TZ_OFFSET_MS)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const d = local.getUTCDate()

  let startLocal: number
  let endLocal: number
  if (period === "week") {
    // 周一为一周开始
    const dow = local.getUTCDay() // 0=周日
    const diffToMonday = (dow + 6) % 7
    startLocal = Date.UTC(y, m, d - diffToMonday)
    endLocal = Date.UTC(y, m, d - diffToMonday + 7)
  } else {
    startLocal = Date.UTC(y, m, 1)
    endLocal = Date.UTC(y, m + 1, 1)
  }
  return { start: new Date(startLocal - TZ_OFFSET_MS), end: new Date(endLocal - TZ_OFFSET_MS) }
}

/**
 * 榜单查询：一次扫描完成「同一周期内同一题只取最高分」再按用户聚合。
 *
 * 复杂度：O(周期内提交数) 一次范围扫描（走 QuestionSubmission.createdAt 索引），
 * 一次 hash 聚合（userId, questionId），再一次按 userId 聚合，最后取 TOP N。
 * 不做 N+1 查询：用户信息用一次 JOIN 带出。
 */
export async function getLeaderboard(opts: {
  period: LeaderboardPeriod
  metric: LeaderboardMetric
  subject?: string | null
  limit?: number
  now?: Date
}): Promise<{ rows: LeaderboardRow[]; start: Date; end: Date }> {
  const { period, metric, subject, limit = 50 } = opts
  const { start, end } = periodRange(period, opts.now ?? new Date())
  const subj = subject && subject !== "全部" ? subject : ""

  const orderBy =
    metric === "count" ? `questions DESC, score DESC` : `score DESC, questions DESC`

  const rows = await prisma.$queryRawUnsafe<LeaderboardRow[]>(
    `
    WITH best AS (
      SELECT s."userId" AS uid,
             s."questionId" AS qid,
             MAX(COALESCE(s."score", 0))::float8 AS sc
      FROM "QuestionSubmission" s
      JOIN "Question" q ON q.id = s."questionId"
      WHERE s."createdAt" >= $1
        AND s."createdAt" < $2
        AND ($3 = '' OR q."subject" = $3)
      GROUP BY s."userId", s."questionId"
    ), agg AS (
      SELECT uid,
             COUNT(*)::int AS questions,
             SUM(sc)::float8 AS score
      FROM best
      GROUP BY uid
    )
    SELECT a.uid AS "userId",
           COALESCE(u."userName", CONCAT('用户', a.uid)) AS name,
           a.questions,
           a.score
    FROM agg a
    LEFT JOIN "User" u ON u.id = a.uid
    ORDER BY ${orderBy}
    LIMIT $4
    `,
    start,
    end,
    subj,
    limit
  )

  return { rows, start, end }
}

/** 有作答记录的学科（用于筛选下拉） */
export async function getLeaderboardSubjects(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ subject: string }[]>(
    `
    SELECT DISTINCT q."subject" AS subject
    FROM "QuestionSubmission" s
    JOIN "Question" q ON q.id = s."questionId"
    ORDER BY 1
    `
  )
  return rows.map((r) => r.subject).filter(Boolean)
}
