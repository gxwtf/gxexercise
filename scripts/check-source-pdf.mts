/**
 * 审计「套卷 → 原始 PDF / 参考答案」的匹配结果（src/lib/pdf/find-source-pdf.ts、find-source-answer.ts）。
 *
 * 用途：改匹配逻辑后跑一遍，看有没有「阶段对不上」的错配（期中↔期末、一模↔二模、上↔下）。
 * 用法（仓库根）：
 *   npx tsx scripts/check-source-pdf.mts            # 只报错配与统计
 *   npx tsx scripts/check-source-pdf.mts --all      # 连正常命中也逐条打印
 *   npx tsx scripts/check-source-pdf.mts --answers  # 顺带列出「能下载答案」的套卷
 *   npx tsx scripts/check-source-pdf.mts --grep 期中 # 只看标题含关键词的
 * 有错配（原卷或答案）时退出码为 1。
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { findSourcePdf, examStageOf, examTermOf } from "../src/lib/pdf/find-source-pdf"
import { findSourceAnswer } from "../src/lib/pdf/find-source-answer"
import { sameExamBatch } from "../src/lib/pdf/source-match"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const showAll = process.argv.includes("--all")
const showAnswers = process.argv.includes("--answers")
const grepIdx = process.argv.indexOf("--grep")
const grep = grepIdx > 0 ? process.argv[grepIdx + 1] : undefined

function main() {
  return prisma.testPaper.findMany({
    select: { id: true, title: true, subject: true, year: true },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
  })
}

const papers = await main()
const rows: Array<{ title: string; subject: string; match: string; score: number; mismatch: string | null }> = []
const answerRows: Array<{ title: string; subject: string; file: string; exact: boolean }> = []
const answerMismatches: string[] = []
let notFound = 0

for (const p of papers) {
  if (grep && !p.title.includes(grep)) continue
  const answer = findSourceAnswer(p.title, p.subject)
  if (answer) {
    answerRows.push({ title: p.title, subject: p.subject, file: answer.fileName, exact: answer.exact })
    // 答案文件不许跨年份/区县/卷别/学期（正常应该由 sameExamBatch + conflicts 挡住，这里兜底审计）
    if (!sameExamBatch(p.title, answer.fileName)) {
      answerMismatches.push(`${p.title} → ${answer.fileName}（年份或区县对不上）`)
    }
  }

  const m = findSourcePdf(p.title, p.subject)
  if (!m) {
    notFound++
    rows.push({ title: p.title, subject: p.subject, match: "（未找到）", score: 0, mismatch: null })
    continue
  }
  const wantStage = examStageOf(p.title)
  const gotStage = examStageOf(m.fileName)
  const wantTerm = examTermOf(p.title)
  const gotTerm = examTermOf(m.fileName)
  const bad: string[] = []
  if (wantStage && gotStage && wantStage !== gotStage) bad.push(`阶段 ${wantStage}≠${gotStage}`)
  if (wantTerm && gotTerm && wantTerm !== gotTerm) bad.push(`学期 ${wantTerm}≠${gotTerm}`)
  rows.push({
    title: p.title,
    subject: p.subject,
    match: m.fileName,
    score: m.score,
    mismatch: bad.length ? bad.join("；") : null,
  })
}

const mismatches = rows.filter((r) => r.mismatch)
const total = rows.length

for (const r of rows) {
  if (!showAll && !r.mismatch) continue
  const flag = r.mismatch ? "✗ 错配" : "✓"
  console.log(`${flag}  ${r.title}`)
  console.log(`      命中：${r.match}  score=${r.score.toFixed(3)}${r.mismatch ? `  【${r.mismatch}】` : ""}`)
}

if (showAnswers) {
  console.log("")
  console.log(`— 可下载答案的套卷（${answerRows.length}）—`)
  for (const a of answerRows) console.log(`  ${a.title} → ${a.file}（exact=${a.exact}）`)
}

console.log("")
console.log(`共 ${total} 套卷：命中 ${total - notFound}，未找到 ${notFound}，阶段/学期错配 ${mismatches.length}，答案 ${answerRows.length} 套`)
if (mismatches.length) {
  const byKind = new Map<string, number>()
  for (const m of mismatches) byKind.set(m.mismatch!, (byKind.get(m.mismatch!) ?? 0) + 1)
  for (const [k, v] of byKind) console.log(`  ${k}: ${v}`)
}

await prisma.$disconnect()
await pool.end()
if (answerMismatches.length) {
  console.log("")
  console.log(`✗ 答案错配 ${answerMismatches.length} 套：`)
  for (const a of answerMismatches) console.log(`  ${a}`)
}

process.exit(mismatches.length || answerMismatches.length ? 1 : 0)
