import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { subjectToRoute, categoryToRoute } from "@/constants/subjects"

/**
 * 首页「免登录试一道」的取题 / 判分接口。
 *
 * - GET  取一道**北京高考真题里的纯文本单选**（只回题干与选项，**不下发答案**）
 * - POST 提交所选项，服务端判定对错并回解析（原卷没解析时只回答案）+「继续练」链接
 *
 * 取题口径（首页是纯文本渲染，任一项不满足都会让体验位难用）：
 * 1. 真题里的单选、四个选项、答案是大写字母且在选项内；
 * 2. 题干不含图片/表格/行内公式，也**不提到图**（读图/如图/图N/示意图…）；
 * 3. 去掉题干开头残留的「（4分）」与「共享材料被复制两遍」的重复段落；
 * 4. **按学科轮换**：先随机学科再随机题，避免题多的科目垄断体验位；
 * 5. 有原卷解析的题优先，没有解析的也允许（前端提示「原卷未附解析」）。
 */

const OPTION_IDS = ["A", "B", "C", "D"]
const IMG_RE = /!\[[^\]]*\]\(|<QImg/i
const RICH_RE = /^\s*\|/m
const MATH_RE = /\$[^$\n]{1,60}\$/
const FIG_REF_RE = /(读图|如图|图中|下图|上图|见图|图\s*[0-9一二三四五]|示意图|统计图|折线图|柱状图)/
const GROUP_HINT_RE = /回答\s*第?\s*\d+\s*[、,，]\s*\d+\s*题|据此回答|完成下面小题/

interface SampleQuestion {
  id: string
  subject: string
  topic: string
  prompt: string
  options: { id: string; label: string }[]
  /** 该题原卷是否带解析（没有的话首页只揭晓答案并提示去题库看） */
  analysisAvailable: boolean
  continueHref: string
}

/** 去掉题干开头残留的「（4分）」、连续重复段落、题组提示 */
function cleanPrompt(raw: string): string {
  let text = raw
    .replace(/^\s*\*\*[^*\n]{0,16}(选择题|非选择题)[^*\n]{0,16}\*\*\s*/g, "")
    .replace(/^[\s\u3000]*[（(]\s*\d*\s*分\s*[）)]\s*/g, "")
    .trim()
  const paras = text.split(/\n{2,}/)
  const out: string[] = []
  for (const p of paras) {
    const key = p.replace(/\s+/g, "")
    const prev = out.length ? out[out.length - 1].replace(/\s+/g, "") : ""
    if (key && key === prev) continue
    out.push(p)
  }
  text = out.join("\n\n").trim()
  return text.replace(/回答\s*第?\s*\d+\s*[、,，]\s*\d+\s*题[。.]?/g, "").trim()
}

function normalizeOptions(raw: unknown): { id: string; label: string }[] {
  if (!Array.isArray(raw)) return []
  const out: { id: string; label: string }[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    const id = typeof rec.id === "string" ? rec.id.trim().toUpperCase() : ""
    const label = typeof rec.label === "string" ? rec.label.trim() : ""
    if (!OPTION_IDS.includes(id) || !label) continue
    out.push({ id, label })
  }
  const uniq = Array.from(new Map(out.map((o) => [o.id, o])).values())
  return uniq.length === 4 ? uniq.sort((a, b) => a.id.localeCompare(b.id)) : []
}

interface Bucket {
  withAnalysis: string[]
  withoutAnalysis: string[]
}

let poolCache: { bySubject: Record<string, Bucket>; at: number } | null = null
const POOL_TTL_MS = 60_000

async function candidatePool(): Promise<Record<string, Bucket>> {
  if (poolCache && Date.now() - poolCache.at < POOL_TTL_MS) return poolCache.bySubject
  // SQL 只做便宜且无转义坑的预筛；公式/表格/提到图的判定放在 JS 里
  const rows = await prisma.$queryRaw<{ id: string; subject: string; has_analysis: boolean }[]>`
    SELECT id, subject, (analysis IS NOT NULL AND length(btrim(analysis)) >= 20) AS has_analysis
    FROM "Question"
    WHERE "questionType" = 'single'
      AND answer ~ '^[A-Da-d]$'
      AND source LIKE '%真题%'
      AND content NOT LIKE '%![%'
      AND content NOT LIKE '%<QImg%'
      AND length(content) BETWEEN 12 AND 420
    LIMIT 1500
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
  const catRoute = categoryToRoute[subject]?.[category ?? ""] ?? categoryToRoute[subject]?.["套卷"]
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
    const pool = withAnalysis.length ? withAnalysis : withoutAnalysis
    const start = Math.floor(Math.random() * pool.length)
    for (let i = 0; i < Math.min(15, pool.length); i += 1) {
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
      const options = normalizeOptions(q.options)
      const answer = String(q.answer || "").trim().toUpperCase()
      if (!options.length || !OPTION_IDS.includes(answer)) continue
      const content = cleanPrompt(String(q.content || ""))
      if (!content || content.length < 12 || content.length > 420) continue
      if (IMG_RE.test(content) || RICH_RE.test(content) || MATH_RE.test(content)) continue
      if (FIG_REF_RE.test(content) || GROUP_HINT_RE.test(content)) continue
      if (content.includes("**") || content.includes("每小题")) continue
      const analysis = String(q.analysis || "").trim()
      return {
        id: q.id,
        subject: q.subject,
        topic: q.category || "选择",
        prompt: content,
        options,
        analysisAvailable: analysis.length > 0,
        continueHref: continueHrefFor(q.subject, q.category),
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
    const body = (await req.json().catch(() => null)) as { id?: string; selected?: string } | null
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
