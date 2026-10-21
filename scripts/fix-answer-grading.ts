/**
 * 修正历史客观题判分：用新的 isAnswerCorrect（忽略空格/大小写/全角/选择题分隔符）
 * 重新判定每条客观题提交，并回算小节得分与整卷得分。
 *
 * 用法：npx tsx scripts/fix-answer-grading.ts [--dry-run]
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { isAnswerCorrect } from "../src/lib/answer-check"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const dryRun = process.argv.includes("--dry-run")

function isSubjective(questionType: string, groupType: string) {
  const combined = `${questionType} ${groupType}`
  if (combined.includes("解答") || combined.includes("阅读表达") || combined.includes("reading-expression")) return true
  if (combined.includes("写作") || combined.includes("en-writing")) return true
  if (groupType === "chinese-reading" && questionType === "text") return true
  return false
}

async function main() {
  const submissions = await prisma.questionSubmission.findMany({
    where: { groupSubmissionId: { not: null } },
    select: {
      id: true,
      content: true,
      score: true,
      isCorrect: true,
      groupSubmissionId: true,
      question: { select: { answer: true, score: true, questionType: true } },
      groupSubmission: {
        select: { questionGroup: { select: { questionType: true } } },
      },
    },
  })

  let fixed = 0
  const affectedGroups = new Set<string>()

  for (const s of submissions) {
    const groupType = s.groupSubmission?.questionGroup?.questionType ?? ""
    if (isSubjective(s.question.questionType, groupType)) continue
    const answer = (s.content as { answer?: string } | null)?.answer ?? ""
    const shouldBeCorrect = isAnswerCorrect(answer, s.question.answer)
    const expectedScore = shouldBeCorrect ? s.question.score ?? 0 : 0
    if (s.isCorrect === shouldBeCorrect && s.score === expectedScore) continue

    console.log(
      `${s.id} 作答=${JSON.stringify(answer)} 正确=${JSON.stringify(s.question.answer)} ` +
        `原 isCorrect=${s.isCorrect} score=${s.score} → 新 isCorrect=${shouldBeCorrect} score=${expectedScore}`
    )
    if (!dryRun) {
      await prisma.questionSubmission.update({
        where: { id: s.id },
        data: { isCorrect: shouldBeCorrect, score: expectedScore },
      })
    }
    if (s.groupSubmissionId) affectedGroups.add(s.groupSubmissionId)
    fixed++
  }

  // 回算受影响小节的得分/正确题数
  let groups = 0
  for (const gid of affectedGroups) {
    const subs = await prisma.questionSubmission.findMany({
      where: { groupSubmissionId: gid },
      select: { score: true, isCorrect: true },
    })
    const total = subs.reduce((n, x) => n + (x.score ?? 0), 0)
    const correctNum = subs.filter((x) => x.isCorrect === true).length
    if (!dryRun) {
      await prisma.questionGroupSubmission.update({
        where: { id: gid },
        data: { score: total, correctNum },
      })
    }
    groups++
  }

  // 回算受影响套卷的总分
  let papers = 0
  if (affectedGroups.size) {
    const sections = await prisma.questionGroupSubmission.findMany({
      where: { id: { in: Array.from(affectedGroups) } },
      select: { testSubmissionId: true },
    })
    const paperIds = new Set(sections.map((s) => s.testSubmissionId).filter(Boolean) as string[])
    for (const pid of paperIds) {
      const all = await prisma.questionGroupSubmission.findMany({
        where: { testSubmissionId: pid },
        select: { score: true },
      })
      const total = all.reduce((n, x) => n + (x.score ?? 0), 0)
      if (!dryRun) {
        await prisma.testPaperSubmission.update({ where: { id: pid }, data: { score: total } })
      }
      papers++
    }
  }

  console.log(`\n${dryRun ? "[dry-run] " : ""}修正题目提交 ${fixed} 条｜回算小节 ${groups} 个｜回算套卷 ${papers} 份`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
