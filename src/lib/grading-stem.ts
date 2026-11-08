/**
 * 批改用的「题面」（{stem}）取值口径。
 *
 * 大部分题型把题干写在单题 `Question.content` 上，直接用它。
 * 但「材料 + 内联空」那一类（生物 / 历史 / 地理 / 政治大题，以及 2026-11 新增的物理实验题
 * `physics-fill`）题干在**题组** `QuestionGroup.content` 上，单题 content 是空的 ——
 * 直接拿单题 content 会让模型盲批（只能看到「参考答案 vs 学生作答」）。
 * 这些题型的提示词本来写的就是「{stem} = 所在大题的题干与设问」，此前一直传的是空串。
 *
 * 2026-11-08 起对**所有 `*-fill` 大题题型**统一启用题组材料兜底（用户确认）。
 * 其余题型（语法填空 / 完形 / 七选五 / 选词填空等，单题 content 也是空的，但它们的提示词按
 * 「空 + 参考答案」比对即可）保持原样，不回填题组语料，避免改变既有判分口径。
 */

/** 这类题型的题面在题组上：`biology-fill` / `history-fill` / `geography-fill` / `politics-fill` / `physics-fill` … */
function stemFromGroupContent(questionType: string): boolean {
  return questionType.endsWith("-fill")
}

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
  if (!stemFromGroupContent(questionType)) return own
  return toGradingStem(groupContent || "")
}
