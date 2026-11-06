import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { subjectToRoute, categoryToRoute } from "@/constants/subjects"

/**
 * 首页「免登录试一道」的取题 / 判分接口。
 *
 * - GET  取一道**有解析的单选题**（只回题干与选项，**不下发答案**），供首页展示；
 * - POST 提交所选项，服务端判定对错并回解析 + 「继续练」链接。
 *
 * 取题口径（避免首页体验位出意外）：
 * 1. 单选、四个选项、答案是大写字母且在选项内；
 * 2. 解析非空（≥ 20 字），否则体验位没有「看思路」的价值；
 * 3. 题干**不含图片**（`![]()` / `<QImg>`）——首页不加载题目素材图，纯文字才稳；
 * 4. 优先取自「北京高考真题」的题组，其次任意题组。
 */

const OPTION_IDS = ["A", "B", "C", "D"]
const IMG_RE = /!\[[^\]]*\]\(|<QImg/i
const RICH_RE = /^\s*\|/m // 题干里带 markdown 表格行的一律跳过（首页按纯文本渲染）
const MATH_RE = /\$[^$\n]{1,60}\$/ // 行内公式同样跳过，避免 \$ 原样露出

interface SampleQuestion {
  id: string
  subject: string
  topic: string
  prompt: string
  options: { id: string; label: string }[]
  continueHref: string
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
  // 去重后必须恰好是 A–D 四项
  const uniq = Array.from(new Map(out.map((o) => [o.id, o])).values())
  return uniq.length === 4 ? uniq.sort((a, b) => a.id.localeCompare(b.id)) : []
}

async function pickQuestion(take: number): Promise<SampleQuestion | null> {
  // 优先「北京高考真题」，其次任意来源；两次尝试都是同一套结构过滤
  const keywordSets = [{ source: { contains: "真题" } }, {}]
  for (const where of keywordSets) {
    const total = await prisma.question.count({
      where: {
        questionType: "single",
        analysis: { not: null },
        ...where,
      },
    })
    if (!total) continue
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const skip = Math.floor(Math.random() * total)
      const rows = await prisma.question.findMany({
        where: { questionType: "single", analysis: { not: null }, ...where },
        skip,
        take: Math.min(take, 8),
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
      for (const q of rows) {
        const options = normalizeOptions(q.options)
        const answer = String(q.answer || "").trim().toUpperCase()
        const analysis = String(q.analysis || "").trim()
        if (!options.length || !OPTION_IDS.includes(answer)) continue
        if (analysis.length < 20) continue
        const content = String(q.content || "").trim()
        if (!content || content.length < 12 || IMG_RE.test(content)) continue
        if (RICH_RE.test(content) || MATH_RE.test(content)) continue
        if (content.length > 420) continue
        const subjectRoute = subjectToRoute[q.subject]
        const catRoute = categoryToRoute[q.subject]?.[q.category] ?? categoryToRoute[q.subject]?.["套卷"]
        return {
          id: q.id,
          subject: q.subject,
          topic: q.category || "单选",
          prompt: content,
          options,
          continueHref: subjectRoute && catRoute ? `/questions/${subjectRoute}/${catRoute}` : "/questions",
        }
      }
    }
  }
  return null
}

export async function GET() {
  try {
    const q = await pickQuestion(8)
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
    // 「继续练」落到同学科的目录页（不需要登录即可浏览）
    const subjectRoute = subjectToRoute[q.subject]
    const catRoute = categoryToRoute[q.subject]?.[q.category] ?? categoryToRoute[q.subject]?.["套卷"]
    const continueHref =
      subjectRoute && catRoute ? `/questions/${subjectRoute}/${catRoute}` : "/questions"
    return NextResponse.json(
      {
        correct: selected === correctOptionId,
        correctOptionId,
        analysis: String(q.analysis || "").trim(),
        continueHref,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("[home-sample] grade failed:", error)
    return NextResponse.json({ error: "核对答案失败，请稍后再试" }, { status: 500 })
  }
}
