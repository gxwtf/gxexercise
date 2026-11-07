import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
const APPLY = process.argv.includes("--apply");

/** 把「二选一/三选一」板块标成 answerMode=pick-one，并把每道题都放回满分（作文 50 / 微写作 10）。
 *  只处理小问数 > 1 的作文/微写作板块；单题板块保持 all。 */
const FULL: Record<string, number> = { 作文: 50, 微写作: 10 };

async function main() {
  const groups = await prisma.questionGroup.findMany({
    where: { subject: "语文", category: { in: Object.keys(FULL) }, answerMode: "all" },
    include: { groupItems: { orderBy: { orderIndex: "asc" }, include: { question: true } } },
  });
  let done = 0, skipped = 0;
  for (const g of groups) {
    const full = FULL[g.category];
    if (!full || g.groupItems.length <= 1) { skipped++; continue; }
    const before = g.groupItems.map((i) => i.question.score);
    if (APPLY) {
      for (const item of g.groupItems) {
        if (Math.round(item.question.score ?? 0) !== full) {
          await prisma.question.update({ where: { id: item.question.id }, data: { score: full } });
        }
      }
      await prisma.questionGroup.update({ where: { id: g.id }, data: { answerMode: "pick-one", score: full } });
    }
    done++;
    console.log(`${APPLY ? "✓" : "[dry]"} ${g.title}｜${g.category}｜${g.groupItems.length} 小问 ${before.join("/")} → 全 ${full}（板块分 ${g.score} → ${full}）`);
  }
  console.log(`\n${APPLY ? "已处理" : "待处理"} ${done} 组；跳过（单题/非作文类）${skipped} 组`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
