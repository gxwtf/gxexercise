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
  ]

  return jsonFiles.flatMap((entry) =>
    entry.configs.map((config) => ({
      questionType: entry.questionType,
      questionIndices: config.questionIndices,
      systemPrompt: config.systemPrompt,
      promptTemplate: loadPrompt(entry.questionType, config.promptFile),
      enableExactMatch: config.enableExactMatch,
      scoring: config.scoring,
    }))
  )
}

export const GRADING_PROMPT_REGISTRY: GradingPromptConfig[] = loadPrompts()

function normalizeType(t: string): string {
  if (t === "阅读表达") return "reading-expression"
  if (t === "英文写作" || t === "英语作文" || t === "作文") return "en-writing"
  if (t === "语文作文" || t === "中文写作") return "chinese-essay"
  if (t === "生物" || t === "biology" || t === "生物大题") return "biology-fill"
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