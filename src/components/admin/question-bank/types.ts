// 题库管理编辑器（/admin/questions/[groupId]）用到的前端类型
//
// 只放「可序列化」的纯数据：服务端页面把 Prisma 记录序列化后交给客户端编辑器，
// 日期一律转成 ISO 字符串（RSC 不能把 Date 传进客户端组件）。

export interface QuestionOption {
  id: string
  label: string
}

/** 题组可编辑字段（与 src/lib/question-bank-meta.ts 的 GROUP_EDITABLE_FIELDS 对齐） */
export interface GroupFormValues {
  title: string
  subject: string
  category: string
  questionType: string
  grade: string
  source: string
  score: number
  answerMode: string
  tags: string[]
  imageUrl: string
  content: string
}

/** 小题可编辑字段（与 QUESTION_EDITABLE_FIELDS 对齐） */
export interface QuestionFormValues {
  questionType: string
  content: string
  options: QuestionOption[] | null
  answer: string
  analysis: string
  score: number
  tags: string[]
  category: string
  grade: string
  year: number | null
  source: string
}

/** 编辑页里的一个题组（含元信息，用于展示） */
export interface GroupEditorGroup extends GroupFormValues {
  id: string
  createdAt: string
  updatedAt: string
  /** 题组下小题数（用于概览） */
  itemCount: number
}

export interface GroupEditorQuestion {
  id: string
  orderIndex: number
  values: QuestionFormValues
}

/** 审计日志里的字段改动（从 AdminEditLog.changes 的 JSON 反序列化而来） */
export interface EditLogFieldChange {
  before: string | null
  after: string | null
  beforeLength?: number
  afterLength?: number
}

export interface EditLogView {
  id: string
  createdAt: string
  adminId: number
  adminName: string | null
  action: string
  targetType: string
  targetId: string
  targetLabel: string
  groupId: string | null
  groupTitle: string | null
  changes: Record<string, EditLogFieldChange> | null
}
