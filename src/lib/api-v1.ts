// /api/v1 只读接口的公共逻辑：筛选条件、分页、序列化。
//
// 筛选口径与 /questions/[subject]/[category] 列表页保持一致（cat / district / year /
// grade / q），这样脚本看到的结果和网页上点出来的完全一样。

import type { Prisma } from "@/generated/prisma/client"
import { NextResponse } from "next/server"
import {
  categoriesBySubject,
  categoryToRoute,
  routeToCategory,
  routeToSubject,
  subjectToRoute,
} from "@/constants/subjects"
import { DISTRICTS, DISTRICT_ZHENTI } from "@/constants/districts"
import { EXAM_TYPE_FILTERS, examTypeWhere } from "@/constants/exam-types"

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100



export interface Paging {
  page: number
  pageSize: number
  skip: number
}

export function parsePaging(searchParams: URLSearchParams): Paging {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const rawSize = Number.parseInt(searchParams.get("pageSize") ?? "", 10)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(rawSize) && rawSize > 0 ? rawSize : DEFAULT_PAGE_SIZE),
  )
  return { page, pageSize, skip: (page - 1) * pageSize }
}

/** 允许传中文名或路由 slug（math / math-choice） */
export function resolveSubject(raw: string | null): string {
  const value = (raw ?? "").trim()
  if (!value || value === "all") return ""
  return routeToSubject[value] ?? value
}

export function resolveCategory(raw: string | null): string {
  const value = (raw ?? "").trim()
  if (!value || value === "all") return ""
  return routeToCategory[value] ?? value
}

function districtWhere(raw: string): Prisma.QuestionGroupWhereInput | null {
  if (!raw || raw === "all") return null
  if (raw === DISTRICT_ZHENTI || raw === "北京真题") return { tags: { has: "真题" } }
  return {
    OR: [
      { source: { contains: raw, mode: "insensitive" } },
      { title: { contains: raw, mode: "insensitive" } },
    ],
  }
}

function categoryWhere(raw: string): Prisma.QuestionGroupWhereInput | null {
  if (!raw || raw === "all") return null
  const exam = examTypeWhere(raw)
  if (exam) return exam as Prisma.QuestionGroupWhereInput
  return { source: raw }
}

export function buildGroupWhere(searchParams: URLSearchParams): Prisma.QuestionGroupWhereInput {
  const where: Prisma.QuestionGroupWhereInput = {}

  const subject = resolveSubject(searchParams.get("subject"))
  if (subject) where.subject = subject

  const category = resolveCategory(searchParams.get("category"))
  if (category) where.category = category

  const questionType = (searchParams.get("questionType") ?? "").trim()
  if (questionType) where.questionType = questionType

  const catWhere = categoryWhere((searchParams.get("cat") ?? "").trim())
  if (catWhere) Object.assign(where, catWhere)

  const and: Prisma.QuestionGroupWhereInput[] = []

  const district = districtWhere((searchParams.get("district") ?? "").trim())
  if (district) and.push(district)

  const year = Number.parseInt(searchParams.get("year") ?? "", 10)
  if (Number.isInteger(year)) {
    and.push({ groupItems: { some: { question: { year } } } })
  }

  const grade = (searchParams.get("grade") ?? "").trim()
  if (grade) {
    and.push({
      OR: [{ grade }, { groupItems: { some: { question: { grade } } } }],
    })
  }

  const keyword = (searchParams.get("q") ?? "").trim()
  if (keyword) {
    and.push({
      OR: [
        { title: { contains: keyword, mode: "insensitive" } },
        { content: { contains: keyword, mode: "insensitive" } },
        { source: { contains: keyword, mode: "insensitive" } },
        { tags: { has: keyword } },
      ],
    })
  }

  const source = (searchParams.get("source") ?? "").trim()
  if (source) and.push({ source: { contains: source, mode: "insensitive" } })

  const tag = (searchParams.get("tag") ?? "").trim()
  if (tag) and.push({ tags: { has: tag } })

  if (and.length > 0) where.AND = and

  return where
}

export function buildPaperWhere(searchParams: URLSearchParams): Prisma.TestPaperWhereInput {
  const where: Prisma.TestPaperWhereInput = {}

  const subject = resolveSubject(searchParams.get("subject"))
  if (subject) where.subject = subject

  const year = Number.parseInt(searchParams.get("year") ?? "", 10)
  if (Number.isInteger(year)) where.year = year

  const grade = (searchParams.get("grade") ?? "").trim()
  if (grade) where.grade = grade

  const and: Prisma.TestPaperWhereInput[] = []

  const keyword = (searchParams.get("q") ?? "").trim()
  if (keyword) {
    and.push({
      OR: [
        { title: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
        { source: { contains: keyword, mode: "insensitive" } },
        { tags: { has: keyword } },
      ],
    })
  }

  const source = (searchParams.get("source") ?? "").trim()
  if (source) and.push({ source: { contains: source, mode: "insensitive" } })

  const tag = (searchParams.get("tag") ?? "").trim()
  if (tag) and.push({ tags: { has: tag } })

  if (and.length > 0) where.AND = and

  return where
}

// ---------- 查询字段 ----------

export const groupListSelect = {
  id: true,
  title: true,
  subject: true,
  category: true,
  questionType: true,
  source: true,
  grade: true,
  tags: true,
  score: true,
  imageUrl: true,
  createdAt: true,
  groupItems: {
    take: 1,
    orderBy: { orderIndex: "asc" },
    select: { question: { select: { year: true, grade: true } } },
  },
  _count: { select: { groupItems: true } },
} satisfies Prisma.QuestionGroupSelect

export const paperListSelect = {
  id: true,
  title: true,
  description: true,
  subject: true,
  source: true,
  grade: true,
  year: true,
  totalScore: true,
  duration: true,
  tags: true,
  createdAt: true,
  _count: { select: { paperItems: true } },
} satisfies Prisma.TestPaperSelect

// ---------- 序列化（把 Prisma 行拍平成对外的 JSON） ----------

interface QuestionRow {
  id: string
  questionType: string
  content: string
  options: unknown
  answer: string
  analysis: string | null
  score: number
  subject: string
  category: string
  source: string
  grade: string | null
  year: number | null
  tags: string[]
  correctRate: number | null
}

interface GroupListRow {
  id: string
  title: string
  subject: string
  category: string
  questionType: string
  source: string
  grade: string | null
  tags: string[]
  score: number
  imageUrl: string | null
  createdAt: Date
  groupItems: { question: { year: number | null; grade: string | null } }[]
  _count: { groupItems: number }
}

interface GroupDetailRow {
  id: string
  title: string
  subject: string
  category: string
  questionType: string
  source: string
  grade: string | null
  tags: string[]
  score: number
  imageUrl: string | null
  content: string
  groupItems: { orderIndex: number; question: QuestionRow }[]
}

interface PaperListRow {
  id: string
  title: string
  description: string | null
  subject: string
  source: string
  grade: string | null
  year: number | null
  totalScore: number | null
  duration: number | null
  tags: string[]
  createdAt: Date
  _count: { paperItems: number }
}

export function serializeGroupList(row: GroupListRow) {
  const firstQuestion = row.groupItems?.[0]?.question
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    category: row.category,
    questionType: row.questionType,
    source: row.source,
    grade: row.grade ?? firstQuestion?.grade ?? null,
    year: firstQuestion?.year ?? null,
    tags: row.tags ?? [],
    score: row.score,
    imageUrl: row.imageUrl ?? null,
    itemCount: row._count?.groupItems ?? 0,
    createdAt: row.createdAt,
  }
}

export function serializeQuestion(question: QuestionRow, orderIndex?: number) {
  return {
    id: question.id,
    ...(orderIndex === undefined ? {} : { orderIndex }),
    questionType: question.questionType,
    content: question.content,
    options: question.options ?? null,
    answer: question.answer,
    analysis: question.analysis ?? null,
    score: question.score,
    subject: question.subject,
    category: question.category,
    source: question.source,
    grade: question.grade ?? null,
    year: question.year ?? null,
    tags: question.tags ?? [],
    correctRate: question.correctRate ?? null,
  }
}

export function serializeGroupDetail(group: GroupDetailRow) {
  return {
    id: group.id,
    title: group.title,
    subject: group.subject,
    category: group.category,
    questionType: group.questionType,
    source: group.source,
    grade: group.grade ?? null,
    tags: group.tags ?? [],
    score: group.score,
    imageUrl: group.imageUrl ?? null,
    content: group.content,
    questions: (group.groupItems ?? []).map((item) =>
      serializeQuestion(item.question, item.orderIndex),
    ),
  }
}

export function serializePaperList(row: PaperListRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    subject: row.subject,
    source: row.source,
    grade: row.grade ?? null,
    year: row.year ?? null,
    totalScore: row.totalScore ?? null,
    duration: row.duration ?? null,
    tags: row.tags ?? [],
    itemCount: row._count?.paperItems ?? 0,
    createdAt: row.createdAt,
  }
}

// ---------- 元数据 ----------

export function apiMeta() {
  return {
    subjects: Object.keys(subjectToRoute).map((name) => ({
      name,
      route: subjectToRoute[name],
      categories: (categoriesBySubject[name] ?? []).map((category) => ({
        name: category,
        route: categoryToRoute[name]?.[category] ?? category.toLowerCase(),
      })),
    })),
    districts: [...DISTRICTS],
    /** 「北京真题」在接口里传 "真题" 或 "北京真题" 都可以 */
    districtZhenti: DISTRICT_ZHENTI,
    categoryTags: EXAM_TYPE_FILTERS.map((f) => f.value),
  }
}

export function serverError(scope: string, error: unknown) {
  console.error(`[api/v1/${scope}]`, error)
  return NextResponse.json(
    { success: false, error: "服务器内部错误" },
    { status: 500 },
  )
}
