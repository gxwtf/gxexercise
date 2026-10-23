// 「优秀解答」判定规则（纯函数，服务端与客户端都可安全引用，不依赖数据库）

export const EXCELLENT_ANSWER_LIMIT = 3

/** 判断某小题是否为主观题（题组类型 + 小题类型） */
export function isSubjectiveQuestion(questionType: string, groupType: string): boolean {
  const combined = `${questionType} ${groupType}`
  if (combined.includes("解答") || combined.includes("阅读表达") || combined.includes("reading-expression") || combined.includes("写作") || combined.includes("en-writing")) return true
  // 语文大作文 / 微写作虽然暂不判分，但写法上仍是主观题
  if (groupType === "chinese-essay" || groupType === "chinese-micro-writing") return true
  if (groupType === "chinese-reading" && questionType === "text") return true
  if (groupType === "politics" && questionType === "text") return true
  return false
}

/** 暂不做 AI 判分的题型（语文微写作、大作文） */
export function isUngradedQuestion(groupType: string): boolean {
  return groupType === "chinese-essay" || groupType === "chinese-micro-writing"
}

interface ExcellentRatio {
  numerator: number
  denominator: number
}

/** 作文类题型的优秀得分率（按最新 20 分 / 50 分 / 10 分满分标定） */
const EXCELLENT_RATIOS: Record<string, ExcellentRatio> = {
  "en-writing": { numerator: 19, denominator: 20 },
  "chinese-essay": { numerator: 45, denominator: 50 },
  "chinese-micro-writing": { numerator: 9, denominator: 10 },
}

/** 该题组里一道小题的「优秀」分数线（普通主观题取满分） */
export function excellentScoreThreshold(groupType: string, maxScore: number): number {
  const ratio = EXCELLENT_RATIOS[groupType]
  if (!ratio) return maxScore
  return (maxScore * ratio.numerator) / ratio.denominator
}

export function meetsExcellentStandard(groupType: string, score: number | null | undefined, maxScore: number): boolean {
  if (score == null || !Number.isFinite(score) || maxScore <= 0) return false
  return score >= excellentScoreThreshold(groupType, maxScore) - 1e-6
}

/** 回顾页「暂无优秀解答」时展示的达标说明 */
export function excellentCriteriaText(groupType: string): string {
  switch (groupType) {
    case "en-writing":
      return "英语作文得分率达到 95%（新题相当于 19/20）"
    case "chinese-essay":
      return "语文大作文得分率达到 90%（新题相当于 45/50）"
    case "chinese-micro-writing":
      return "微写作得分率达到 90%（新题相当于 9/10）"
    default:
      return "主观题拿到满分"
  }
}
