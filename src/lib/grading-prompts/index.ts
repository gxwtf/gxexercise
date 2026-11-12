import { readFileSync } from "fs"
import path from "path"
import type { ScoringKind } from "../reading-expression-score"
import readingExpression from "./reading-expression/config.json"
import enWriting from "./en-writing/config.json"
import chineseText from "./chinese-reading/config.json"
import politicsText from "./politics/config.json"
import biologyFill from "./biology-fill/config.json"
import historyFill from "./history-fill/config.json"
import geographyFill from "./geography-fill/config.json"
import politicsFill from "./politics-fill/config.json"
import physicsFill from "./physics-fill/config.json"
// 语文大作文（北京卷议论文 v1.5）：模型只做结构化命中判断，分数由 essay-score.ts 按 §4 算
import chineseEssay from "./chinese-essay/config.json"

export interface GradingPromptConfig {
  questionType: string
  questionIndices: number[]
  systemPrompt: string
  promptTemplate: string
  enableExactMatch?: boolean
  /** 有值时不采信模型给的总分，改由 src/lib/reading-expression-score.ts 确定性算分 */
  scoring?: ScoringKind
}

interface JsonConfig {
  questionIndices: number[]
  enableExactMatch?: boolean
  scoring?: ScoringKind
  systemPrompt: string
  promptFile: string
}

interface JsonEntry {
  questionType: string
  configs: JsonConfig[]
}

function loadPrompt(questionType: string, promptFile: string): string {
  const filePath = path.resolve(process.cwd(), "src/lib/grading-prompts", questionType, promptFile)
  return readFileSync(filePath, "utf-8")
}

function loadPrompts(): GradingPromptConfig[] {
  const jsonFiles: JsonEntry[] = [
    readingExpression,
    enWriting,
    chineseText,
    politicsText,
    biologyFill,
    // 历史 / 地理 / 政治 一模大题（结构与生物同构，questionType 与题组 questionType 一致）
    historyFill,
    geographyFill,
    politicsFill,
    // 物理实验题（结构与生物同构：材料 + 内联空，一空一条单题，逐空交 AI 判分）
    physicsFill,
    // 语文大作文（102 个题组，满分多为 50；scoring: "essay-v15" → essay-score.ts 确定性算分）
    chineseEssay,
  ]

  return jsonFiles.flatMap((entry) =>
    entry.configs.map((config) => ({
      questionType: entry.questionType,
      questionIndices: config.questionIndices,
      systemPrompt: config.systemPrompt,
      promptTemplate: loadPrompt(entry.questionType, config.promptFile),
      // 语文大作文的 Question.answer 是历史脏数据（文言文参考译文 / 默写答案 / 「略」），
      // 判分只用「题干 + 学生作文」。这里强制关掉「作答与参考答案完全相同 → 满分」的精确匹配，
      // 免得某次作答正好等于那串脏数据被直接判满分。
      enableExactMatch: config.scoring === "essay-v15" ? false : config.enableExactMatch,
      scoring: config.scoring,
    }))
  )
}

export const GRADING_PROMPT_REGISTRY: GradingPromptConfig[] = loadPrompts()

function normalizeType(t: string): string {
  if (t === "阅读表达") return "reading-expression"
  if (t === "英文写作" || t === "英语作文" || t === "作文") return "en-writing"
  // 注意：「作文」这个裸别名归的是**英语作文**（历史口径）。语文大作文的题组 questionType
  // 一律是 `chinese-essay`（102 个题组），中文别名只认「语文作文 / 中文写作 / 大作文」。
  if (t === "语文作文" || t === "中文写作" || t === "大作文") return "chinese-essay"
  if (t === "生物" || t === "biology" || t === "生物大题") return "biology-fill"
  // 物理实验题：与生物大题同构（一个空一条单题），中文别名都归到 physics-fill；
  // 数学解答题 / 物理计算题没有批改提示词，故意不在这里映射（不批阅）。
  if (t === "物理实验" || t === "物理实验题" || t === "物理实验大题" || t === "physics-experiment") return "physics-fill"
  return t
}

export function getGradingPrompt(questionType: string, questionIndex: number): GradingPromptConfig | null {
  const normalized = normalizeType(questionType)
  return GRADING_PROMPT_REGISTRY.find(
    p => p.questionType === normalized &&
      (p.questionIndices.length === 0 || p.questionIndices.includes(questionIndex))
  ) ?? null
}

export function hasGradingPrompt(questionType: string): boolean {
  const normalized = normalizeType(questionType)
  return GRADING_PROMPT_REGISTRY.some(p => p.questionType === normalized)
}