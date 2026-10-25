/**
 * 删除化学「文本版」试卷（没有 tag=图片题 的那些），彻底清掉题组/题目/交卷记录。
 * 用法：npx tsx scripts/delete-chemistry-text-papers.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const dry = process.argv.includes("--dry-run");

async function main() {
  const papers = await prisma.testPaper.findMany({
    where: { subject: "化学", NOT: { tags: { has: "图片题" } } },
    select: { id: true, title: true },
  });
  console.log(`待删除文本版试卷 ${papers.length} 份${dry ? "（dry-run）" : ""}`);
  let g = 0, q = 0;
  for (const p of papers) {
    const items = await prisma.paperItem.findMany({ where: { paperId: p.id }, select: { itemId: true } });
    const groupIds = items.map((i) => i.itemId);
    const gis = groupIds.length
      ? await prisma.groupItem.findMany({ where: { groupId: { in: groupIds } }, select: { questionId: true } })
      : [];
    const qids = Array.from(new Set(gis.map((x) => x.questionId)));
    if (!dry) {
      if (qids.length) await prisma.questionSubmission.deleteMany({ where: { questionId: { in: qids } } });
      if (groupIds.length) {
        await prisma.questionGroupSubmission.deleteMany({ where: { questionGroupId: { in: groupIds } } });
        await prisma.groupItem.deleteMany({ where: { groupId: { in: groupIds } } });
        await prisma.paperItem.deleteMany({ where: { paperId: p.id } });
        await prisma.questionGroup.deleteMany({ where: { id: { in: groupIds } } });
      }
      await prisma.testPaperSubmission.deleteMany({ where: { testPaperId: p.id } });
      await prisma.testPaper.delete({ where: { id: p.id } });
      if (qids.length) await prisma.question.deleteMany({ where: { id: { in: qids } } });
    }
    g += groupIds.length; q += qids.length;
  }
  console.log(`删除完成：题组 ${g} / 题目 ${q}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
