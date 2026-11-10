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
    {
      id: string
      subject: string
      has_analysis: boolean
      content: string
      options: unknown
      answer: string
    }[]
  >`
    SELECT q.id, q.subject,
           (q.analysis IS NOT NULL AND length(btrim(q.analysis)) >= 20) AS has_analysis,
           q.content, q.options, q.answer
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
    // 建池时就跑一遍与下发完全相同的判据：这样「池量」= 真正能上首页的题量，
    // log2(池量) 的权重才准（只按 SQL 粗筛计数会把「后面一定会被拒」的题也算进去，
    // 实测会让地理这类图多的科目被多分到出镜率）。
    const verdict = inspectHomeSample({ content: r.content, options: r.options, answer: r.answer })
    if (!verdict.ok) continue
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

/**
 * 学科权重：**log2(池量)**。
 *
 * 为什么不用「每科等权」：池子只有 1–2 道的学科（数学 1、物理 2）等权时就占了 1/7 的出镜率，
 * 等于反复同一道题；而池子 151 道的历史也只有 1/7。log2 让「题多的科多出镜、题少的科少出镜」，
 * 又不像线性按题量加权那样把薄池学科压到几乎不出现。
 *
 * 末尾 **+1**：log2(池量) 在池量 = 1 时是 0（数学池正好只有 1 道），那样该学科会
 * 彻底从首页消失；+1 相当于给每个学科一个基础出镜率，数学（1 道）权重 1、物理（2 道）2，
 * 既不会消失，也不会像等权时那样占 1/7。若只想「池量 +1 再取 log2」，改成 `Math.log2(n + 1)`。
 */
const poolWeight = (n: number): number => Math.log2(n) + 1

/**
 * 按权重给出「学科的随机尝试顺序」（无放回加权抽样）。
 *
 * 用 Efraimidis–Spirakis：每个学科抽 key = random^(1/w)，按 key 降序排列，
 * 得到的就是「按权重抽第一个、剩下的再按权重抽第二个……」的合法顺序。
 *
 * 之前这里是 `[...subjects].sort(() => Math.random() - 0.5)` —— 这是经典反模式：
 * V8 的 sort 是 TimSort/插入排序，随机比较器不产生均匀排列，而是偏向数组的某些位置；
 * 而数组顺序又是 SQL 返回行的顺序，结果实测配比 10%~20%（χ²=69），完全不是「随机学科」。
 */
function weightedSubjectOrder(
  subjects: string[],
  bySubject: Record<string, Bucket>,
): string[] {
  return subjects
    .map((subject) => {
      const bucket = bySubject[subject]
      const n = bucket.withAnalysis.length + bucket.withoutAnalysis.length
      const w = poolWeight(n)
      return { subject, w, key: w > 0 ? Math.pow(Math.random(), 1 / w) : 0 }
    })
    .filter((x) => x.w > 0)
    .sort((a, b) => b.key - a.key)
    .map((x) => x.subject)
}

async function pickQuestion(): Promise<SampleQuestion | null> {
  const bySubject = await candidatePool()
  const subjectsWithOptions = Object.keys(bySubject).filter(
    (k) => bySubject[k].withAnalysis.length + bySubject[k].withoutAnalysis.length > 0,
  )
  if (!subjectsWithOptions.length) return null

  // 先按 log2(池量) 加权抽学科，再在该学科里随机取题
  let order = weightedSubjectOrder(subjectsWithOptions, bySubject)
  // 兜底：所有学科池量都只有 1 道（权重全为 0）时退回等权随机，别把体验位清空
  if (!order.length) {
    order = [...subjectsWithOptions]
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
  }

  for (const subject of order) {
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
