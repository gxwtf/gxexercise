// 「优秀解答」判定规则（纯函数，服务端与客户端都可安全引用，不依赖数据库）

export const EXCELLENT_ANSWER_LIMIT = 3

/** 判断某小题是否为主观题（题组类型 + 小题类型） */
export function isSubjectiveQuestion(questionType: string, groupType: string): boolean {
  const combined = `${questionType} ${groupType}`
  if (combined.includes("解答") || combined.includes("阅读表达") || combined.includes("reading-expression") || combined.includes("写作") || combined.includes("en-writing")) return true
  // 语文大作文（AI 批改已上线，见 isUngradedQuestion）/ 微写作（仍暂不判分）：写法上都是主观题
  if (groupType === "chinese-essay" || groupType === "chinese-micro-writing") return true
  if (groupType === "chinese-reading" && questionType === "text") return true
  if (groupType === "politics" && questionType === "text") return true
  // 生物大题：每个空都交 AI 判分（填空可能是长句表达）
  if (groupType === "biology-fill") return true
  // 历史 / 地理 / 政治大题：结构与生物同构（材料内联填空 + 小问是主观题），每个小问都交 AI 判分
  if (groupType === "history-fill" || groupType === "geography-fill" || groupType === "politics-fill") return true
  // 物理实验题：结构与生物同构（材料 + 内联空，一个空一条单题），逐空交 AI 判分
  if (groupType === "physics-fill") return true
  // 数学解答题 / 物理计算题：一整道大题 = 一条 text 单题，学生写整题过程。
  // 形态上是主观题（回顾页要有「我的作答 / 参考答案」两块），但**不批阅**（见 isUngradedQuestion）。
  if (groupType === "math-solve" || groupType === "physics-solve") return true
  return false
}

/**
 * 暂不做 AI 判分的题型：语文微写作，以及没有批改提示词、只给参考答案的
 * 数学解答题（math-solve）/ 物理计算题（physics-solve）。
 *
 * 这些必须走这里：提交接口里 isSubjective 为真是写 `pending` 等 Worker 判分的，
 * 而 Worker 只捞「有提示词配置」的题型 —— 若走 pending 会永远卡在「评阅中」。
 *
 * **语文大作文（chinese-essay）已于 2026-11 接入 AI 批改**（v1.5 议论文规格，
 * 模型只做结构化命中判断、分数由 src/lib/essay-score.ts 算），因此不再列在这里 ——
 * 它现在和阅读表达 / 英语作文一样走 `pending` + Worker。
 */
export function isUngradedQuestion(groupType: string): boolean {
  return (
    groupType === "chinese-micro-writing" ||
    groupType === "math-solve" ||
    groupType === "physics-solve"
  )
}

/**
 * 该题型判分是否**依赖**题目里的参考答案（`Question.answer`）。
 *
 * 提交接口 / 重评 / Worker 都有一条前置判断：「参考答案是图片或为空 → skipped，
 * 不判分」。这条判断对语文大作文必须**放行**，原因是它的 answer 字段是历史脏数据：
 * 实测有题组把文言文参考译文、默写答案（2017 组「爽籁发而清风生…」）、甚至「略」
 * 塞进了作文题的 answer，而 v1.5 判分只用「题干 + 学生作文」，与 answer 无关。
 * 若不放行，新录入的、answer 为空的作文题会在提交时被直接置为 skipped（永远不出分）。
 *
 * 其余题型（客观题 / 填空 / 阅读表达 / 英语作文 / 各科大题）都靠参考答案判分，保持原口径。
 */
export function isReferenceAnswerRequired(groupType: string): boolean {
  const t = (groupType || "").trim()
  // 中文别名兜一层：Worker 取提示词时会把「语文作文 / 中文写作 / 大作文」归一成 chinese-essay，
  // 若某个题组真的存的是中文类型名，前置判断也必须同样放行，否则两边口径又对不上。
  return !(t === "chinese-essay" || t === "语文作文" || t === "中文写作" || t === "大作文")
}

interface ExcellentRatio {
  numerator: number
  denominator: number
}

/**
 * 作文类题型的优秀得分率（按 20 分 / 50 分 / 10 分满分标定）
 * 英语作文：得分率 90%（20 分制 = 18 分）；语文大作文 / 微写作：得分率 90%
 */
const EXCELLENT_RATIOS: Record<string, ExcellentRatio> = {
  "en-writing": { numerator: 18, denominator: 20 },
  // 阅读表达：四道小题满分 2/2/3/5，按 90% 算就是 1.8 / 1.8 / 2.7 / 4.5，
  // 也就是 40-42 要满分、第 4 题（43，5 分）4.5 分即达标
  "reading-expression": { numerator: 9, denominator: 10 },
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
      return "英语作文得分率达到 90%（新题相当于 18/20）"
    case "chinese-essay":
      return "语文大作文得分率达到 90%（新题相当于 45/50）"
    case "chinese-micro-writing":
      return "微写作得分率达到 90%（新题相当于 9/10）"
    case "reading-expression":
      return "阅读表达得分率达到 90%（40-42 需满分，第 4 题 5 分制相当于 4.5 分）"
    default:
      return "主观题拿到满分"
  }
}

/** 参考答案是图片（画图/补图/机制图题）：学生无法用文字对上，一律不判分，回顾页只展示参考答案图 */
export function isImageAnswer(correctAnswer: string): boolean {
  return /!\[[^\]]*\]\([^)]*\.(png|jpe?g|gif|webp)/i.test(correctAnswer || "")
}
