export const questionTypes = [
  "单项选择题",
  "多项选择题",
  "不定项选择题",
  "填空题",
  "解答题",
  "七选五题",
  "选词填空题",
] as const;

export type QuestionType = (typeof questionTypes)[number];

export const questionTypeToRoute: Record<QuestionType, string> = {
  "单项选择题": "single-choice",
  "多项选择题": "multiple-choice",
  "不定项选择题": "multiple-choice-unlimited",
  "填空题": "fill-blank",
  "解答题": "essay",
  "七选五题": "seven-choose-five",
  "选词填空题": "word-choice-fill",
};

export const routeToQuestionType: Record<string, QuestionType> = {
  "single-choice": "单项选择题",
  "multiple-choice": "多项选择题",
  "multiple-choice-unlimited": "不定项选择题",
  "fill-blank": "填空题",
  "essay": "解答题",
  "seven-choose-five": "七选五题",
  "word-choice-fill": "选词填空题",
};

export const subjectColors: Record<string, string> = {
  "数学": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "语文": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  "英语": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "物理": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "化学": "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "生物": "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "历史": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "地理": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "政治": "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
};

export const questionTypeColors: Record<QuestionType, string> = {
  "单项选择题": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  "多项选择题": "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "不定项选择题": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "填空题": "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "解答题": "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
  "七选五题": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "选词填空题": "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
};