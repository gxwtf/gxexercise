import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
const DRY = process.argv.includes("--dry-run");

/** 语文分值兜底：作文 50 / 微写作 10 / 默写 1 分空；组内选择 3（多选 4），主观分摊剩余，保证 Σ小问 == 组总分 */
async function main() {
  const papers = await prisma.testPaper.findMany({ where: { subject: "语文" }, select: { id: true, title: true } });
  let fixedPapers = 0, fixedQ = 0;
  for (const p of papers) {
    const items = await prisma.paperItem.findMany({ where: { paperId: p.id }, orderBy: { orderIndex: "asc" }, select: { itemId: true } });
    let touched = false;
    for (const it of items) {
      const g = await prisma.questionGroup.findUnique({
        where: { id: it.itemId },
        include: { groupItems: { orderBy: { orderIndex: "asc" }, include: { question: true } } },
      });
      if (!g) continue;
      const qs = g.groupItems.map((x) => x.question);
      if (!qs.length) continue;
      const total = Math.round(g.score ?? 0) || qs.reduce((n, q) => n + (q.score ?? 0), 0);
      const cat = g.category || "";
      // 作文/微写作 是二选一/三选一：小问数×满分 ≠ 板块分，整块跳过
      if (cat === "作文" || cat === "微写作") continue;
      // 只修「明显被压扁」的板块：某题 ≥7 分且同时存在 ≤1 分的小题（分值被人为堆到一题上的痕迹）
      const scores = qs.map((q) => Math.round(q.score ?? 0));
      const hasAnomaly =
        cat !== "名著" &&
        qs.some((q) => (q.questionType === "single" ? Math.round(q.score ?? 0) > 6 : Math.round(q.score ?? 0) > 9));
      if (!hasAnomaly) continue;
      let plan: number[] | null = null;
      if (cat === "默写") plan = qs.map(() => 1);
      else {
        const singles = qs.filter((q) => q.questionType === "single");
        const texts = qs.filter((q) => q.questionType !== "single");
        const perSingle = singles.map((q) => (/^[A-D]{2,4}$/.test(String(q.answer || "").trim().toUpperCase()) ? 4 : 3));
        const singleSum = perSingle.reduce((a, b) => a + b, 0);
        const rest = Math.max(texts.length * 2, total - singleSum);
        plan = [];
        let si = 0;
        for (const q of qs) {
          if (q.questionType === "single") plan.push(perSingle[si++]);
          else {
            const n = texts.length;
            const base = Math.max(2, Math.floor(rest / n));
            plan.push(base);
          }
        }
        // 把差额补到最后一个主观题
        const diff = total - plan.reduce((a, b) => a + b, 0);
        if (diff !== 0) {
          const idx = plan.map((_, i) => (qs[i].questionType === "single" ? -1 : i)).filter((i) => i >= 0).pop();
          if (idx !== undefined) plan[idx] += diff;
        }
      }
      const changed = qs.some((q, i) => Math.round(q.score ?? 0) !== plan![i]);
      if (!changed) continue;
      touched = true; fixedQ += qs.filter((q, i) => Math.round(q.score ?? 0) !== plan![i]).length;
      if (DRY) { console.log(`[dry] ${p.title} ${cat}: ${qs.map((q) => q.score).join("/")} → ${plan.join("/")}`); }
      else {
        for (let i = 0; i < qs.length; i++) {
          if (Math.round(qs[i].score ?? 0) !== plan[i]) await prisma.question.update({ where: { id: qs[i].id }, data: { score: plan[i] } });
        }
        const newGroupScore = plan.reduce((a, b) => a + b, 0);
        if (Math.round(g.score ?? 0) !== newGroupScore) await prisma.questionGroup.update({ where: { id: g.id }, data: { score: newGroupScore } });
      }
    }
    if (touched) { fixedPapers++; if (!DRY) await prisma.testPaper.update({ where: { id: p.id }, data: { totalScore: 150 } }); }
  }
  console.log(`修复：${fixedPapers} 卷 / ${fixedQ} 题${DRY ? "（dry-run）" : ""}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
