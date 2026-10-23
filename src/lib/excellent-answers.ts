// 「优秀解答」查询（需要数据库）

import { prisma } from "./prisma"
import { EXCELLENT_ANSWER_LIMIT, excellentScoreThreshold } from "./excellent-answer-rules"

export interface ExcellentAnswerRecord {
  id: string
  userId: number
  userName: string | null
  score: number
  maxScore: number
  answer: string
  createdAt: Date
}

/**
 * 取某道小题的优秀解答：按得分高到低，同一用户只保留最高一次，最多 limit 条。
 * 调用方需先用 isSubjectiveQuestion 判断是否主观题。
 */
export async function findExcellentAnswers(
  questionId: string,
  groupType: string,
  maxScore: number,
  limit: number = EXCELLENT_ANSWER_LIMIT,
): Promise<ExcellentAnswerRecord[]> {
  if (maxScore <= 0) return []

  const threshold = excellentScoreThreshold(groupType, maxScore)
  // 先多取一些候选，再在内存里按「同一位同学只取最高一次」去重
  const candidates = await prisma.questionSubmission.findMany({
    where: {
      questionId,
      shareAsExcellent: true,
      score: { not: null, gte: threshold },
    },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: Math.max(limit * 20, 60),
    select: {
      id: true,
      userId: true,
      score: true,
      content: true,
      createdAt: true,
      user: { select: { userName: true } },
    },
  })

  const seenUsers = new Set<number>()
  const result: ExcellentAnswerRecord[] = []
  for (const candidate of candidates) {
    if (result.length >= limit) break
    if (candidate.score == null) continue
    const answer = ((candidate.content as { answer?: string } | null)?.answer ?? "").trim()
    if (!answer) continue
    if (seenUsers.has(candidate.userId)) continue
    seenUsers.add(candidate.userId)
    result.push({
      id: candidate.id,
      userId: candidate.userId,
      userName: candidate.user.userName,
      score: candidate.score,
      maxScore,
      answer,
      createdAt: candidate.createdAt,
    })
  }
  return result
}
