import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const dry = process.argv.includes("--dry-run");
async function main() {
  const papers = await prisma.testPaper.findMany({ where: { subject: "化学", title: { contains: "（图片版）" } }, select: { id: true, title: true } });
  console.log(`待删除带（图片版）的试卷 ${papers.length} 份${dry ? "（dry-run）" : ""}`);
  for (const p of papers) {
    const items = await prisma.paperItem.findMany({ where: { paperId: p.id }, select: { itemId: true } });
    const groupIds = items.map((i) => i.itemId);
    const gis = groupIds.length ? await prisma.groupItem.findMany({ where: { groupId: { in: groupIds } }, select: { questionId: true } }) : [];
    const qids = Array.from(new Set(gis.map((x) => x.questionId)));
    if (dry) continue;
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
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
