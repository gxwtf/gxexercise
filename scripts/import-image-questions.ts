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
  type: "single" | "text";
  image: string;
  options?: { id: string; label: string }[];
  answer?: string;
  score?: number | null;
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

async function main() {
  const dir = arg("dir");
  if (!dir) throw new Error("--dir 必填");
  const paper = JSON.parse(fs.readFileSync(path.join(dir, "paper.json"), "utf-8")) as Paper;
  const force = has("force");
  const subject = paper.subject || "化学";

  const exists = await prisma.testPaper.findFirst({ where: { title: paper.title, subject }, select: { id: true } });
  if (exists) {
    if (!force) {
      console.log(`跳过（已存在）：${paper.title}`);
      await prisma.$disconnect();
      return;
    }
    await deletePaper(exists.id, paper.title);
  }

  const tags = Array.from(new Set([...(paper.tags || []), subject]));
  const testPaper = await prisma.testPaper.create({
    data: {
      title: paper.title,
      description: `${paper.source}（${subject} · 图片版）`,
      subject,
      source: paper.source,
      grade: paper.grade,
      year: paper.year ?? null,
      totalScore: paper.questions.reduce((n, q) => n + (q.score || 0), 0) || null,
      duration: 90,
      tags,
    },
  });

  const groups: { category: string; type: string; qs: Q[] }[] = [
    { category: "选择", type: "chemistry-image", qs: paper.questions.filter((q) => q.type === "single") },
    { category: "非选择", type: "chemistry-image", qs: paper.questions.filter((q) => q.type === "text") },
  ];

  let order = 0;
  for (const g of groups) {
    if (!g.qs.length) continue;
    const group = await prisma.questionGroup.create({
      data: {
        title: `${paper.title}·${g.category}`,
        content: "",
        questionType: g.type,
        score: g.qs.reduce((n, q) => n + (q.score || 0), 0),
        subject,
        source: paper.source,
        grade: paper.grade,
        category: g.category,
        tags: [...tags, g.category],
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
          answer: q.answer || "",
          analysis: "",
          score: q.score ?? (q.type === "single" ? 3 : 0),
          subject,
          source: paper.source,
          grade: paper.grade,
          category: g.category,
          year: paper.year ?? null,
          tags: [...tags, g.category],
        },
      });
      await prisma.groupItem.create({ data: { groupId: group.id, questionId: created.id, orderIndex: gi++ } });
    }
  }
  console.log(`✓ ${paper.title}：${paper.questions.length} 题（选择 ${groups[0].qs.length}，非选择 ${groups[1].qs.length}）`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
