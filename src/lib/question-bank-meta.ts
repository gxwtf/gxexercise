// 题库管理（/admin/questions）用到的题型 / 字段元数据
//
// 题型在数据库里是英文 slug（Question.questionType = single / input / text …，
// QuestionGroup.questionType = en-reading / cloze / math-fill …），界面上一律显示中文。
// 这里只做「已知 slug → 中文名」的映射；遇到没登记的新题型直接回显示原值，绝不吞掉。

export interface QuestionTypeMeta {
  value: string
  label: string
}

/** 单题（Question）题型：与 src/app/question/[id]/page.tsx 的分支保持一致 */
export const SINGLE_QUESTION_TYPES: QuestionTypeMeta[] = [
  { value: "single", label: "单选" },
  { value: "multiple", label: "多选" },
  { value: "choice", label: "选择（选项题）" },
  { value: "input", label: "填空" },
  { value: "input2", label: "填空（样式二）" },
  { value: "text", label: "主观题" },
]

/** 题组（QuestionGroup）题型 */
export const GROUP_QUESTION_TYPES: QuestionTypeMeta[] = [
  { value: "en-reading", label: "英语阅读" },
  { value: "cloze", label: "完形填空" },
  { value: "grammar", label: "语法填空" },
  { value: "word-choice", label: "选词填空" },
  { value: "seven-choose-five", label: "七选五" },
  { value: "reading-expression", label: "阅读表达" },
  { value: "en-writing", label: "英语写作" },
  { value: "chinese-reading", label: "语文阅读" },
  { value: "chinese-essay", label: "语文作文" },
  { value: "chinese-micro-writing", label: "微写作" },
  { value: "chinese-dictation", label: "默写" },
  { value: "math-choice", label: "数学选择" },
  { value: "math-fill", label: "数学填空" },
  { value: "physics-choice", label: "物理选择" },
  { value: "chemistry-image", label: "化学（图片版）" },
  { value: "biology-choice", label: "生物选择" },
  { value: "biology-fill", label: "生物大题" },
  { value: "history-choice", label: "历史选择" },
  { value: "history-fill", label: "历史大题" },
  { value: "politics-choice", label: "政治选择" },
  { value: "politics-fill", label: "政治大题" },
  { value: "geography-choice", label: "地理选择" },
  { value: "geography-fill", label: "地理大题" },
]

const QUESTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  [...SINGLE_QUESTION_TYPES, ...GROUP_QUESTION_TYPES].map((t) => [t.value, t.label]),
)

/** slug → 中文名；未登记的 slug 原样返回（方便发现新题型） */
export function questionTypeLabel(value: string | null | undefined): string {
  if (!value) return "—"
  return QUESTION_TYPE_LABELS[value] ?? value
}

/** 编辑页题型下拉的候选：已登记的 + 当前值（可能是不认识的新 slug） */
export function questionTypeOptionsFor(
  kind: "group" | "question",
  current?: string | null,
): QuestionTypeMeta[] {
  const base = kind === "group" ? GROUP_QUESTION_TYPES : SINGLE_QUESTION_TYPES
  if (current && !base.some((t) => t.value === current)) {
    return [...base, { value: current, label: `${current}（未登记）` }]
  }
  return base
}

/** 题组作答模式（QuestionGroup.answerMode） */
export const ANSWER_MODE_META: QuestionTypeMeta[] = [
  { value: "all", label: "全部作答" },
  { value: "pick-one", label: "任选一题" },
]

/** 审计日志里字段名 → 中文名 */
export const EDIT_FIELD_LABELS: Record<string, string> = {
  title: "标题",
  content: "正文",
  options: "选项",
  answer: "答案",
  analysis: "解析",
  tags: "标签",
  score: "分值",
  subject: "学科",
  category: "类别",
  questionType: "题型",
  grade: "年级",
  source: "来源",
  imageUrl: "封面",
  answerMode: "作答模式",
  year: "年份",
}

/** 审计动作 → 中文名 */
export const ADMIN_EDIT_ACTION_LABELS: Record<string, string> = {
  "update-group": "修改题组",
  "update-question": "修改单题",
  "upload-cover": "上传封面",
  "pick-cover": "选用候选封面",
  "delete-cover": "移除封面",
}

/** 审计对象类型 → 中文名 */
export const ADMIN_EDIT_TARGET_LABELS: Record<string, string> = {
  group: "题组",
  question: "单题",
}

/** 覆盖的题组字段（顺序即编辑页表单 / 日志展示顺序） */
export const GROUP_EDITABLE_FIELDS = [
  "title",
  "subject",
  "category",
  "questionType",
  "grade",
  "source",
  "score",
  "answerMode",
  "tags",
  "imageUrl",
  "content",
] as const

/** 覆盖的单题字段 */
export const QUESTION_EDITABLE_FIELDS = [
  "questionType",
  "content",
  "options",
  "answer",
  "analysis",
  "score",
  "tags",
  "category",
  "grade",
  "year",
  "source",
] as const

/**
 * 从单题正文生成人类可读摘要（去掉 MDX 标签 / 公式包裹，压缩空白）。
 * 用于审计日志的 targetLabel —— 单题没有标题字段。
 */
export function questionStemPreview(content: string | null | undefined, max = 60): string {
  if (!content) return "（空题干）"
  const text = content
    // 去掉题库私有填空标签与常见 MDX/HTML 标签，只留文字
    .replace(/<\/?(Input2|InputLong|Input|ClozeBlank|Blank|AnswerBox|QImg|Center|RightAlign|Superscript|Dot|U|br)\b[^>]*>/gi, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\$+/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return "（空题干）"
  return text.length > max ? `${text.slice(0, max)}…` : text
}
