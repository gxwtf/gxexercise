/**
 * 把生物 JSON（output_json_bio/<类型>/<卷>.json）导入题库
 *
 * JSON 结构（见 exam-parser/convert_biology_md.py）：
 * { paper: {...}, sections: [
 *     { type, questionType, title, category, score, content?, questions: [{id, questionType, content, options?, answer, analysis?, score}] }
 * ] }
 *
 * - 选择题 section：questions 带 options，题型 single/multiple，提交时按答案精确判分
 * - 非选择题 section（questionType=biology-fill）：content 是大题材料 + 内联 <Input></Input> / <InputLong></InputLong>，
 *   questions 是这道大题的「空」（questionType=input，content 为空，answer 是参考答案），一律走 AI 判分
 *
 * 图片：JSON 里已是 /exam-images/<类型>/生物/<卷>/images/xxx.png 绝对地址，
 *       对应文件由解析器放在 ~/jingshibang/output_docx_to_md/<类型>/生物/<卷>/images/，这里只校验不改写。
 *
 * 用法：
 *   npx tsx scripts/import-biology-json.ts --type 二模 --dry-run
 *   npx tsx scripts/import-biology-json.ts --type 二模
 *   npx tsx scripts/import-biology-json.ts --file ~/jingshibang/output_json_bio/二模/2026北京海淀高三二模生物.json --force
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const JSON_ROOT = "/home/gxwtf/jingshibang/output_json_bio";
const MD_ROOT = "/home/gxwtf/jingshibang/output_docx_to_md";
const SUBJECT = "生物";

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const has = (n: string) => process.argv.includes(`--${n}`);

interface Opt { id: string; label: string }
interface Q {
  id: number | string;
  questionType: string;
  content?: string;
  options?: Opt[];
  answer?: string;
  analysis?: string;
  score?: number;
}
interface Section {
  type?: string;
  questionType: string;
  title?: string;
  category?: string;
  score?: number;
  content?: string;
  questions: Q[];
}
interface BioPaper {
  paper: {
    title: string; subject?: string; source?: string; grade?: string;
    year?: number | null; totalScore?: number | null; duration?: number | null; tags?: string[];
  };
  sections?: Section[];
  groups?: Section[];
}

const IMG_RE = /\/exam-images\/([^)\s]+?\.(?:png|jpg|jpeg|gif|webp))/g;

/** 校验图片引用：文件必须存在于 output_docx_to_md 下（nginx 的 alias 指到那里） */
function checkImages(text: string): string[] {
  const missing: string[] = [];
  for (const m of text.matchAll(IMG_RE)) {
    const rel = m[1];
    const abs = path.join(MD_ROOT, decodeURIComponent(rel));
    if (!fs.existsSync(abs)) missing.push(rel);
  }
  return missing;
}

/** 题组标题：优先用 section.title 里的「第N题」，否则用分类名，重名再加序号 */
function groupLabel(sec: Section, seen: Map<string, number>): string {
  const t = (sec.title || "").trim();
  const m = t.match(/第\s*(\d+)\s*题/);
  let label = m ? `第${m[1]}题` : (sec.category || t || sec.questionType);
  const n = (seen.get(label) || 0) + 1;
  seen.set(label, n);
  if (n > 1) label = `${label}（${n}）`;
  return label;
}

async function deletePaper(paperId: string) {
  const items = await prisma.paperItem.findMany({ where: { paperId }, select: { itemId: true } });
  const groupIds = items.map((i) => i.itemId);
  if (groupIds.length) {
    const gis = await prisma.groupItem.findMany({ where: { groupId: { in: groupIds } }, select: { questionId: true } });
    const qids = Array.from(new Set(gis.map((g) => g.questionId)));
    await prisma.questionGroupSubmission.deleteMany({ where: { questionGroupId: { in: groupIds } } });
    await prisma.groupItem.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.paperItem.deleteMany({ where: { paperId } });
    await prisma.testPaperSubmission.deleteMany({ where: { testPaperId: paperId } });
    await prisma.questionGroup.deleteMany({ where: { id: { in: groupIds } } });
    if (qids.length) {
      await prisma.questionSubmission.deleteMany({ where: { questionId: { in: qids } } });
      await prisma.question.deleteMany({ where: { id: { in: qids } } });
    }
  } else {
    await prisma.paperItem.deleteMany({ where: { paperId } });
  }
  await prisma.testPaper.delete({ where: { id: paperId } });
}

async function importOne(file: string, dryRun: boolean, force: boolean) {
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as BioPaper;
  const sections = raw.sections || raw.groups || [];
  const title = raw.paper.title || path.basename(file, ".json");
  const stem = path.basename(file, ".json");
  const p = raw.paper;

  if (!sections.length) throw new Error("JSON 里没有 sections/groups");

  // 结构自检
  const problems: string[] = [];
  const seen = new Map<string, number>();
  for (const sec of sections) {
    const isFill = sec.questionType === "biology-fill";
    array(sec.questions, `section「${sec.title || sec.category}」`);
    if (isFill) {
      const blanks = (sec.content || "").match(/<Input(Long)?\s*>/g) || [];
      if (blanks.length !== sec.questions.length) {
        problems.push(`「${sec.title || sec.category}」内联空 ${blanks.length} 个 ≠ 题目 ${sec.questions.length} 道`);
      }
      const emptyAns = sec.questions.filter((q) => !String(q.answer || "").trim()).length;
      if (emptyAns) problems.push(`「${sec.title || sec.category}」有 ${emptyAns} 个空没有参考答案`);
    }
    const sum = sec.questions.reduce((n, q) => n + (q.score || 0), 0);
    if (sec.score && Math.abs(sum - sec.score) > 0.01) {
      problems.push(`「${sec.title || sec.category}」分值不符：空 ${sum} vs 大题 ${sec.score}`);
    }
    const text = [sec.content || "", ...sec.questions.flatMap((q) => [q.content || "", q.answer || "", ...(q.options || []).map((o) => o.label)])].join("\n");
    const miss = checkImages(text);
    if (miss.length) problems.push(`缺图 ${miss.length} 张：${miss.slice(0, 3).join(", ")}`);
  }
  if (problems.length) {
    console.log(`  ⚠ ${title} 自检：`);
    for (const x of problems) console.log(`     - ${x}`);
  }

  const nQ = sections.reduce((n, s) => n + s.questions.length, 0);
  if (dryRun) {
    console.log(`[dry-run] ${title}：${sections.length} 组 / ${nQ} 题（${sections.map((s) => groupLabel(s, seen)).join("、")}）`);
    return { papers: 0, groups: 0, questions: 0 };
  }

  const exists = await prisma.testPaper.findFirst({ where: { title, subject: SUBJECT }, select: { id: true } });
  if (exists) {
    if (!force) { console.log(`跳过（已存在，加 --force 覆盖）：${title}`); return { papers: 0, groups: 0, questions: 0 }; }
    await deletePaper(exists.id);
  }

  const tags0 = Array.from(new Set([...(p.tags || []), SUBJECT]));
  await prisma.$transaction(async (tx) => {
    const paper = await tx.testPaper.create({
      data: {
        title,
        description: p.source ? `${p.source}（生物 · 选择+大题）` : "",
        subject: SUBJECT,
        source: p.source || title,
        grade: p.grade || "高三",
        year: p.year ?? null,
        totalScore: p.totalScore ?? null,
        duration: p.duration ?? null,
        tags: tags0,
      },
    });
    let order = 0;
    for (const sec of sections) {
      const isFill = sec.questionType === "biology-fill";
      const category = sec.category || (isFill ? "实验探究" : "选择");
      const group = await tx.questionGroup.create({
        data: {
          title: `${title}·${groupLabel(sec, seen)}`,
          content: sec.content || "",
          questionType: sec.questionType,
          score: Math.round(sec.questions.reduce((n, q) => n + (q.score || 0), 0)) || (sec.score || 0),
          subject: SUBJECT,
          source: p.source || title,
          grade: p.grade || "高三",
          category,
          tags: Array.from(new Set([...tags0, category])),
        },
      });
      await tx.paperItem.create({ data: { paperId: paper.id, itemId: group.id, itemType: "questionGroup", orderIndex: order++ } });
      let gi = 0;
      for (const q of sec.questions) {
        const created = await tx.question.create({
          data: {
            questionType: q.questionType,
            content: q.content || "",
            options: q.options && q.options.length ? (q.options as unknown as object) : undefined,
            answer: q.answer || "",
            analysis: q.analysis || "",
            score: q.score ?? 0,
            subject: SUBJECT,
            source: p.source || title,
            grade: p.grade || "高三",
            category,
            year: p.year ?? null,
            tags: Array.from(new Set([...tags0, category])),
          },
        });
        await tx.groupItem.create({ data: { groupId: group.id, questionId: created.id, orderIndex: gi++ } });
      }
    }
  });
  console.log(`✓ ${title}：${sections.length} 组 / ${nQ} 题`);
  return { papers: 1, groups: sections.length, questions: nQ };
}

function array<T>(v: T[] | undefined, where: string) {
  if (!Array.isArray(v) || v.length === 0) throw new Error(`${where} 的 questions 为空`);
}

async function main() {
  const type = arg("type", "二模")!;
  const file = arg("file");
  const dryRun = has("dry-run");
  const force = has("force");

  let files: string[];
  if (file) files = [path.resolve(file)];
  else {
    const dir = path.join(JSON_ROOT, type);
    files = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f)).sort()
      : [];
  }
  if (!files.length) {
    console.log(`没有待导入的 JSON（${JSON_ROOT}/${type}）`);
    return;
  }
  console.log(`待导入 ${files.length} 份（${dryRun ? "dry-run" : "写库"}）`);
  let tp = 0, tg = 0, tq = 0;
  for (const f of files) {
    try {
      const r = await importOne(f, dryRun, force);
      tp += r.papers; tg += r.groups; tq += r.questions;
    } catch (e) {
      console.error(`✗ ${path.basename(f)}: ${String((e as Error)?.message || e).slice(0, 300)}`);
    }
  }
  console.log(`\n完成：试卷 ${tp} 份 / 题组 ${tg} 个 / 题目 ${tq} 道`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
