/**
 * 一次性修复：把「化学非选择题分组拆分」重跑时被误删组关联的题目重新挂回题型组。
 *
 * 背景：`split-chemistry-fill.ts` 的 `--force` 重跑分支曾经只在第一个源组里匹配 questionId，
 * 导致其余题目的 GroupItem 随旧组一起被删（Question 行本身完好，category/score 都在）。
 * 本脚本按 `Question.source === TestPaper.title` 找回这些「孤儿题」，按 QUestion.category
 * 挂回该卷对应的题型组（缺组的会补建），并重算题组/套卷总分。
 *
 * 用法：npx tsx scripts/repair-chemistry-groups.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { CHEM_CATEGORY_LABELS } from "../src/constants/chemistry";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const apply = process.argv.includes("--apply");

async function main() {
  const labels = Object.values(CHEM_CATEGORY_LABELS);
  const papers = await prisma.testPaper.findMany({
    where: { subject: "化学" },
    select: { id: true, title: true, totalScore: true },
    orderBy: { title: "asc" },
  });

  let relinked = 0;
  let createdGroups = 0;
  let touchedPapers = 0;

  for (const paper of papers) {
    const items = await prisma.paperItem.findMany({
      where: { paperId: paper.id, itemType: "questionGroup" },
      orderBy: { orderIndex: "asc" },
      select: { id: true, itemId: true, orderIndex: true },
    });
    const groups = await prisma.questionGroup.findMany({
      where: { id: { in: items.map((i) => i.itemId) } },
      select: { id: true, category: true, questionType: true, subject: true, source: true, grade: true, tags: true, score: true },
    });
    const byCategory = new Map(groups.map((g) => [g.category, g]));
    const choiceGroup = groups.find((g) => g.category === "选择");

    // 孤儿题：本题组所属套卷、非选择题、且没有任何 GroupItem
    const orphans = await prisma.question.findMany({
      where: {
        subject: "化学",
        source: paper.title,
        category: { in: labels },
        groupItems: { none: {} },
      },
      orderBy: { id: "asc" },
      select: { id: true, category: true, score: true },
    });
    if (!orphans.length) continue;
    touchedPapers++;
    console.log(`\n${paper.title}：孤儿题 ${orphans.length}`);

    for (const q of orphans) {
      const category = q.category;
      let group = byCategory.get(category);
      if (!group) {
        if (apply) {
          const created = await prisma.questionGroup.create({
            data: {
              title: `${paper.title}·${category}`,
              content: "",
              questionType: choiceGroup?.questionType ?? "chemistry-image",
              score: 0,
              subject: "化学",
              source: choiceGroup?.source ?? paper.title,
              grade: choiceGroup?.grade ?? null,
              category,
              tags: Array.from(new Set([...(choiceGroup?.tags ?? []), category])),
            },
            select: { id: true, category: true, questionType: true, subject: true, source: true, grade: true, tags: true, score: true },
          });
          group = created;
          createdGroups++;
          // 套卷里也要有条目：插在最后一个题型组之后
          const maxOrder = (await prisma.paperItem.aggregate({ where: { paperId: paper.id }, _max: { orderIndex: true } }))._max.orderIndex ?? 0;
          await prisma.paperItem.create({ data: { paperId: paper.id, itemId: created.id, itemType: "questionGroup", orderIndex: maxOrder + 1 } });
        } else {
          console.log(`   [dry] 需要新建题组「${category}」`);
          byCategory.set(category, { id: "", category, questionType: "", subject: "", source: "", grade: null, tags: [], score: 0 } as never);
          group = byCategory.get(category)!;
        }
      }
      if (!apply || !group?.id) continue;
      const count = await prisma.groupItem.count({ where: { groupId: group.id } });
      await prisma.groupItem.create({ data: { groupId: group.id, questionId: q.id, orderIndex: count } });
      relinked++;
      console.log(`   ✓ q(${q.id.slice(-6)}) → ${category}（组内第 ${count + 1} 题）`);
    }

    if (!apply) continue;
    // 重算组分数与套卷总分
    const finalGroups = await prisma.paperItem.findMany({
      where: { paperId: paper.id, itemType: "questionGroup" },
      select: { itemId: true },
    });
    let total = 0;
    for (const it of finalGroups) {
      const qs = await prisma.groupItem.findMany({ where: { groupId: it.itemId }, include: { question: { select: { score: true } } } });
      const sum = qs.reduce((n, x) => n + (x.question.score ?? 0), 0);
      await prisma.questionGroup.update({ where: { id: it.itemId }, data: { score: sum } });
      total += sum;
    }
    if (total !== paper.totalScore) {
      await prisma.testPaper.update({ where: { id: paper.id }, data: { totalScore: total || null } });
      console.log(`   总分 ${paper.totalScore} → ${total}`);
    }
  }

  console.log(`\n${apply ? "已修复" : "干跑"}：涉及 ${touchedPapers} 卷，重挂 ${relinked} 题，新建题组 ${createdGroups} 个`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
