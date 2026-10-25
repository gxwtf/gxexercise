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

/** 题库里存在的学科（用于筛选下拉；不依赖是否有作答记录） */
export async function getLeaderboardSubjects(): Promise<string[]> {
  const rows = await prisma.question.findMany({
    distinct: ["subject"],
    select: { subject: true },
    orderBy: { subject: "asc" },
  })
  return rows.map((r) => r.subject).filter(Boolean)
}

export interface MyRank {
  questions: number
  score: number
  rankCount: number
  rankScore: number
  totalUsers: number
}

/**
 * 当前用户在某个周期内的排名（两项指标一次查询算出）。
 * 用窗口函数在聚合结果上算 RANK，避免再扫一次全表。
 */
export async function getMyRank(opts: {
  period: LeaderboardPeriod
  subject?: string | null
  userId: number
  now?: Date
}): Promise<MyRank | null> {
  const { period, subject, userId } = opts
  if (!userId) return null
  const { start, end } = periodRange(period, opts.now ?? new Date())
  const subj = subject && subject !== "全部" ? subject : ""

  const rows = await prisma.$queryRawUnsafe<
    { questions: number; score: number; rank_count: number; rank_score: number; total: number }[]
  >(
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
      SELECT uid, COUNT(*)::int AS questions, SUM(sc)::float8 AS score
      FROM best GROUP BY uid
    ), ranked AS (
      SELECT uid, questions, score,
             RANK() OVER (ORDER BY questions DESC, score DESC)::int AS rank_count,
             RANK() OVER (ORDER BY score DESC, questions DESC)::int AS rank_score
      FROM agg
    ), totals AS (SELECT COUNT(*)::int AS total FROM agg)
    SELECT r.questions, r.score, r.rank_count, r.rank_score, t.total
    FROM ranked r CROSS JOIN totals t
    WHERE r.uid = $4
    `,
    start,
    end,
    subj,
    userId
  )
  if (!rows.length) return null
  const r = rows[0]
  return {
    questions: r.questions,
    score: r.score,
    rankCount: r.rank_count,
    rankScore: r.rank_score,
    totalUsers: r.total,
  }
}
