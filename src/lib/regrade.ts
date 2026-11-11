/**
 * 管理员手动重评（答案 / 分值 / 评分提示词被改过之后，按最新口径重算历史作答）
 *
 * 为什么需要它：题目的参考答案、分值、AI 批改提示词都在被持续修订，但历史作答的分数是
 * 「提交那一刻」算的。客观题的分数完全由「作答 + 参考答案 + 判分规则」决定，改完答案
 * 必须能一键重算；主观题（有批改提示词的题型）这里算不了（要调 AI），只能把记录重新丢回
 * 队列，等 GradingWorker 批完再回写 —— 两者对管理员来说是同一个「重评」动作。
 *
 * 判分口径的真源（**改这里的逻辑前，必须先确认下面几处仍然一致**，否则同一份作答会因为
 * 从「提交」还是从「重评」进来而得到不同分数）：
 * - 客观题 / 主观题分类、空作答、图片答案：src/app/api/submissions/group/route.ts
 *   （套卷是 .../test-paper/route.ts，两份代码同构）
 * - 组级聚合、套卷总分回算：src/lib/grading-worker.ts
 *
 * 本文件只做「服务端重算」，不碰任何写库之外的事情；一次请求的重评范围由调用方（API 路由）
 * 校验后传进来。
 */

import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { isAnswerCorrect, isCaseSensitiveAnswer } from "@/lib/answer-check"
import { isImageAnswer, isSubjectiveQuestion, isUngradedQuestion } from "@/lib/excellent-answer-rules"
import { aggregatePickOne, isPickOneMode } from "@/lib/pick-one"
import { getGradingPrompt } from "@/lib/grading-prompts"

/** 一次最多指定的作答记录数（作答详情页里勾选的那几份） */
export const REGRADE_MAX_GROUPS = 20

/**
 * 一次最多重评多少「份作答」。
 *
 * 「重评该题组的全部作答」会把这个题组的历史作答全部展开，量级不可控，
 * 所以硬性封顶；超了就让管理员分批做，而不是让一个请求跑几分钟再超时。
 */
export const REGRADE_MAX_QUESTIONS = 200

/** 重评目标：一份作答（题组提交）；可选只重评其中某几道小题 */
export interface RegradeTarget {
  groupSubmissionId: string
  /** 指定只重评这些小题；不传 = 该份作答下的全部小题 */
  questionIds?: string[]
}

/**
 * 单题重评结果：
 * - objective-changed / objective-unchanged：按最新参考答案重新判了分（变了 / 没变）。
 *   「主观题但是空作答」走的是同一套确定性判分（0 分 / 已批阅），因此也归到这两个值：
 *   RegradeOutcome 里没有更贴切的名字，而它在界面上就是「已重算」这一类。
 * - requeued：主观题重新排队，等 GradingWorker（或预检）出分
 * - skipped：按现行口径无法重判（图片答案 / 无提示词 / 暂不批阅题型），保持原状态
 * - error：该小题重评出错，不影响同一份作答里的其它小题
 */
export type RegradeOutcome =
  | "objective-changed"
  | "objective-unchanged"
  | "requeued"
  | "skipped"
  | "error"

/** 小题的三元快照（重评前 / 重评后都用它，便于前端直接对比） */
export interface RegradeQuestionSnapshot {
  score: number | null
  isCorrect: boolean | null
  gradingStatus: string
}

export interface RegradeQuestionResult {
  questionSubmissionId: string
  questionId: string
  /** 该小题在题组里的位置（与 Worker 取提示词用的下标一致，0 起） */
  index: number
  /** 展示用题号：第 N 题 */
  label: string
  outcome: RegradeOutcome
  /** skipped / error 时给管理员看的原因 */
  message?: string
  before: RegradeQuestionSnapshot
  after: RegradeQuestionSnapshot
}

export interface RegradeGroupSnapshot {
  score: number | null
  correctNum: number | null
  totalNum: number | null
}

export interface RegradeGroupResult {
  groupSubmissionId: string
  userId: number
  userName: string | null
  groupTitle: string
  before: RegradeGroupSnapshot
  after: RegradeGroupSnapshot
  questions: RegradeQuestionResult[]
}

/** 单份作答重评失败（记录不存在 / 事务失败），由路由决定怎么向管理员汇报 */
export interface RegradeFailure {
  id: string
  error: string
  /** 记录不存在（路由据此回 404，而不是 500） */
  notFound?: boolean
}

export interface RegradeRun {
  groups: RegradeGroupResult[]
  failed: RegradeFailure[]
}

/** 判分快照里分数的比较：Float 列有浮点噪声，不能直接 === */
function sameScore(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b
  return Math.abs(a - b) < 1e-6
}

function sameSnapshot(a: RegradeQuestionSnapshot, b: RegradeQuestionSnapshot): boolean {
  return sameScore(a.score, b.score) && a.isCorrect === b.isCorrect && a.gradingStatus === b.gradingStatus
}

/** 作答内容里取字符串答案（content 是 Json 列，历史数据可能不是 {answer:string}） */
function readAnswer(content: unknown): string {
  const answer = (content as { answer?: unknown } | null)?.answer
  if (typeof answer === "string") return answer
  if (answer === null || answer === undefined) return ""
  return String(answer)
}

/** 单题重评的规划结果：要写什么、结果快照是什么 */
interface PlannedQuestion {
  rowId: string
  result: RegradeQuestionResult
  /** 需要写库的字段；undefined = 不改库（skipped / error / 未变化） */
  write?: Prisma.QuestionSubmissionUpdateInput
}

interface PlanInput {
  row: {
    id: string
    questionId: string
    content: unknown
    score: number | null
    isCorrect: boolean | null
    gradingStatus: string
  }
  question: {
    questionType: string
    answer: string
    score: number
  }
  /** 该小题在题组里的位置（= Worker 里 orderBy orderIndex 后的 findIndex） */
  index: number
  /** 题组类型（questionGroup.questionType） */
  groupType: string
}

/**
 * 逐题重算（纯函数，不写库）：决定这一条小题重评后应该是什么状态。
 *
 * 判断顺序与提交接口**逐条对齐**，不能调换 —— 顺序本身就是口径：
 * 先「答案不可用」（图片 / 空答案）→ 再「这类题根本不批阅」→ 再主观题 → 最后客观题。
 */
function planQuestion(input: PlanInput): PlannedQuestion {
  const { row, question, index, groupType } = input
  const before: RegradeQuestionSnapshot = {
    score: row.score,
    isCorrect: row.isCorrect,
    gradingStatus: row.gradingStatus,
  }
  const label = `第 ${index + 1} 题`
  const userAnswer = readAnswer(row.content)
  const correctAnswer = question.answer ?? ""
  const questionScore = question.score ?? 0

  const build = (
    outcome: RegradeOutcome,
    after: RegradeQuestionSnapshot,
    message: string | undefined,
    write: Prisma.QuestionSubmissionUpdateInput | undefined,
  ): PlannedQuestion => ({
    rowId: row.id,
    write,
    result: {
      questionSubmissionId: row.id,
      questionId: row.questionId,
      index,
      label,
      outcome,
      ...(message ? { message } : {}),
      before,
      after,
    },
  })

  // ① 画图/补图题：参考答案是图片，或参考答案为空 —— 无法按文字判分，保持原状态
  if (isImageAnswer(correctAnswer) || !correctAnswer.trim()) {
    return build("skipped", before, "参考答案是图片或为空，无法按文字重判，保持原状态", undefined)
  }

  // ② 语文大作文 / 微写作 / 数学解答 / 物理计算：本来就不批阅，分数与批阅状态都不能动
  if (isUngradedQuestion(groupType)) {
    return build("skipped", before, "该题型暂不批阅，保持原状态", undefined)
  }

  // ③ 主观题
  if (isSubjectiveQuestion(question.questionType, groupType)) {
    // 空作答与提交接口同口径：直接 0 分并标「已批阅」，不排队（排队也是白跑一次 AI）
    if (!userAnswer.trim()) {
      const after: RegradeQuestionSnapshot = { score: 0, isCorrect: false, gradingStatus: "graded" }
      if (sameSnapshot(before, after)) {
        return build("objective-unchanged", before, "空作答按 0 分处理，与库内一致", undefined)
      }
      return build(
        "objective-changed",
        after,
        "空作答按 0 分处理",
        { score: 0, isCorrect: false, gradingStatus: "graded" },
      )
    }

    // 没有批改提示词配置：重排也只会在队列里永远 pending（Worker 只捞有配置的题型），
    // 而且会抹掉已有分数，所以宁可不改
    if (!getGradingPrompt(groupType, index)) {
      return build("skipped", before, "该题没有批改提示词配置，保持原状态", undefined)
    }

    // 重新排队：分数清空、状态回到 pending，aiFeedback 必须写 DbNull 清掉旧评语，
    // 否则 Worker 批完前回顾页还挂着上一次（按旧标准）的评语
    return build(
      "requeued",
      { score: null, isCorrect: null, gradingStatus: "pending" },
      "已重新排队，等待 AI 批改",
      { score: null, isCorrect: null, gradingStatus: "pending", aiFeedback: Prisma.DbNull },
    )
  }

  // ④ 客观题：与提交接口同一套判分（空作答按错；语法填空/选词填空区分大小写）
  const isCorrect = isAnswerCorrect(userAnswer, correctAnswer, {
    caseSensitive: isCaseSensitiveAnswer(question.questionType, groupType, correctAnswer),
  })
  const score = isCorrect ? questionScore : 0
  const after: RegradeQuestionSnapshot = { score, isCorrect, gradingStatus: "graded" }
  if (sameSnapshot(before, after)) {
    return build("objective-unchanged", before, undefined, undefined)
  }
  return build("objective-changed", after, undefined, { score, isCorrect, gradingStatus: "graded" })
}

/** 载入一份作答（含题组、小题、逐题提交） */
const GROUP_SUBMISSION_SELECT = {
  id: true,
  userId: true,
  testSubmissionId: true,
  score: true,
  correctNum: true,
  totalNum: true,
  user: { select: { userName: true } },
  questionGroup: {
    select: {
      title: true,
      questionType: true,
      answerMode: true,
      groupItems: {
        select: {
          questionId: true,
          question: { select: { questionType: true, answer: true, score: true } },
        },
        orderBy: { orderIndex: "asc" as const },
      },
    },
  },
  submissions: {
    select: {
      id: true,
      questionId: true,
      content: true,
      score: true,
      isCorrect: true,
      gradingStatus: true,
    },
  },
} satisfies Prisma.QuestionGroupSubmissionSelect

/** 重评一份作答：逐题重算 → 写库 → 组级聚合 → （套卷）整卷总分回算，全在一个事务里 */
async function regradeOne(target: RegradeTarget): Promise<RegradeGroupResult | null> {
  const groupSubmission = await prisma.questionGroupSubmission.findUnique({
    where: { id: target.groupSubmissionId },
    select: GROUP_SUBMISSION_SELECT,
  })
  if (!groupSubmission) return null

  const questionGroup = groupSubmission.questionGroup
  const groupType = questionGroup.questionType ?? ""
  const items = questionGroup.groupItems

  // 小题在题组里的位置：orderIndex 升序后的下标（Worker 取提示词就是用这个下标）
  const indexByQuestionId = new Map<string, number>()
  items.forEach((item, i) => indexByQuestionId.set(item.questionId, i))

  const onlyQuestionIds =
    target.questionIds && target.questionIds.length > 0 ? new Set(target.questionIds) : null

  // 只认属于本题组的小题；按题组顺序输出，方便管理员对照题号
  const rows = groupSubmission.submissions
    .filter((row) => !onlyQuestionIds || onlyQuestionIds.has(row.questionId))
    .slice()
    .sort(
      (a, b) =>
        (indexByQuestionId.get(a.questionId) ?? Number.MAX_SAFE_INTEGER) -
        (indexByQuestionId.get(b.questionId) ?? Number.MAX_SAFE_INTEGER),
    )

  const planned: PlannedQuestion[] = rows.map((row) => {
    const before: RegradeQuestionSnapshot = {
      score: row.score,
      isCorrect: row.isCorrect,
      gradingStatus: row.gradingStatus,
    }
    const item = indexByQuestionId.get(row.questionId)
    const question = items.find((it) => it.questionId === row.questionId)?.question
    // 数据异常：提交里出现了不属于本题组的小题。判不了，也不能瞎改，单独报出来让管理员看到
    if (item === undefined || !question) {
      return {
        rowId: row.id,
        result: {
          questionSubmissionId: row.id,
          questionId: row.questionId,
          index: -1,
          label: "（未知题位）",
          outcome: "error" as RegradeOutcome,
          message: "该小题不在所属题组内（数据异常），已跳过",
          before,
          after: before,
        },
      }
    }
    try {
      return planQuestion({ row, question, index: item, groupType })
    } catch (error) {
      // 单题异常不阻断同一份作答里的其它小题
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[regrade] 小题 ${row.id} 重算失败:`, error)
      return {
        rowId: row.id,
        result: {
          questionSubmissionId: row.id,
          questionId: row.questionId,
          index: item,
          label: `第 ${item + 1} 题`,
          outcome: "error" as RegradeOutcome,
          message,
          before,
          after: before,
        },
      }
    }
  })

  const beforeGroup: RegradeGroupSnapshot = {
    score: groupSubmission.score,
    correctNum: groupSubmission.correctNum,
    totalNum: groupSubmission.totalNum,
  }

  // 写库 + 聚合回算放同一个事务：要么这份作答整体重算完，要么什么都不改
  const afterGroup = await prisma.$transaction(async (tx) => {
    for (const plan of planned) {
      if (plan.write) {
        await tx.questionSubmission.update({ where: { id: plan.rowId }, data: plan.write })
      }
    }

    // 聚合必须重新查库（而不是拿内存里的结果拼），口径与 grading-worker.ts 完全一致
    const allSubs = await tx.questionSubmission.findMany({
      where: { groupSubmissionId: groupSubmission.id },
      select: { score: true, isCorrect: true, gradingStatus: true },
    })

    const next: RegradeGroupSnapshot = isPickOneMode(questionGroup.answerMode)
      ? (() => {
          // 任选一题：取「已判分里得分最高」的一题，totalNum 恒为 1
          const agg = aggregatePickOne(allSubs)
          return { score: agg.score, correctNum: agg.correctNum, totalNum: agg.totalNum }
        })()
      : {
          score: allSubs.reduce((sum, s) => sum + (s.score ?? 0), 0),
          correctNum: allSubs.filter((s) => s.gradingStatus === "graded" && s.isCorrect === true).length,
          totalNum: allSubs.length,
        }

    await tx.questionGroupSubmission.update({
      where: { id: groupSubmission.id },
      data: {
        score: next.score,
        // 与提交接口 / Worker 一致：一题都没有时「是否全对」只能是 null，不能是 true
        isCorrect: (next.totalNum ?? 0) > 0 ? next.correctNum === next.totalNum : null,
        correctNum: next.correctNum,
        totalNum: next.totalNum,
      },
    })

    // 套卷小节：整卷总分 = 所有小节得分之和（grading-worker.ts 同一口径）
    if (groupSubmission.testSubmissionId) {
      const sections = await tx.questionGroupSubmission.findMany({
        where: { testSubmissionId: groupSubmission.testSubmissionId },
        select: { score: true },
      })
      const paperScore = sections.reduce((sum, s) => sum + (s.score ?? 0), 0)
      await tx.testPaperSubmission.update({
        where: { id: groupSubmission.testSubmissionId },
        data: { score: paperScore },
      })
    }

    return next
  })

  return {
    groupSubmissionId: groupSubmission.id,
    userId: groupSubmission.userId,
    userName: groupSubmission.user?.userName ?? null,
    groupTitle: questionGroup.title,
    before: beforeGroup,
    after: afterGroup,
    questions: planned.map((p) => p.result),
  }
}

/**
 * 重评一批作答，并带回逐条失败原因（路由用它区分 404 / 500 与部分失败）。
 *
 * 单份作答失败不会中断整批：一份查不到或事务报错，其它份照旧重评。
 */
export async function runRegrade(targets: RegradeTarget[]): Promise<RegradeRun> {
  const failed: RegradeFailure[] = []
  const groups: RegradeGroupResult[] = []

  // 同一份作答重复指定只算一次（前端可能从两个来源拼 id 列表）
  const unique = new Map<string, RegradeTarget>()
  for (const target of targets) {
    const id = typeof target?.groupSubmissionId === "string" ? target.groupSubmissionId.trim() : ""
    if (!id || unique.has(id)) continue
    unique.set(id, { groupSubmissionId: id, questionIds: target.questionIds })
  }
  if (unique.size === 0) return { groups, failed }

  // 先统一查一遍存在性：既省掉逐份判断，也让路由能区分「一条都没查到」= 404
  const existing = await prisma.questionGroupSubmission.findMany({
    where: { id: { in: Array.from(unique.keys()) } },
    select: { id: true },
  })
  const existingIds = new Set(existing.map((row) => row.id))
  for (const id of unique.keys()) {
    if (!existingIds.has(id)) failed.push({ id, error: "记录不存在", notFound: true })
  }

  for (const target of unique.values()) {
    if (!existingIds.has(target.groupSubmissionId)) continue
    try {
      const result = await regradeOne(target)
      if (result) groups.push(result)
      else failed.push({ id: target.groupSubmissionId, error: "记录不存在", notFound: true })
    } catch (error) {
      console.error(`[regrade] 重评作答 ${target.groupSubmissionId} 失败:`, error)
      failed.push({
        id: target.groupSubmissionId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { groups, failed }
}

/** 重评一批作答（只要结果，不要失败清单；失败的那几份不会出现在返回值里） */
export async function regradeSubmissions(targets: RegradeTarget[]): Promise<RegradeGroupResult[]> {
  const run = await runRegrade(targets)
  return run.groups
}
