import { prisma } from "@/lib/prisma"

/**
 * 首页「最近谁练了什么」的取数（类似直播带货的「谁又下了一单」，这里是「谁又交了一套」）。
 *
 * 口径：
 * 1. 只取**已提交**的记录：整卷（TestPaperSubmission）与题组（QuestionGroupSubmission，不含套卷内的题组，
 *    否则一套卷会被拆成好几条刷屏）；
 * 2. 每条都要有分数（`score != null`），否则「完成」没有意义；
 * 3. **同一用户只保留最近一条**，避免一个人连刷占满整个滚动条；
 * 4. 排除当前登录用户（自己刚交完就刷到自己很怪）；
 * 5. 用户名为空时显示「匿名同学」，与管理后台/榜单口径一致。
 */

export interface ActivityItem {
  id: string
  kind: "paper" | "group"
  /** 显示用：用户名 */
  userName: string
  /** 显示用：卷名 / 题组名 */
  title: string
  href: string
  score: number | null
  max: number | null
  at: Date
}

export async function getRecentActivity(opts: {
  limit?: number
  excludeUserId?: number
} = {}): Promise<ActivityItem[]> {
  const limit = Math.min(Math.max(opts.limit ?? 6, 1), 20)
  const excludeUserId = opts.excludeUserId && opts.excludeUserId > 0 ? opts.excludeUserId : 0

  const [papers, groups] = await Promise.all([
    prisma.testPaperSubmission.findMany({
      where: { score: { not: null }, ...(excludeUserId ? { userId: { not: excludeUserId } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        score: true,
        createdAt: true,
        userId: true,
        user: { select: { userName: true } },
        testPaper: { select: { id: true, title: true, totalScore: true } },
      },
    }),
    prisma.questionGroupSubmission.findMany({
      where: {
        score: { not: null },
        testSubmissionId: null,
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        score: true,
        createdAt: true,
        userId: true,
        user: { select: { userName: true } },
        questionGroup: { select: { id: true, title: true, score: true } },
      },
    }),
  ])

  const merged: ActivityItem[] = [
    ...papers.map((p) => ({
      id: p.id,
      kind: "paper" as const,
      userName: (p.user?.userName || "").trim() || "匿名同学",
      title: p.testPaper.title,
      href: `/test-paper/${p.testPaper.id}/result/${p.id}`,
      score: p.score,
      max: p.testPaper.totalScore ?? null,
      at: p.createdAt,
      _uid: p.userId,
    })),
    ...groups.map((g) => ({
      id: g.id,
      kind: "group" as const,
      userName: (g.user?.userName || "").trim() || "匿名同学",
      title: g.questionGroup.title,
      href: `/question/${g.questionGroup.id}/review/1`,
      score: g.score,
      max: g.questionGroup.score ?? null,
      at: g.createdAt,
      _uid: g.userId,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    // 同一用户只留最近一条
    .filter((item, index, arr) => arr.findIndex((x) => x._uid === item._uid) === index)
    .slice(0, limit)
    .map(({ _uid: _drop, ...rest }) => rest)

  return merged
}

/** 相对时间标签：刚刚 / N 分钟前 / N 小时前 / N 天前 / YYYY-MM-DD */
export function relativeTimeLabel(at: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - at.getTime())
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return "刚刚"
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 8) return `${day} 天前`
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`
}
