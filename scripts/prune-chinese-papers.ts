import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
const APPLY = process.argv.includes("--apply");

/** 语文下架口径（2026-11-07 产品决定）：
 *  1) year <= 2020 的**模拟题**（一模/二模/上期末等）全部下架；
 *  2) 北京高考真题不受年份限制，保留；
 *  3) 外地卷（全国/上海/天津/江苏/浙江/海南/山东/广东…）全部下架。
 */
const OUTSIDE = ["全国", "上海", "天津", "江苏", "浙江", "海南", "山东", "广东", "湖北", "湖南", "四川"];

function shouldDrop(title: string, year: number | null): { drop: boolean; why: string } {
  const isZhenti = title.includes("真题");
  if (OUTSIDE.some((k) => title.includes(k))) return { drop: true, why: "外地卷" };
  if (!isZhenti && year !== null && year <= 2020) return { drop: true, why: `模拟题·${year} 年及以前` };
  return { drop: false, why: isZhenti ? "北京真题（保留）" : "保留" };
}

async function deletePaper(paperId: string, title: string) {
  const items = await prisma.paperItem.findMany({ where: { paperId }, select: { itemId: true } });
  const groupIds = items.map((i) => i.itemId);
  if (groupIds.length) {
    const gis = await prisma.groupItem.findMany({ where: { groupId: { in: groupIds } }, select: { questionId: true } });
    const qids = Array.from(new Set(gis.map((g) => g.questionId)));
    const gsubs = await prisma.questionGroupSubmission.findMany({ where: { questionGroupId: { in: groupIds } }, select: { id: true } });
    if (gsubs.length) {
      await prisma.questionSubmission.deleteMany({ where: { groupSubmissionId: { in: gsubs.map((g) => g.id) } } });
      await prisma.questionGroupSubmission.deleteMany({ where: { questionGroupId: { in: groupIds } } });
    }
    await prisma.groupItem.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.paperItem.deleteMany({ where: { paperId } });
    await prisma.testPaperSubmission.deleteMany({ where: { testPaperId: paperId } });
    await prisma.questionGroup.deleteMany({ where: { id: { in: groupIds } } });
    if (qids.length) await prisma.question.deleteMany({ where: { id: { in: qids } } });
  }
  await prisma.testPaper.delete({ where: { id: paperId } });
  console.log(`  ✗ ${title}`);
}

async function main() {
  const papers = await prisma.testPaper.findMany({ where: { subject: "语文" }, select: { id: true, title: true, year: true }, orderBy: [{ year: "asc" }, { title: "asc" }] });
  const drops = papers.map((p) => ({ ...p, ...shouldDrop(p.title, p.year) })).filter((p) => p.drop);
  const keeps = papers.filter((p) => !shouldDrop(p.title, p.year).drop);
  console.log(`语文共 ${papers.length} 卷；将下架 ${drops.length} 卷，保留 ${keeps.length} 卷${APPLY ? "" : "（dry-run）"}`);
  for (const d of drops) console.log(`  - [${d.why}] ${d.title}`);
  if (APPLY) {
    for (const d of drops) {
      const pItems = await prisma.paperItem.findMany({ where: { paperId: d.id }, select: { itemId: true } });
      const subs = pItems.length
        ? await prisma.questionGroupSubmission.count({ where: { questionGroupId: { in: pItems.map((i) => i.itemId) } } })
        : 0;
      if (subs > 0) console.log(`  ⚠ ${d.title}：有 ${subs} 份题组作答，一并删除`);
      await deletePaper(d.id, d.title);
    }
  }
  console.log("保留清单：");
  for (const k of keeps) console.log(`  = ${k.title}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
