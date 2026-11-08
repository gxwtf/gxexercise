import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { subjectToRoute, categoryToRoute } from "@/constants/subjects"
import {
  HOME_SAMPLE_MAX_LEN,
  HOME_SAMPLE_MIN_LEN,
  HOME_SAMPLE_OPTION_IDS,
  inspectHomeSample,
  type HomeSampleOption,
} from "@/lib/home-sample"

/**
 * 首页「免登录试一道」的取题 / 判分接口。
 *
 * - GET  取一道**北京高考真题里的纯文本单选**（只回题干与选项，**不下发答案**）
 * - POST 提交所选项，服务端判定对错并回解析（原卷没解析时只回答案）+「继续练」链接
 *
 * 取题口径（首页是纯文本渲染，任一项不满足都会让体验位难用，
 * 具体判据集中在 `src/lib/home-sample.ts`，这里只负责「按学科轮换 + 取题」）：
 * 1. 真题里的单选、四个选项、答案是大写字母且在选项内；
 * 2. 题干**和选项**都不能含图片 / 表格 / 公式 / 裸 LaTeX（真题学科变多后，
 *    图、公式大量躲在选项里，只查题干会漏）；
 * 3. 题干不能靠图/表才能做（「如图」「下表」），也不能是题组里的一小问；
 * 4. 题目必须**自包含**：材料在题组（QuestionGroup）里、题干里没有的题一律不要
 *    —— 语文的阅读/文言文/古诗/文学类都是这种，只发小问没法做（与英语同理）；
 * 5. `<Dot>` `<U>` 这类语义标签不算问题，展示前去掉标签本身（见 stripInlineTags）；
 * 6. **按学科轮换**：先随机学科再随机题，避免题多的科目垄断体验位。
 */

const OPTION_IDS: readonly string[] = [...HOME_SAMPLE_OPTION_IDS]

interface SampleQuestion {
  id: string
  subject: string
  topic: string
  prompt: string
  options: HomeSampleOption[]
  /** 该题原卷是否带解析（没有的话首页只揭晓答案并提示去题库看） */
  analysisAvailable: boolean
  continueHref: string
}

interface Bucket {
  withAnalysis: string[]
  withoutAnalysis: string[]
}

let poolCache: { bySubject: Record<string, Bucket>; at: number } | null = null
const POOL_TTL_MS = 60_000

/** 每道题最多试几个候选（候选池已按判据粗筛，正常第一个就能用） */
const PICK_TRIES = 40

async function candidatePool(): Promise<Record<string, Bucket>> {
  if (poolCache && Date.now() - poolCache.at < POOL_TTL_MS) return poolCache.bySubject
  // SQL 只做便宜、无转义坑的预筛；更细的判定（图指代 / 标签 / 选项）在 JS 里做，
  // 与 scripts/audit-home-sample.ts 共用同一套 inspectHomeSample()
  const rows = await prisma.$queryRaw<
    { id: string; subject: string; has_analysis: boolean }[]
  >`
    SELECT q.id, q.subject,
           (q.analysis IS NOT NULL AND length(btrim(q.analysis)) >= 20) AS has_analysis
    FROM "Question" q
    WHERE q."questionType" = 'single'
      AND q.answer ~ '^[A-Da-d]$'
      AND q.source LIKE '%真题%'
      AND length(q.content) BETWEEN ${HOME_SAMPLE_MIN_LEN} AND ${HOME_SAMPLE_MAX_LEN}
      -- 图片 / 公式：题干与选项都要干净
      AND q.content NOT LIKE '%![%'
      AND q.content NOT LIKE '%<QImg%'
      AND q.content NOT LIKE '%$%'
      AND coalesce(q.options::text, '') NOT LIKE '%![%'
      AND coalesce(q.options::text, '') NOT LIKE '%<QImg%'
      AND coalesce(q.options::text, '') NOT LIKE '%$%'
      -- 自包含：材料在题组里、题干里没有的题不要（语文阅读类全是这种）
      AND NOT EXISTS (
        SELECT 1
        FROM "GroupItem" gi
        JOIN "QuestionGroup" g ON g.id = gi."groupId"
        WHERE gi."questionId" = q.id
          AND length(btrim(g.content)) >= 20
          AND strpos(q.content, btrim(g.content)) = 0
      )
    LIMIT 4000
  `
  const bySubject: Record<string, Bucket> = {}
  for (const r of rows) {
    const bucket = (bySubject[r.subject] ??= { withAnalysis: [], withoutAnalysis: [] })
    if (r.has_analysis) bucket.withAnalysis.push(r.id)
    else bucket.withoutAnalysis.push(r.id)
  }
  poolCache = { bySubject, at: Date.now() }
  return bySubject
}

function continueHrefFor(subject: string, category: string | null): string {
  const subjectRoute = subjectToRoute[subject]
  const catRoute =
    categoryToRoute[subject]?.[category ?? ""] ?? categoryToRoute[subject]?.["套卷"]
  return subjectRoute && catRoute ? `/questions/${subjectRoute}/${catRoute}` : "/questions"
}

async function pickQuestion(): Promise<SampleQuestion | null> {
  const bySubject = await candidatePool()
  const subjectsWithOptions = Object.keys(bySubject).filter(
    (k) => bySubject[k].withAnalysis.length + bySubject[k].withoutAnalysis.length > 0,
  )
  if (!subjectsWithOptions.length) return null

  // 先随机学科，再随机题：避免题量大的科目垄断首页体验位
  const shuffled = [...subjectsWithOptions].sort(() => Math.random() - 0.5)
  for (const subject of shuffled) {
    const { withAnalysis, withoutAnalysis } = bySubject[subject]
    // 有解析的优先；该学科的解析池全被筛掉时再退回无解析池
    for (const pool of [withAnalysis, withoutAnalysis]) {
      if (!pool.length) continue
      const start = Math.floor(Math.random() * pool.length)
      for (let i = 0; i < Math.min(PICK_TRIES, pool.length); i += 1) {
        const id = pool[(start + i) % pool.length]
        const q = await prisma.question.findUnique({
          where: { id },
          select: {
            id: true,
            subject: true,
            category: true,
            content: true,
            options: true,
            answer: true,
            analysis: true,
          },
        })
        if (!q) continue
        const verdict = inspectHomeSample({
          content: q.content,
          options: q.options,
          answer: q.answer,
        })
        if (!verdict.ok) continue
        const analysis = String(q.analysis || "").trim()
        return {
          id: q.id,
          subject: q.subject,
          topic: q.category || "选择",
          prompt: verdict.prompt,
          options: verdict.options,
          analysisAvailable: analysis.length > 0,
          continueHref: continueHrefFor(q.subject, q.category),
        }
      }
    }
  }
  return null
}

export async function GET() {
  try {
    const q = await pickQuestion()
    if (!q) return NextResponse.json({ error: "暂时没有可用的体验题" }, { status: 503 })
    return NextResponse.json(q, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[home-sample] pick failed:", error)
    return NextResponse.json({ error: "取题失败，请稍后再试" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { id?: string; selected?: string }
      | null
    const id = typeof body?.id === "string" ? body.id : ""
    const selected = typeof body?.selected === "string" ? body.selected.trim().toUpperCase() : ""
    if (!id || !OPTION_IDS.includes(selected)) {
      return NextResponse.json({ error: "参数不合法" }, { status: 400 })
    }
    const q = await prisma.question.findUnique({
      where: { id },
      select: { answer: true, analysis: true, subject: true, category: true },
    })
    if (!q) return NextResponse.json({ error: "题目不存在" }, { status: 404 })
    const correctOptionId = String(q.answer || "").trim().toUpperCase()
    if (!OPTION_IDS.includes(correctOptionId)) {
      return NextResponse.json({ error: "该题暂无标准答案" }, { status: 409 })
    }
    return NextResponse.json(
      {
        correct: selected === correctOptionId,
        correctOptionId,
        analysis: String(q.analysis || "").trim(),
        continueHref: continueHrefFor(q.subject, q.category),
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("[home-sample] grade failed:", error)
    return NextResponse.json({ error: "核对答案失败，请稍后再试" }, { status: 500 })
  }
}
