/**
 * 语文大作文「AI 批改」的对外契约（v1.5 判分规格的**展示层**）。
 *
 * 判分标准：jab《北京卷议论文批阅复现规格 v1.5》（冻结版，原文
 * `~/gxwtf_docs/essay-spec-v15/SPEC.md`，进提示词的那份是
 * `src/lib/grading-prompts/chinese-essay/prompt.md`）。
 *
 * 三条硬性口径（与学生侧 / 管理员侧的界面都有关系）：
 * 1. **只给学生看结论**：分数、档位、区间、判词、修改建议。
 *    A/B/C/D/L 条款编号、命中条数、起点分、上限、扣分算式一律**不得出现在任何面向学生的界面**，
 *    它们只作为 `internal` 存在库里，供排查用（`toPublicEssayReview()` 负责剥掉）。
 * 2. 分数**不由模型给**：模型只输出结构化命中判断，分数、档位、区间由
 *    `src/lib/essay-score.ts` 按 §4 公式确定性算出 —— 同一篇作文永远同一个分。
 * 3. 区间取「该档位的分数段」（§3 分数轴），不自己发明 ±N 的浮动区间。
 */

/** §3 分数轴：档位 → 分数段（分数从高到低） */
export const ESSAY_BANDS = [
  { band: "一类上", min: 48, max: 50 },
  { band: "一类中", min: 45, max: 47 },
  { band: "一类下", min: 42, max: 44 },
  { band: "二类上", min: 39, max: 41 },
  { band: "二类中", min: 36, max: 38 },
  { band: "二类下", min: 33, max: 35 },
  { band: "三类上", min: 30, max: 32 },
  { band: "三类中", min: 27, max: 29 },
  { band: "三类下", min: 25, max: 26 },
  { band: "四类", min: 0, max: 24 },
] as const

export type EssayBand = (typeof ESSAY_BANDS)[number]["band"]

/** 档位 + 分数段的显示写法："二类中" / "36–38"（区间用 en dash，和判阅单一一致） */
export function essayBandOf(score: number): { band: EssayBand; range: string; min: number; max: number } {
  const rounded = Math.round(score)
  const hit = ESSAY_BANDS.find((item) => rounded >= item.min && rounded <= item.max) ?? ESSAY_BANDS[ESSAY_BANDS.length - 1]
  return { band: hit.band, range: `${hit.min}–${hit.max}`, min: hit.min, max: hit.max }
}

/**
 * 落库的批阅结果（`QuestionSubmission.aiFeedback.essayReview`）。
 * `internal` 只给管理员 / 排查用，**绝不**下发到学生页面。
 */
export interface EssayReviewStored extends EssayReviewPublic {
  internal?: EssayReviewInternal
}

/** 学生可见的那部分 */
export interface EssayReviewPublic {
  /** 50 分制得分（= 该次作答的 QuestionSubmission.score） */
  score: number
  /** 满分（老题有 40 / 45 / 60 分制的，按题目分值走） */
  maxScore: number
  /** 档位："二类中" */
  band: string
  /** 该档位对应的分数段："36–38" */
  range: string
  /** 一句判词（30 字内，说清这篇的水平与关键问题） */
  verdict: string
  /** 4–6 条可执行的修改建议（按性价比排序，先位置后改法，不含任何条款编号） */
  suggestions: string[]
  /** 一句「最该动的地方」 */
  direction: string
  /** 字数（按非空白字符统计，判 A10 / C7 用） */
  wordCount: number
}

/** 判分过程留痕（只在库里 / 管理员侧） */
export interface EssayReviewInternal {
  /** 命中的 A 级编号（已含由程序判定的 A10 / C7 字数项） */
  aHits: string[]
  /** A7′ 档位：lt-half | mid | high | all */
  a7Band: string
  lHits: string[]
  bHits: string[]
  cHits: string[]
  dHits: string[]
  /** 每一步的算式留痕，如 "43+5=48 → 封顶 50 → −4−2−2−2 = 38" */
  formula: string
  /** 套用过的上限（如 "A 级 1 条 → 39"），没套上限就是空数组 */
  caps: string[]
  /** 模型给的核心概念 / 命题类型（题干还原，排查离题判断用） */
  coreConcept?: string
  propositionType?: string
  /** 模型给每条命中项的原文证据（编号 → 句子） */
  evidence?: Record<string, string>
  /** 模型标识 / 耗时（毫秒），便于对比不同模型的判分表现 */
  model?: string
  elapsedMs?: number
}

/** 判分标准版本号，写进库里便于日后区分「哪个标准判的」 */
export const ESSAY_RUBRIC_VERSION = "v1.5"

/** 从库里的 aiFeedback 取出「学生可见」的批阅结果；不是作文 / 还没批完时返回 null */
export function toPublicEssayReview(value: unknown): EssayReviewPublic | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const score = typeof raw.score === "number" ? raw.score : Number(raw.score)
  if (!Number.isFinite(score)) return null
  const maxScore = Number(raw.maxScore)
  const verdict = typeof raw.verdict === "string" ? raw.verdict.trim() : ""
  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((s) => s.trim())
    : []
  if (!verdict && suggestions.length === 0) return null
  return {
    score,
    maxScore: Number.isFinite(maxScore) && maxScore > 0 ? maxScore : 50,
    band: typeof raw.band === "string" ? raw.band : essayBandOf(score).band,
    range: typeof raw.range === "string" ? raw.range : essayBandOf(score).range,
    verdict,
    suggestions,
    direction: typeof raw.direction === "string" ? raw.direction.trim() : "",
    wordCount: Number.isFinite(Number(raw.wordCount)) ? Number(raw.wordCount) : 0,
  }
}

/**
 * 字数统计口径：**字符数**（含标点、含段落换行），与做题页 textarea 下方显示的「字数」
 * 完全一致（见 src/components/question/AnswerQuestion.tsx：中文按 `text.length` 计）。
 *
 * 为什么跟做题页走、而不是按北京卷「格子」算：学生看到的字数和批阅单上的字数必须是同一个数，
 * 否则「我明明写了 700 字」会被质疑。两者差的只是段落数（换行符），对 600 / 700 这两个
 * 阈值的影响在个位数以内。
 *
 * 更重要的是：字数**由程序数**、不让模型数 —— A10（<600 字）/ C7（600–699 字）是硬判据，
 * 交给模型数会飘，而同一份文本永远应该得到同一个字数。
 */
export function countEssayWords(text: string): number {
  return (text || "").replace(/\r\n/g, "\n").length
}

/**
 * 把一条建议清洗成学生能读的样子。
 *
 * 提示词里已经明令禁止出现条款编号与算式，这里是**兜底**：模型偶尔还是会写
 * 「以争取 L1」这类话，挖掉编号后再收拾一下被挖空后留下的半截连接
 * （「，以争取 。」→「。」），保证学生看到的只是一句人话。
 */
export function sanitizeEssaySuggestion(text: string): string {
  let out = (text || "").trim()
  if (!out) return ""
  // 条款编号：L1 / A7′ / B12 / C9 / D3 …（前面不能紧挨字母或数字，避免误伤正常的英文编号）
  out = out.replace(/(^|[^A-Za-z0-9])[ABCDL]\s?\d{1,2}\s?[′']?/g, "$1")
  // 算式痕迹：43+5=48 / 封顶 50 / 上限 39 / 起点分 / 扣 4 分 / 加 2 分
  // 注意「扣」只在**后面真的跟着数字**时才挖：中文里「扣题不紧」「这段扣住中心」是正常教学用语，
  // 若把「扣」字一律删掉会变成「题不紧」「这段住中心」。
  out = out.replace(/\d+\s*[+＋]\s*\d+\s*[=＝]\s*\d+/g, "")
  out = out.replace(/(?:封顶|上限)\s*\d+\s*分?/g, "")
  out = out.replace(/起点分\s*\d*/g, "")
  out = out.replace(/扣\s*\d+(?:\.\d+)?\s*分?/g, "")
  out = out.replace(/[加减]\s*\d+(?:\.\d+)?\s*分/g, "")
  // 收拾被挖空后留下的半截连接词
  out = out.replace(/[，,、;；]\s*(?:以|用来|可|可以)?\s*(?:争取|拿到|获得|加|冲|够)\s*[分]?\s*[。．.；;]?\s*$/g, "。")
  out = out.replace(/[，,、;；]\s*[。．.；;]/g, "。")
  out = out.replace(/[（(]\s*[)）]/g, "")
  return out.replace(/\s{2,}/g, " ").replace(/\s+([，。；：！？])/g, "$1").trim()
}
