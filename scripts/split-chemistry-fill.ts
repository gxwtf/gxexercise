/**
 * 化学：把套卷里的「非选择」大组拆成按题型的独立题组
 * （物质结构与性质 / 化学反应原理 / 有机化学基础 / 工业流程 / 实验探究）。
 *
 * 题型判断不在本脚本里做——由流水线的分类器产出（exam-parser/chem_category.py）：
 *   python3 chem_category.py --all --json /tmp/chem_categories.json
 * 输出 `{卷名: {"15": {"category":"结构","score":11,...}, ...}}`，本脚本按题号顺序把它对到库里
 * 「非选择」组的第 1..N 道题上（两边都按题号排序，所以顺序一定一致）。
 *
 * 为什么不是删了重导：库里这些题目已经有 id，重新导入会换 id、连带丢掉作答/优秀解答引用。
 * 所以做法是「原地搬家」——新建分组、把原题目重新挂到新组下、删掉空的旧组、再重排套卷顺序，
 * 选择题组完全不动（用户要求选择题组不重新导入）。
 *
 * 用法：
 *   npx tsx scripts/split-chemistry-fill.ts --map /tmp/chem_categories.json --dry-run
 *   npx tsx scripts/split-chemistry-fill.ts --map /tmp/chem_categories.json --apply
 *   npx tsx scripts/split-chemistry-fill.ts --map <json> --paper "2026北京海淀高三（上）期中化学" --apply
 * 选项：
 *   --dry-run  只打印将要做的拆分（默认行为）
 *   --apply    真正写库
 *   --force    已经拆过的卷也重跑（改了分类 JSON 后按新分类重建题型组）
 *   --paper    只处理这一卷（按 title 精确匹配）
 *   --fix-score 顺带把非选择题分值写回（默认就写，取 JSON 里的 score）
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { chemCategoryLabel, CHEM_CATEGORY_LABELS, CHEM_FILL_CATEGORY } from "../src/constants/chemistry";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const has = (n: string) => process.argv.includes(`--${n}`);
const force = has("force");

interface CatEntry {
  category: string;
  score?: number;
  reason?: string;
  top?: Record<string, number>;
}
type CatMap = Record<string, Record<string, CatEntry>>;

interface PlanItem {
  no: number;
  label: string;
  score: number;
  reason: string;
  questionId: string;
}

async function main() {
  const mapPath = arg("map");
  if (!mapPath) throw new Error("--map 必填（chem_category.py --all --json 的产物）");
  const map = JSON.parse(fs.readFileSync(mapPath, "utf-8")) as CatMap;
  const apply = has("apply");
  const only = arg("paper");

  const papers = await prisma.testPaper.findMany({
    where: { subject: "化学", ...(only ? { title: only } : {}) },
    select: { id: true, title: true, totalScore: true },
    orderBy: { title: "asc" },
  });

  let done = 0;
  let skipped = 0;
  const problems: string[] = [];

  for (const paper of papers) {
    const items = await prisma.paperItem.findMany({
      where: { paperId: paper.id, itemType: "questionGroup" },
      orderBy: { orderIndex: "asc" },
      select: { id: true, itemId: true, orderIndex: true },
    });
    if (!items.length) continue;
    const groups = await prisma.questionGroup.findMany({
      where: { id: { in: items.map((i) => i.itemId) } },
      select: { id: true, title: true, category: true, questionType: true, subject: true, source: true, grade: true, tags: true },
    });
    const byId = new Map(groups.map((g) => [g.id, g]));
    const fillItem = items.find((i) => byId.get(i.itemId)?.category === CHEM_FILL_CATEGORY);
    // 已经拆过的卷（category 是 5 个题型之一）只有在 --force 时才重跑，避免误操作
    const catItems = items.filter((i) => {
      const cat = byId.get(i.itemId)?.category;
      return cat ? Object.values(CHEM_CATEGORY_LABELS).includes(cat) : false;
    });
    const resplitting = !fillItem && force && catItems.length > 0;
    if (!fillItem && !resplitting) continue; // 没有非选择题 / 已经拆过且没加 --force

    const sourceGroupIds = fillItem ? [fillItem.itemId] : catItems.map((i) => i.itemId);
    const fillGroup = byId.get(sourceGroupIds[0])!;

    const fillQuestions = await prisma.groupItem.findMany({
      where: { groupId: { in: sourceGroupIds } },
      orderBy: [{ groupId: "asc" }, { orderIndex: "asc" }],
      include: { question: { select: { id: true, score: true, category: true } } },
    });
    // 重跑时按套卷顺序（题号）重排：先按原组的顺序拼
    if (resplitting) {
      const orderOfGroup = new Map(catItems.map((i, k) => [i.itemId, k]));
      fillQuestions.sort(
        (a, b) => (orderOfGroup.get(a.groupId) ?? 0) - (orderOfGroup.get(b.groupId) ?? 0) || a.orderIndex - b.orderIndex,
      );
    }

    const entries = map[paper.title];
    const ordered = entries
      ? Object.entries(entries).map(([no, e]) => ({ no: Number(no), ...e })).sort((a, b) => a.no - b.no)
      : [];
    // 分类器没覆盖到 / 题数对不上（MD 漏切题号）：按位置兜底，别把整卷跳过
    const fallback = ordered.length !== fillQuestions.length;
    if (fallback) {
      problems.push(
        `${paper.title}：${entries ? `分类 ${ordered.length} 题 ≠ 库里非选择 ${fillQuestions.length} 题` : "分类结果里没有这一卷"}，按位置兜底`,
      );
    }

    const year = paper.title.match(/(20\d{2})/)?.[1];
    const isNew = year ? Number(year) >= 2021 : true;
    const newPrior = ["化学结构占位", "物质结构与性质", "化学反应原理", "有机化学基础", "工业流程", "实验探究"];
    const oldPrior = ["有机化学基础", "化学反应原理", "工业流程", "实验探究"];

    // 题数对不上时（MD 漏切题号）：把已知题号往前补齐，按题号查，查不到的那几题才用位置兜底
    const byNo = new Map(ordered.map((o) => [o.no, o]));
    // 已知题号往往是连续的，中间漏一个（MD 漏切题号）优先按「连续区间」补齐，整段缺失才往前扩展
    let nos: number[] = ordered.length
      ? Array.from({ length: ordered[ordered.length - 1].no - ordered[0].no + 1 }, (_, i) => ordered[0].no + i)
      : [];
    while (nos.length < fillQuestions.length && nos.length) nos.unshift(nos[0] - 1);

    const plan: PlanItem[] = fillQuestions.map((gi, i) => {
      const e = byNo.get(nos[i]);
      if (e) {
        const label = chemCategoryLabel(e.category);
        if (!label) problems.push(`${paper.title} 第${e.no}题：分类名「${e.category}」不认识，按化学反应原理处理`);
        return {
          no: e.no,
          label: label ?? "化学反应原理",
          score: typeof e.score === "number" && e.score > 0 ? e.score : Math.round(gi.question.score ?? 0),
          reason: e.reason ?? "",
          questionId: gi.question.id,
        };
      }
      const label = isNew ? newPrior[i + 1] ?? "化学反应原理" : oldPrior[i] ?? "化学反应原理";
      return {
        no: 15 + i,
        label,
        score: Math.round(gi.question.score ?? 0) || 13,
        reason: "兜底-位置",
        questionId: gi.question.id,
      };
    });

    console.log(`\n${paper.title}`);
    for (const p of plan) console.log(`  q${p.no} → ${p.label}  ${p.score} 分  [${p.reason}]`);

    if (!apply) continue;

    // 同一题型可能有多道题（海淀期中 16、17 都是「化学反应原理」）→ 合成一个题组，组内按题号排
    const buckets = new Map<string, PlanItem[]>();
    for (const p of plan) {
      if (!buckets.has(p.label)) buckets.set(p.label, []);
      buckets.get(p.label)!.push(p);
    }

    const createdGroups: { id: string; firstNo: number }[] = [];
    for (const [label, qs] of buckets) {
      const group = await prisma.questionGroup.create({
        data: {
          title: `${paper.title}·${label}`,
          content: "",
          questionType: fillGroup.questionType,
          score: qs.reduce((n, q) => n + q.score, 0),
          subject: fillGroup.subject,
          source: fillGroup.source,
          grade: fillGroup.grade,
          category: label,
          tags: Array.from(new Set([...(fillGroup.tags ?? []), label])),
        },
        select: { id: true },
      });
      // 题目原地搬家：question id 不变，作答/优秀解答引用都不受影响
      let gi = 0;
      for (const p of qs) {
        // 重跑（--force）时源题分散在多个组里，必须按 questionId 全范围匹配，别只匹配第一组
        await prisma.groupItem.updateMany({
          where: { groupId: { in: sourceGroupIds }, questionId: p.questionId },
          data: { groupId: group.id, orderIndex: gi++ },
        });
        await prisma.question.update({ where: { id: p.questionId }, data: { category: label, score: p.score } });
      }
      createdGroups.push({ id: group.id, firstNo: qs[0].no });
    }
    createdGroups.sort((a, b) => a.firstNo - b.firstNo);

    // 删掉源组（原来的「非选择」大组，或重跑时的那几个题型组）与对应的套卷条目
    for (const gid of sourceGroupIds) {
      await prisma.questionGroup.delete({ where: { id: gid } }).catch(() => {});
    }
    await prisma.paperItem.deleteMany({ where: { paperId: paper.id, itemId: { in: sourceGroupIds } } });

    // 重排套卷顺序：新组插在原来「非选择」（或重跑时第一个题型组）的位置上
    const insertAt = fillItem ? fillItem.orderIndex : catItems[0].orderIndex;
    const rest = await prisma.paperItem.findMany({
      where: { paperId: paper.id }, orderBy: { orderIndex: "asc" }, select: { id: true, orderIndex: true },
    });
    let order = 0;
    for (const it of rest) {
      if (it.orderIndex >= insertAt) {
        await prisma.paperItem.update({ where: { id: it.id }, data: { orderIndex: order + createdGroups.length } });
      } else {
        await prisma.paperItem.update({ where: { id: it.id }, data: { orderIndex: order } });
      }
      order++;
    }
    for (let k = 0; k < createdGroups.length; k++) {
      await prisma.paperItem.create({
        data: { paperId: paper.id, itemId: createdGroups[k].id, itemType: "questionGroup", orderIndex: insertAt + k },
      });
    }

    // 套卷总分 = 所有题目分值之和
    const allQs = await prisma.question.findMany({
      where: { id: { in: (await prisma.groupItem.findMany({
        where: { groupId: { in: (await prisma.paperItem.findMany({ where: { paperId: paper.id, itemType: "questionGroup" }, select: { itemId: true } })).map((i) => i.itemId) } },
        select: { questionId: true },
      })).map((g) => g.questionId) } },
      select: { score: true },
    });
    const total = allQs.reduce((n, q) => n + (q.score ?? 0), 0);
    await prisma.testPaper.update({ where: { id: paper.id }, data: { totalScore: total || null } });
    console.log(`  ✓ 已拆成 ${createdGroups.length} 组，套卷总分 ${total}（原 ${paper.totalScore}）`);
    done++;
  }

  console.log(`\n${apply ? "已拆分" : "干跑"}：${done} 卷${skipped ? `，跳过 ${skipped} 卷` : ""}`);
  if (problems.length) {
    console.log("需要注意：");
    for (const p of problems.slice(0, 30)) console.log("  -", p);
  }
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
