/**
 * 图片版试卷导入：每个题组/每道题的题干就是一张渲染好的图片（split_chem_docx.py 生成）。
 * 数据结构：paper.json
 *   {title, subject, source, grade, year, tags, questions:[{no,type,image,options,answer,score}]}
 *
 * 特点：与原有「文本版」试卷共存（title 带（图片版）后缀，互不影响）。
 * 选择题：题干 = ![](图片)，options = 4 个空 label（前端只显示 A/B/C/D 按钮）。
 *
 * 用法：npx tsx scripts/import-image-questions.ts --dir <单题目录> [--force]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { CHEM_FILL_CATEGORY, chemCategoryLabel } from "../src/constants/chemistry";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const has = (n: string) => process.argv.includes(`--${n}`);

interface Q {
  no: number;
  content?: string;
  analysis?: string;
  type: "single" | "text";
  image: string;
  options?: { id: string; label: string }[];
  answer?: string;
  score?: number | null;
  /** 非选择题的题型短名（结构/原理/有机/流程/探究），由流水线 chem_category.py 给出 */
  category?: string;
}
interface Paper {
  title: string;
  subject: string;
  source: string;
  grade: string;
  year?: number | null;
  tags: string[];
  questions: Q[];
}


/**
 * 重导保护：删旧卷之前把作答快照下来，重建后按「题组顺序 + 组内题序」映射回新 id。
 * 映射不上就中止（除非显式 --drop-submissions），绝不静默丢作答。
 */
interface SubSnapshot {
  groupKey: string;          // 组在套卷里的次序（0 起）+ 组分类，便于对齐
  groupOrder: number;
  groupCategory: string;
  groupScore: number;
  correctNum: number;
  totalNum: number;
  testSubmissionId: string | null;
  userId: number;
  createdAt: Date;
  subs: {
    order: number;
    content: unknown;
    score: number | null;
    isCorrect: boolean | null;
    gradingStatus: string;
    aiFeedback: unknown;
    shareAsExcellent: boolean | null;
    createdAt: Date;
  }[];
}

async function snapshotPaper(paperId: string) {
  const items = await prisma.paperItem.findMany({
    where: { paperId, itemType: "questionGroup" },
    orderBy: { orderIndex: "asc" },
    select: { itemId: true },
  });
  const snaps: SubSnapshot[] = [];
  for (let gi = 0; gi < items.length; gi++) {
    const groupId = items[gi].itemId;
    const group = await prisma.questionGroup.findUnique({ where: { id: groupId }, select: { category: true, score: true } });
    const gsubs = await prisma.questionGroupSubmission.findMany({
      where: { questionGroupId: groupId },
      select: { userId: true, score: true, correctNum: true, totalNum: true, testSubmissionId: true, createdAt: true },
    });
    const qitems = await prisma.groupItem.findMany({ where: { groupId }, orderBy: { orderIndex: "asc" }, select: { questionId: true } });
    for (const gs of gsubs) {
      const subs = await prisma.questionSubmission.findMany({
        where: { userId: gs.userId, questionId: { in: qitems.map((q) => q.questionId) } },
        select: { questionId: true, content: true, score: true, isCorrect: true, gradingStatus: true, aiFeedback: true, shareAsExcellent: true, createdAt: true },
      });
      const orderOf = new Map(qitems.map((q, i) => [q.questionId, i]));
      snaps.push({
        groupKey: `${gi}:${group?.category ?? ""}`,
        groupOrder: gi,
        groupCategory: group?.category ?? "",
        groupScore: gs.score ?? 0,
        correctNum: gs.correctNum ?? 0,
        totalNum: gs.totalNum ?? 0,
        testSubmissionId: gs.testSubmissionId,
        userId: gs.userId,
        createdAt: gs.createdAt,
        subs: subs
          .map((x) => ({ ...x, order: orderOf.get(x.questionId) ?? -1 }))
          .filter((x) => x.order >= 0)
          .sort((a, b) => a.order - b.order),
      });
    }
  }
  return snaps;
}

/** 重建后按题组顺序 + 组内题序把作答写回；返回 [成功数, 失败说明] */
async function restoreSubmissions(paperId: string, title: string, snaps: SubSnapshot[]) {
  const items = await prisma.paperItem.findMany({
    where: { paperId, itemType: "questionGroup" },
    orderBy: { orderIndex: "asc" },
    select: { itemId: true },
  });
  const newQ: string[][] = [];
  for (const it of items) {
    const qs = await prisma.groupItem.findMany({ where: { groupId: it.itemId }, orderBy: { orderIndex: "asc" }, select: { questionId: true } });
    newQ.push(qs.map((q) => q.questionId));
  }
  let ok = 0;
  const problems: string[] = [];
  for (const snap of snaps) {
    const groups = newQ[snap.groupOrder];
    if (!groups) { problems.push(`用户 ${snap.userId}：第 ${snap.groupOrder + 1} 组在新卷里不存在`); continue; }
    const created = await prisma.questionGroupSubmission.create({
      data: {
        userId: snap.userId,
        questionGroupId: items[snap.groupOrder].itemId,
        score: snap.groupScore,
        correctNum: snap.correctNum,
        totalNum: snap.totalNum,
        testSubmissionId: snap.testSubmissionId,
        createdAt: snap.createdAt,
      },
      select: { id: true },
    });
    for (const sub of snap.subs) {
      const qid = groups[sub.order];
      if (!qid) { problems.push(`用户 ${snap.userId}：组内第 ${sub.order + 1} 题在新卷里不存在`); continue; }
      await prisma.questionSubmission.create({
        data: {
          userId: snap.userId,
          questionId: qid,
          groupSubmissionId: created.id,
          content: (sub.content ?? undefined) as never,
          score: sub.score,
          isCorrect: sub.isCorrect,
          gradingStatus: sub.gradingStatus,
          aiFeedback: (sub.aiFeedback ?? undefined) as never,
          shareAsExcellent: sub.shareAsExcellent ?? undefined,
          createdAt: sub.createdAt,
        },
      });
      ok++;
    }
  }
  if (ok) console.log(`  ↻ 已恢复作答：${ok} 条小题提交（${snaps.length} 份组提交）`);
  if (problems.length) console.warn(`  ⚠ 有 ${problems.length} 处作答没能映射：` + problems.slice(0, 5).join("；"));
  return [ok, problems] as const;
}

async function deletePaper(paperId: string, title: string) {
  const items = await prisma.paperItem.findMany({ where: { paperId }, select: { itemId: true } });
  const groupIds = items.map((i) => i.itemId);
  const gis = groupIds.length
    ? await prisma.groupItem.findMany({ where: { groupId: { in: groupIds } }, select: { questionId: true } })
    : [];
  const qids = Array.from(new Set(gis.map((g) => g.questionId)));
  if (groupIds.length) {
    await prisma.questionGroupSubmission.deleteMany({ where: { questionGroupId: { in: groupIds } } });
    await prisma.groupItem.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.paperItem.deleteMany({ where: { paperId } });
    await prisma.testPaperSubmission.deleteMany({ where: { testPaperId: paperId } });
    await prisma.questionGroup.deleteMany({ where: { id: { in: groupIds } } });
  }
  if (qids.length) {
    await prisma.questionSubmission.deleteMany({ where: { questionId: { in: qids } } });
    await prisma.question.deleteMany({ where: { id: { in: qids } } });
  }
  await prisma.testPaper.delete({ where: { id: paperId } });
  console.log(`  已删除旧数据：${title}`);
}

/**
 * 分组：选择题一个大组；非选择题按题型各成一组（物质结构与性质 / 化学反应原理 /
 * 有机化学基础 / 工业流程 / 实验探究）。老 paper.json 没有 category 时退回原来的「非选择」大组。
 */
function buildGroups(paper: Paper): { category: string; type: string; qs: Q[]; title?: string }[] {
  const choice = paper.questions.filter((q) => q.type === "single");
  const fill = paper.questions.filter((q) => q.type === "text");
  const buckets = new Map<string, Q[]>();
  for (const q of fill) {
    const label = chemCategoryLabel(q.category) ?? CHEM_FILL_CATEGORY;
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(q);
  }
  const groups2: { category: string; type: string; qs: Q[]; title?: string }[] = [];
  if (choice.length) groups2.push({ category: "选择", type: "chemistry-image", qs: choice });
  // 一题一组（对齐生物）：组名就是题号，题型放 category
  for (const qs of buckets.values()) {
    for (const q of qs) {
      groups2.push({ category: chemCategoryLabel(q.category) ?? CHEM_FILL_CATEGORY, type: "chemistry-image", qs: [q], title: `第${q.no}题` });
    }
  }
  return groups2;
}

async function importOne(dirArg: string, force: boolean) {
  const paper = JSON.parse(fs.readFileSync(path.join(dirArg, "paper.json"), "utf-8")) as Paper;
  const subject = paper.subject || "化学";
  const exists = await prisma.testPaper.findFirst({ where: { title: paper.title, subject }, select: { id: true } });
  let snap: Awaited<ReturnType<typeof snapshotPaper>> = [];
  let oldPaperId: string | null = null;
  if (exists) {
    if (!force) { console.log(`跳过（已存在）：${paper.title}`); return; }
    // 先把作答快照下来；重建后按题序回填，不再静默丢作答
    snap = await snapshotPaper(exists.id);
    oldPaperId = exists.id;
    if (snap.length) console.log(`  检出作答：${snap.length} 份组提交 / ${snap.reduce((n, x) => n + x.subs.length, 0)} 条小题提交，重建后回填`);
    await deletePaper(exists.id, paper.title);
  }
  const tags = Array.from(new Set([...(paper.tags || []), subject]));
  const testPaper = await prisma.testPaper.create({
    data: {
      title: paper.title,
      description: `${paper.source}（${subject}）`,
      subject, source: paper.source, grade: paper.grade, year: paper.year ?? null,
      totalScore: paper.questions.reduce((n, q) => n + (q.score || 0), 0) || null,
      duration: 90, tags,
    },
  });
  const groups = buildGroups(paper);
  let order = 0;
  for (const g of groups) {
    if (!g.qs.length) continue;
    const group = await prisma.questionGroup.create({
      data: {
        title: `${paper.title}·${g.title ?? g.category}`, content: "", questionType: g.type,
        score: g.qs.reduce((n, q) => n + (q.score || 0), 0),
        subject, source: paper.source, grade: paper.grade, category: g.category,
        tags: Array.from(new Set([...tags, g.category])),
      },
    });
    await prisma.paperItem.create({ data: { paperId: testPaper.id, itemId: group.id, itemType: "questionGroup", orderIndex: order++ } });
    let gi = 0;
    for (const q of g.qs) {
      const created = await prisma.question.create({
        data: {
          questionType: q.type,
          content: q.content || `![](${q.image})`,
          options: q.options && q.options.length ? (q.options as unknown as object) : undefined,
          answer: q.answer || "", analysis: q.analysis || "",
          score: q.score ?? (q.type === "single" ? 3 : 0),
          subject, source: paper.source, grade: paper.grade, category: g.category,
          year: paper.year ?? null, tags: [...tags, g.category],
        },
      });
      await prisma.groupItem.create({ data: { groupId: group.id, questionId: created.id, orderIndex: gi++ } });
    }
  }
  if (oldPaperId && snap.length) {
    try {
      await restoreSubmissions(testPaper.id, paper.title, snap);
    } catch (e) {
      console.error(`  ✗ 作答回填失败（旧数据已删，请从备份恢复）：${String((e as Error)?.message ?? e).slice(0, 200)}`);
    }
  }
  console.log(`✓ ${paper.title}：${paper.questions.length} 题（` +
    groups.map((g) => `${g.category} ${g.qs.length}`).join("，") + `）`);
}

async function main() {
  const all = arg("all");
  if (all) {
    const dirs = fs.readdirSync(all).filter((d) => fs.existsSync(path.join(all, d, "paper.json")));
    console.log(`批量导入 ${dirs.length} 份：${all}`);
    for (const d of dirs) {
      try {
        await importOne(path.join(all, d), has("force"));
      } catch (e) {
        console.error(`✗ ${d}:`, String(e).slice(0, 160));
      }
    }
    await prisma.$disconnect();
    return;
  }
  const dir = arg("dir");
  if (!dir) throw new Error("--dir 或 --all 必填");
  try {
    await importOne(dir, has("force"));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
