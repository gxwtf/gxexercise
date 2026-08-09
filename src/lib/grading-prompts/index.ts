import { readFileSync } from "fs"
import path from "path"
import readingExpression from "./reading-expression/config.json"
import enWriting from "./en-writing/config.json"

export interface GradingPromptConfig {
  questionType: string
  questionIndices: number[]
  systemPrompt: string
  promptTemplate: string
  enableExactMatch?: boolean
}

interface JsonConfig {
  questionIndices: number[]
  enableExactMatch?: boolean
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
  ]

  return jsonFiles.flatMap((entry) =>
    entry.configs.map((config) => ({
      questionType: entry.questionType,
      questionIndices: config.questionIndices,
      systemPrompt: config.systemPrompt,
      promptTemplate: loadPrompt(entry.questionType, config.promptFile),
      enableExactMatch: config.enableExactMatch,
    }))
  )
}

export const GRADING_PROMPT_REGISTRY: GradingPromptConfig[] = loadPrompts()

function normalizeType(t: string): string {
  if (t === "阅读表达") return "reading-expression"
  if (t === "英文写作" || t === "英语作文" || t === "作文") return "en-writing"
  if (t === "语文作文" || t === "中文写作") return "chinese-essay"
  return t
}

export function getGradingPrompt(questionType: string, questionIndex: number): GradingPromptConfig | null {
  const normalized = normalizeType(questionType)
  return GRADING_PROMPT_REGISTRY.find(
    p => p.questionType === normalized && p.questionIndices.includes(questionIndex)
  ) ?? null
}

export function hasGradingPrompt(questionType: string): boolean {
  const normalized = normalizeType(questionType)
  return GRADING_PROMPT_REGISTRY.some(p => p.questionType === normalized)
}