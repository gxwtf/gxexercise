import OpenAI from "openai";
import type { GradingPromptConfig } from "./grading-prompts";

const openai = new OpenAI({
  // apiKey: process.env.SILICONFLOW_API_API_KEY!,
  // apiKey: process.env.POIXE_API_KEY!,
  // baseURL: "https://api.siliconflow.cn",
  // baseURL: "https://api.poixe.com",
  baseURL: process.env.OPENAI_BASE_URL!,
  apiKey: process.env.OPENAI_API_KEY!,
});

const MODEL = process.env.OPENAI_MODEL!;

export interface GradeResult {
  score: number;
  feedback?: string;
  subScores?: Record<string, number>;
  overallComment?: string;
  lineCorrections?: string;
  betterExpressions?: string;
  modelEssay?: string;
}

function parseResponse(text: string, maxScore: number): GradeResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: clampScore(parsed.score, maxScore),
        feedback: parsed.feedback || undefined,
        subScores: parsed.subScores || undefined,
        overallComment: parsed.overallComment || undefined,
        lineCorrections: parsed.lineCorrections || undefined,
        betterExpressions: parsed.betterExpressions || undefined,
        modelEssay: parsed.modelEssay || undefined,
      };
    } catch {
      // JSON parse failed, continue to regex fallback
    }
  }

  const lowered = text.toLowerCase();

  if (/\b(?:完全正确|满分|full\s*marks?|correct|all\s*correct)\b/i.test(lowered) && !/\b(?:错误|incorrect|wrong|扣|deduct)\b/i.test(lowered)) {
    return { score: maxScore, feedback: "" };
  }

  if (/\b(?:完全错误|completely\s*wrong|不相关|irrelevant)\b/i.test(lowered)) {
    return { score: 0, feedback: text.slice(0, 500) };
  }

  const scoreMatch = text.match(/(?:得分|score)[：:]\s*(\d+\.?\d*)/i);
  if (scoreMatch) {
    return { score: clampScore(parseFloat(scoreMatch[1]), maxScore), feedback: text.slice(0, 500) };
  }

  const numMatch = text.match(/\b(\d+\.?\d*)\s*(?:分|\/|points?)/);
  if (numMatch) {
    return { score: clampScore(parseFloat(numMatch[1]), maxScore), feedback: text.slice(0, 500) };
  }

  throw new Error(`AI response not JSON: ${text}`);
}

function clampScore(score: unknown, maxScore: number): number {
  if (typeof score === "number") return Math.min(maxScore, Math.max(0, score));
  if (typeof score === "string") return Math.min(maxScore, Math.max(0, parseFloat(score) || 0));
  return 0;
}

async function callModel(systemPrompt: string, userPrompt: string, maxScore: number, maxTokens = 200): Promise<GradeResult> {
  // console.log("[AI Prompt]", JSON.stringify({ system: systemPrompt, user: userPrompt }, null, 2))
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content || "";
  return parseResponse(text, maxScore);
}

function buildPrompt(template: string, stem: string, userAnswer: string, correctAnswer: string, maxScore: number): string {
  return template
    .replace(/\{stem\}/g, stem)
    .replace(/\{userAnswer\}/g, userAnswer)
    .replace(/\{correctAnswer\}/g, correctAnswer)
    .replace(/\{maxScore\}/g, String(maxScore));
}

export function preCheckGrade(
  userAnswer: string,
  correctAnswer: string,
  maxScore: number,
  enableExactMatch: boolean,
): GradeResult | null {
  if (!userAnswer.trim()) {
    return { score: 0, feedback: "未作答" };
  }
  if (enableExactMatch && userAnswer.trim() === correctAnswer.trim()) {
    return { score: maxScore, feedback: "" };
  }
  return null;
}

export async function gradeWithConfig(
  config: GradingPromptConfig,
  stem: string,
  userAnswer: string,
  correctAnswer: string,
  maxScore: number,
): Promise<GradeResult> {
  const prompt = buildPrompt(config.promptTemplate, stem, userAnswer, correctAnswer, maxScore);
  const isEnWriting = config.questionType === "en-writing";
  const maxTokens = isEnWriting ? 4096 : 200;
  return await callModel(config.systemPrompt, prompt, maxScore, maxTokens);
}

export async function gradeReadingExpression(
  stem: string,
  userAnswer: string,
  correctAnswer: string,
  maxScore: number,
): Promise<GradeResult> {
  const { getGradingPrompt } = await import("./grading-prompts");
  const config = getGradingPrompt("reading-expression", 0)!;
  const prompt = buildPrompt(config.promptTemplate, stem, userAnswer, correctAnswer, maxScore);
  return await callModel(config.systemPrompt, prompt, maxScore);
}