import OpenAI from "openai";
import type { GradingPromptConfig } from "./grading-prompts";
import { applyStructuredScoring } from "./reading-expression-score";
import { computeEssayScore, isEssayScoring } from "./essay-score";
import { countEssayWords, type EssayReviewStored } from "./essay-review";

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
  /** 模型原始 JSON。阅读表达用它做确定性算分（见 reading-expression-score.ts），不给前端展示 */
  raw?: Record<string, unknown>;
  /** 语文大作文的批阅结果（见 essay-review.ts）：学生可见 + internal 留痕，落库到 aiFeedback.essayReview */
  essayReview?: EssayReviewStored;
  /**
   * 「这次不该出分」：目前只有语文大作文会给出 —— 学生写的是记叙文，
   * 而 v1.5 是北京卷**议论文**的尺子。调用方见到它要写 `gradingStatus: "skipped"`，
   * **不要**写分数、也不要当成批改失败去重试（见 grading-worker.ts）。
   */
  skip?: { reason: string };
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
        raw: parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined,
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

/** 本机 vLLM 默认会「先思考再答」，思考 token 会把 max_tokens 吃光导致 content 为空（判分报 AI response not JSON）。
 *  默认关掉思考；换成不支持该参数的第三方网关时自动回退。 */
const REASONING_EFFORT = process.env.GRADING_REASONING_EFFORT ?? "none";

async function callModel(systemPrompt: string, userPrompt: string, maxScore: number, maxTokens = 600): Promise<GradeResult> {
  // console.log("[AI Prompt]", JSON.stringify({ system: systemPrompt, user: userPrompt }, null, 2))
  const base = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
    max_tokens: maxTokens,
    response_format: { type: "json_object" as const },
  };

  let completion
  try {
    completion = await openai.chat.completions.create({ ...base, reasoning_effort: REASONING_EFFORT } as never)
  } catch (err) {
    const msg = String((err as Error)?.message || err)
    if (!/reasoning|unsupported|unknown|invalid/i.test(msg)) throw err
    completion = await openai.chat.completions.create(base as never)
  }

  const text = completion.choices[0]?.message?.content || "";
  return parseResponse(text, maxScore);
}

/**
 * 模板占位符：`{stem}` / `{userAnswer}` / `{correctAnswer}` / `{maxScore}` / `{wordCount}`
 *
 * `{wordCount}` 是**程序数出来的字数**（`countEssayWords()`，与做题页 textarea 下方显示的字数一致）：
 * 语文大作文的 A10（<600 字）/ C7（600–699 字）是硬判据，让模型自己数会飘。
 */
function buildPrompt(
  template: string,
  stem: string,
  userAnswer: string,
  correctAnswer: string,
  maxScore: number,
  wordCount: number,
): string {
  return template
    .replace(/\{stem\}/g, stem)
    .replace(/\{userAnswer\}/g, userAnswer)
    .replace(/\{correctAnswer\}/g, correctAnswer)
    .replace(/\{maxScore\}/g, String(maxScore))
    .replace(/\{wordCount\}/g, String(wordCount));
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
  const essay = isEssayScoring(config.scoring);
  const prompt = buildPrompt(
    config.promptTemplate,
    stem,
    userAnswer,
    // 语文大作文的 Question.answer 是**脏数据**：实测有题组把文言文参考译文、默写答案（如 2017 组的
    // 「爽籁发而清风生…」）、甚至「略」塞进了作文题的 answer。v1.5 判分只用「题干 + 学生作文」，
    // 所以这里直接给空串 —— 即便提示词里误写了 {correctAnswer}，也拿不到脏数据。
    essay ? "" : correctAnswer,
    maxScore,
    countEssayWords(userAnswer),
  );
  // 语文作文输出结构化命中判断 + 判词 + 建议，和英语作文一样需要长输出
  const maxTokens = essay || config.questionType === "en-writing" ? 4096 : 600;
  const startedAt = Date.now();
  const result = await callModel(config.systemPrompt, prompt, maxScore, maxTokens);

  // 语文大作文：模型只做结构化命中判断，分数按 v1.5 §4 由程序算（essay-score.ts）。
  // 必须拦在下面 scoring 通用分支之前 —— "essay-v15" 不是 applyStructuredScoring 的口径。
  if (essay) {
    const outcome = computeEssayScore({
      raw: result.raw,
      userAnswer,
      maxScore,
      model: MODEL,
      elapsedMs: Date.now() - startedAt,
    });
    delete result.subScores;
    if (outcome.status === "skipped") {
      // 记叙文：这次不出分（终态跳过，**不是**批改失败，别当异常重试）
      result.score = 0;
      result.feedback = outcome.message;
      result.skip = { reason: outcome.reason };
      delete result.essayReview;
      return result;
    }
    result.score = outcome.score;
    result.feedback = outcome.feedback;
    result.essayReview = outcome.essayReview;
    return result;
  }

  // 阅读表达（40-43）：模型只做结构化判断，分数由确定性规则算，避免小模型算错减法
  if (config.scoring) {
    const scored = applyStructuredScoring(config.scoring, result.raw, maxScore, {
      score: result.score,
      feedback: result.feedback,
    });
    result.score = scored.score;
    result.feedback = scored.feedback;
    if (scored.subScores) {
      result.subScores = scored.subScores;
    } else if (config.scoring === "essay-weights") {
      delete result.subScores;
    }
  }
  return result;
}

export async function gradeReadingExpression(
  stem: string,
  userAnswer: string,
  correctAnswer: string,
  maxScore: number,
): Promise<GradeResult> {
  const { getGradingPrompt } = await import("./grading-prompts");
  const config = getGradingPrompt("reading-expression", 0)!;
  // 走 gradeWithConfig 而不是直接 callModel：否则会漏掉 scoring 的确定性算分
  return await gradeWithConfig(config, stem, userAnswer, correctAnswer, maxScore);
}
