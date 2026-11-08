/**
 * 首页「先做一道真题」体验位的取题池自检。
 *
 * 背景：首页那块是纯文本渲染（不渲染 Markdown/图片/KaTeX/MDX 标签），
 * 真题录入学科变多以后，图/公式大量躲在**选项**里，语文材料题只发小问也没法做。
 * 取题判据集中在 `src/lib/home-sample.ts`，接口 `/api/home-sample` 与这个脚本共用同一套逻辑。
 *
 * 用途（每次新录入一批真题后跑一遍，别让体验位再漏筛）：
 * 1. 逐学科统计「真正能上首页」的题量 —— 某学科剩 0 说明该科体验位会消失；
 * 2. 按原因统计被排除的题量（图/表/公式/图指代/题组小问/材料不在题干里…）；
 * 3. 抽样打印最终会展示的题干与选项（确认 `<Dot>` 已被去掉、没有残留标记）。
 *
 * 用法（cwd 必须是项目根）：
 *   npx tsx scripts/audit-home-sample.ts                # 全学科汇总 + 每科 1 例
 *   npx tsx scripts/audit-home-sample.ts --samples 3     # 每科抽 3 例
 *   npx tsx scripts/audit-home-sample.ts --subject 语文  # 只看某学科（含被排除的原因明细）
 *
 * 只读数据库，不改数据、不重启服务。
 */
import "dotenv/config"
import { Pool } from "pg"

import {
  HOME_SAMPLE_MAX_LEN,
  HOME_SAMPLE_MIN_LEN,
  inspectHomeSample,
  type HomeSampleReject,
} from "../src/lib/home-sample"

const argv = process.argv.slice(2)
const numArg = (flag: string, fallback: number) => {
  const i = argv.indexOf(flag)
  const v = i >= 0 ? Number.parseInt(argv[i + 1] ?? "", 10) : NaN
  return Number.isFinite(v) ? v : fallback
}
const SAMPLES = numArg("--samples", 1)
const SUBJECT = (() => {
  const i = argv.indexOf("--subject")
  return i >= 0 ? (argv[i + 1] ?? "").trim() : ""
})()

/** 与 /api/home-sample/route.ts 的 candidatePool() 完全一致的预筛（改那边记得同步这里） */
const POOL_SQL = `
  SELECT q.id, q.subject, q.category, q.content, q.options, q.answer,
         (q.analysis IS NOT NULL AND length(btrim(q.analysis)) >= 20) AS has_analysis
  FROM "Question" q
  WHERE q."questionType" = 'single'
    AND q.answer ~ '^[A-Da-d]$'
    AND q.source LIKE '%真题%'
    AND length(q.content) BETWEEN $1 AND $2
    AND q.content NOT LIKE '%![%'
    AND q.content NOT LIKE '%<QImg%'
    AND q.content NOT LIKE '%$%'
    AND coalesce(q.options::text, '') NOT LIKE '%![%'
    AND coalesce(q.options::text, '') NOT LIKE '%<QImg%'
    AND coalesce(q.options::text, '') NOT LIKE '%$%'
    AND NOT EXISTS (
      SELECT 1
      FROM "GroupItem" gi
      JOIN "QuestionGroup" g ON g.id = gi."groupId"
      WHERE gi."questionId" = q.id
        AND length(btrim(g.content)) >= 20
        AND strpos(q.content, btrim(g.content)) = 0
    )
  ORDER BY q.subject, q.id
  LIMIT 4000
`

/** 只做「真题单选 + 答案 A–D」的粗口径，用来看各原因到底筛掉了多少（不含上面那些 WHERE） */
const RAW_SQL = `
  SELECT q.id, q.subject, q.category, q.content, q.options, q.answer,
         (q.analysis IS NOT NULL AND length(btrim(q.analysis)) >= 20) AS has_analysis,
         EXISTS (
           SELECT 1
           FROM "GroupItem" gi
           JOIN "QuestionGroup" g ON g.id = gi."groupId"
           WHERE gi."questionId" = q.id
             AND length(btrim(g.content)) >= 20
             AND strpos(q.content, btrim(g.content)) = 0
         ) AS material_outside
  FROM "Question" q
  WHERE q."questionType" = 'single'
    AND q.answer ~ '^[A-Da-d]$'
    AND q.source LIKE '%真题%'
`

interface Row {
  id: string
  subject: string
  category: string | null
  content: string
  options: unknown
  answer: string
  has_analysis: boolean
}

const REASON_LABEL: Record<HomeSampleReject, string> = {
  empty: "题干清洗后为空",
  "too-short": "题干太短",
  "too-long": "题干太长(>420)",
  image: "含图片",
  table: "含表格",
  math: "含公式/LaTeX",
  "figure-ref": "提到图或表",
  "paper-note": "试卷级说明",
  "underline-ref": "说画线/加点却没标记",
  "group-hint": "题组小问/据此回答",
  markdown: "Markdown 强调/每小题",
  "unknown-tag": "不认识的标签",
  options: "选项不合格",
}

const MATERIAL_LABEL = "材料在题组里(不在题干)"

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)

function printSample(r: Row, prompt: string, options: { id: string; label: string }[]) {
  console.log(`\n  ── [${r.subject}/${r.category ?? "选择"}] ${r.id}`)
  console.log(`  ${prompt.replace(/\n/g, "\n  ")}`)
  for (const o of options) console.log(`    ${o.id}. ${o.label.replace(/\n/g, " ")}`)
  console.log(`  （答案 ${String(r.answer).toUpperCase()}${r.has_analysis ? "，有解析" : "，无解析"}）`)
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const poolRows = (
      await pool.query<Row>(POOL_SQL, [HOME_SAMPLE_MIN_LEN, HOME_SAMPLE_MAX_LEN])
    ).rows
    const rawRows = (await pool.query<Row>(RAW_SQL)).rows

    // 1) 原因分布（基于粗口径全集；材料在题干外的那一层单独统计）
    const rawBySubject = new Map<string, number>()
    const materialBySubject = new Map<string, number>()
    const reasonBySubject = new Map<string, Map<string, number>>()
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)
    const bump2 = (m: Map<string, Map<string, number>>, s: string, k: string) => {
      const inner = m.get(s) ?? new Map<string, number>()
      bump(inner, k)
      m.set(s, inner)
    }
    for (const r of rawRows) {
      bump(rawBySubject, r.subject)
      if ((r as Row & { material_outside?: boolean }).material_outside) {
        bump(materialBySubject, r.subject)
        continue
      }
      const v = inspectHomeSample(r)
      if (!v.ok && v.reason) bump2(reasonBySubject, r.subject, REASON_LABEL[v.reason])
    }

    // 2) 真正可上首页的题池（SQL 预筛 + JS 判定，与接口一致）
    const eligible: { row: Row; prompt: string; options: { id: string; label: string }[] }[] = []
    for (const r of poolRows) {
      const v = inspectHomeSample(r)
      if (v.ok) eligible.push({ row: r, prompt: v.prompt, options: v.options })
    }

    console.log("首页「先做一道真题」取题池自检\n")
    console.log("== 一、粗口径真题单选（全部）按原因排除 ==")
    const subjects = [...rawBySubject.keys()].sort()
    console.log(
      "学科   真题单选  材料在题组  可上首页  排除原因明细",
    )
    for (const s of subjects) {
      if (SUBJECT && s !== SUBJECT) continue
      const total = rawBySubject.get(s) ?? 0
      const material = materialBySubject.get(s) ?? 0
      const ok = eligible.filter((e) => e.row.subject === s).length
      const reasons = [...(reasonBySubject.get(s) ?? new Map()).entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join("、")
      console.log(
        `${s.padEnd(4, "　")} ${String(total).padStart(6)}  ${String(material).padStart(8)}  ${String(ok).padStart(7)}  ${reasons || "—"}`,
      )
    }

    console.log("\n== 二、可上首页的题量（这就是体验位能轮到的学科） ==")
    const bySubject = new Map<string, number>()
    for (const e of eligible) bump(bySubject, e.row.subject)
    const zero = subjects.filter((s) => !bySubject.get(s) && (!SUBJECT || s === SUBJECT))
    for (const [s, n] of [...bySubject.entries()].sort((a, b) => b[1] - a[1])) {
      if (SUBJECT && s !== SUBJECT) continue
      console.log(`  ${s.padEnd(4, "　")} ${String(n).padStart(5)} 道`)
    }
    console.log(
      `  合计 ${eligible.length} 道；学科数 ${bySubject.size}${
        zero.length ? `；**无题的学科：${zero.join("、")}**` : ""
      }`,
    )

    // 3) 抽样：确认去掉 `<Dot>` 后读得通、没有残留标记
    console.log(`\n== 三、抽样（每科 ${SAMPLES} 例，看实际会展示的文本） ==`)
    for (const [s] of [...bySubject.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (SUBJECT && s !== SUBJECT) continue
      const list = eligible.filter((e) => e.row.subject === s)
      for (let i = 0; i < Math.min(SAMPLES, list.length); i += 1) {
        const pick = list[Math.floor(Math.random() * list.length)]
        printSample(pick.row, pick.prompt, pick.options)
      }
    }

    // 4) 兜底校验：最终文本里不允许残留任何标记
    const bad = eligible.filter((e) => {
      const all = [e.prompt, ...e.options.map((o) => o.label)].join("\n")
      return /!\[[^\]]*\]\(|<QImg|\$|<Dot>|<\/Dot>|<U>|<\/U>|\*\*/i.test(all)
    })
    console.log("\n== 四、残留标记检查 ==")
    console.log(bad.length === 0 ? "  PASS：题池里没有残留的图片/公式/标签标记" : `  FAIL：${bad.length} 道仍有残留`)
    for (const b of bad.slice(0, 5)) {
      console.log(`   - ${b.row.id} ${clip(b.prompt.replace(/\n/g, " "), 80)}`)
    }
    if (bad.length) process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
