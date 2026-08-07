const AI_BASE = "https://api.poixe.com/v1";
const API_KEY = "sk-0ObCJMNQ87XwePNIqVOuKkvBweHwW73cB049BtAfA1JvVn2l";
const MODEL = "claude-fable-5";

interface GradeResult {
  score: number;
  feedback?: string;
}

const SYSTEM_PROMPT = `你是一名英语阅卷老师。你必须只输出一个 JSON 对象，不要输出任何其他内容。

回复格式（严格遵循）：
{"score":<数字>,"feedback":"<中文原因，满分则空字符串>"}

示例：
{"score":2,"feedback":"拼写错误扣0.5分，缺少关键信息扣1分"}
{"score":3,"feedback":""}`;

function buildPrompt(stem: string, userAnswer: string, correctAnswer: string, maxScore: number): string {
  return `根据以下信息评阅学生的作答，只输出 JSON：

【题目】${stem}

【参考答案】${correctAnswer}

【学生作答】${userAnswer}

【分值】${maxScore}分

评分规则：
- 回答完全错误或不相关：0分
- 缺少关键信息：扣1分（每缺少一处）
- 存在语法错误：扣0.5分（每处）
- 扣分到0为止，不得为负

立即输出 JSON，不要输出任何其他内容。`
}

function parseResponse(text: string, maxScore: number): GradeResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: clampScore(parsed.score, maxScore),
        feedback: parsed.feedback || undefined,
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

async function callModel(prompt: string, maxScore: number): Promise<GradeResult> {
  const response = await fetch(`${AI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 200,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return parseResponse(text, maxScore);
}

export async function gradeReadingExpression(
  stem: string,
  userAnswer: string,
  correctAnswer: string,
  maxScore: number,
): Promise<GradeResult> {
  const prompt = buildPrompt(stem, userAnswer, correctAnswer, maxScore);

  try {
    return await callModel(prompt, maxScore);
  } catch (error) {
    console.error("AI grading failed:", error);
    return { score: 0, feedback: "AI评阅暂时不可用，请稍后重试" };
  }
}