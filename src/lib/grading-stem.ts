/**
 * 批改用的「题面」（{stem}）取值口径。
 *
 * 大部分题型把题干写在单题 `Question.content` 上，直接用它。
 * 但「材料 + 内联空」那一类（生物 / 历史 / 地理 / 政治大题，以及 2026-11 新增的物理实验题
 * `physics-fill`）题干在**题组** `QuestionGroup.content` 上，单题 content 是空的 ——
 * 直接拿单题 content 会让模型盲批（只能看到「参考答案 vs 学生作答」）。
 *
 * 现阶段只对 `physics-fill` 启用题组材料兜底：生物 / 历史 / 地理 / 政治的批改已经跑了一段时间，
 * 换输入会改变判分分布，要改请单独评估后再放开。
 */

const STEM_FROM_GROUP_CONTENT = new Set(["physics-fill"])

/** 把题组材料清理成适合进提示词的纯文本：去掉图片 Markdown，占位符换成 ____ */
export function toGradingStem(groupContent: string): string {
  return (groupContent || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<(InputLong|Input2|Input|AnswerBox)\b[^>]*>\s*<\/\1>/g, "____")
    .replace(/<(InputLong|Input2|Input|AnswerBox)\b[^>]*\/>/g, "____")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** 单题有题干就用单题题干；没有且属于「材料在题组上」的题型，才回退到题组材料 */
export function gradingStem(
  questionType: string,
  questionContent: string | null | undefined,
  groupContent: string | null | undefined,
): string {
  const own = questionContent || ""
  if (own.trim()) return own
  if (!STEM_FROM_GROUP_CONTENT.has(questionType)) return own
  return toGradingStem(groupContent || "")
}
