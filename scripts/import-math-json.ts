/**
 * 把 exam-parser 生成的选择题 JSON（数学 / 物理 / 化学）导入题库
 *
 * 数据来源：~/jingshibang/output_json_math/<类型>/<学科>/<试卷>.json
 * 图片：复制到 ~/jingshibang/output_docx_to_md/<类型>/<学科>/<试卷>/images/
 *       并把 ![](images/x.png) 改写成 /exam-images/<类型>/<学科>/<试卷>/images/x.png
 *       源图依次在这些目录里找：JSON 同级 images/ → output_json_math/images/ →
 *       output_docx_to_md/<类型>/<学科>/<试卷>/images/（物理等由 docx 直接导出的图片只在这里）
 *
 * 用法：
 *   npx tsx scripts/import-math-json.ts --type 二模                     # 导入全部（数学）
 *   npx tsx scripts/import-math-json.ts --type 二模 --subject 物理       # 导入物理
 *   npx tsx scripts/import-math-json.ts --type 二模 --limit 3           # 只导 3 份（试水）
 *   npx tsx scripts/import-math-json.ts --file xxx.json                 # 导单个
 *   npx tsx scripts/import-math-json.ts --type 二模 --dry-run           # 只看不写
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const JSON_ROOT = "/home/gxwtf/jingshibang/output_json_math";
const MD_ROOT = "/home/gxwtf/jingshibang/output_docx_to_md";

function arg(name: string, def?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
}
const hasFlag = (n: string) => process.argv.includes(`--${n}`);

interface MathOption { id: string; label: string }
interface MathQuestion {
  id: number; questionType: string; content: string;
  options: MathOption[]; answer: string; analysis?: string; score: number;
}
interface MathSection {
  type: string; questionType: string; title: string; category: string;
  score: number; questions: MathQuestion[];
}
interface MathPaper {
  paper: { title: string; subject: string; source: string; grade?: string; year?: number; totalScore?: number; duration?: number; tags: string[] };
  sections: MathSection[];
}

/** 复制图片并改写引用路径 */
function materializeImages(paper: MathPaper, stem: string, typeDir: string, imgSrcDirs: string[], subject: string): Map<string, string> {
  const mapping = new Map<string, string>();
  const missing: string[] = [];
  const imgDstDir = path.join(MD_ROOT, typeDir, subject, stem, "images");
  const refs = new Set<string>();
  for (const s of paper.sections) {
    for (const q of s.questions) {
      for (const m of (q.content || "").matchAll(/!\[\]\((images\/[^)]+)\)/g)) refs.add(m[1]);
      for (const o of q.options || []) {
        for (const m of (String(o.label) || "").matchAll(/!\[\]\((images\/[^)]+)\)/g)) refs.add(m[1]);
      }
    }
  }
  for (const ref of refs) {
    const file = path.basename(ref);
    const src = imgSrcDirs.map((d) => path.join(d, file)).find((p) => fs.existsSync(p));
    if (!src) { missing.push(file); continue; }
    const dst = path.join(imgDstDir, file);
    if (path.resolve(src) !== path.resolve(dst)) {
      fs.mkdirSync(imgDstDir, { recursive: true });
      fs.copyFileSync(src, dst);
    }
    mapping.set(ref, `/exam-images/${typeDir}/${subject}/${stem}/images/${file}`);
  }
  if (missing.length) console.log(`  ⚠ ${stem}: ${missing.length} 张图片找不到（${missing.slice(0,2).join(", ")}）`);
  return mapping;
}

function rewrite(text: string, mapping: Map<string, string>): string {
  let out = text || "";
  for (const [from, to] of mapping) out = out.split(from).join(to);
  return out;
}

/** 重导护栏：卷子上已有作答时，--force 会把作答一起删掉，必须显式加 --drop-submissions 才允许 */
async function assertNoSubmissions(paperId: string, title: string) {
  const items = await prisma.paperItem.findMany({ where: { paperId }, select: { itemId: true } });
  const gids = items.map((i) => i.itemId);
  const [ts, gs] = await Promise.all([
    prisma.testPaperSubmission.count({ where: { testPaperId: paperId } }),
    gids.length ? prisma.questionGroupSubmission.count({ where: { questionGroupId: { in: gids } } }) : Promise.resolve(0),
  ]);
  if (ts + gs > 0 && !process.argv.includes("--drop-submissions")) {
    throw new Error(
      `${title}：已有 ${ts} 份试卷作答 / ${gs} 份题组作答，--force 会连作答一起删掉；确认要删请加 --drop-submissions`,
    );
  }
}

async function deletePaper(paperId: string, title: string) {
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
  console.log(`  已删除旧数据以便重导：${title}`);
}

async function importPaper(file: string, typeDir: string, dryRun: boolean, force: boolean, subject: string) {
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as MathPaper;
  const stem = path.basename(file, ".json");
  const title = raw.paper.title || stem;

  const exists = await prisma.testPaper.findFirst({ where: { title, subject }, select: { id: true } });
  if (exists) {
    if (!force) { console.log(`跳过（已存在）：${title}`); return { skipped: true, questions: 0 }; }
    await assertNoSubmissions(exists.id, title);
    await deletePaper(exists.id, title);
  }

  const imgSrcDirs = [
    path.join(path.dirname(file), "images"),
    path.join(JSON_ROOT, "images"),
    path.join(MD_ROOT, typeDir, subject, stem, "images"),
  ];
  const mapping = dryRun ? new Map<string, string>() : materializeImages(raw, stem, typeDir, imgSrcDirs, subject);
  const tags = Array.from(new Set([...(raw.paper.tags || []), subject]));
  const sectionCount = raw.sections.length;
  const totalQ = raw.sections.reduce((n, s) => n + s.questions.length, 0);

  if (dryRun) {
    console.log(`[dry-run] ${title}: ${sectionCount} 节 / ${totalQ} 题 / 图片 ${mapping.size}`);
    return { skipped: false, questions: totalQ };
  }

  await prisma.$transaction(async (tx) => {
    const paper = await tx.testPaper.create({
      data: {
        title,
        description: `${raw.paper.source}（${subject} · ${raw.sections.map((s) => s.category).join("+")}）`,
        subject,
        source: raw.paper.source || title,
        grade: raw.paper.grade || "高三",
        year: raw.paper.year ?? null,
        totalScore: raw.paper.totalScore ?? null,
        duration: raw.paper.duration ?? null,
        tags,
      },
    });

    let order = 0;
    for (const section of raw.sections) {
      const group = await tx.questionGroup.create({
        data: {
          title: `${title}·${section.category}`,
          content: "",
          questionType: section.questionType,
          score: Math.round(section.questions.reduce((n, q) => n + (q.score || 0), 0)),
          subject,
          source: raw.paper.source || title,
          grade: raw.paper.grade || "高三",
          category: section.category,
          tags,
        },
      });
      await tx.paperItem.create({ data: { paperId: paper.id, itemId: group.id, itemType: "questionGroup", orderIndex: order++ } });

      let gi = 0;
      for (const q of section.questions) {
        const created = await tx.question.create({
          data: {
            questionType: q.questionType,
            content: rewrite(q.content, mapping),
            options: section.type === "选择题"
              ? (q.options || []).map((o) => ({ id: o.id, label: rewrite(String(o.label || ""), mapping) }))
              : undefined,
            answer: q.answer || "",
            analysis: q.analysis || "",
            score: q.score ?? 5,
            subject,
            source: raw.paper.source || title,
            grade: raw.paper.grade || "高三",
            category: section.category,
            year: raw.paper.year ?? null,
            tags,
          },
        });
        await tx.groupItem.create({ data: { groupId: group.id, questionId: created.id, orderIndex: gi++ } });
      }
    }
  });

  console.log(`✓ ${title}：${sectionCount} 节 / ${totalQ} 题 / 图片 ${mapping.size}`);
  return { skipped: false, questions: totalQ };
}

async function main() {
  const typeDir = arg("type", "二模")!;
  const subject = arg("subject", "数学")!;
  const file = arg("file");
  const limit = Number(arg("limit", "0"));
  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");

  let files: string[];
  if (file) files = [path.resolve(file)];
  else {
    const dir = path.join(JSON_ROOT, typeDir, subject);
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f)).sort();
  }
  if (limit > 0) files = files.slice(0, limit);

  console.log(`待导入 ${files.length} 份（类型=${typeDir}${dryRun ? "，dry-run" : ""}）`);
  let papers = 0, questions = 0, skipped = 0;
  for (const f of files) {
    try {
      const r = await importPaper(f, typeDir, dryRun, force, subject);
      if (r.skipped) skipped++; else papers++;
      questions += r.questions;
    } catch (e) {
      console.error(`✗ ${path.basename(f)}: ${String((e as Error)?.message || e).slice(0, 200)}`);
    }
  }
  console.log(`\n完成：新增 ${papers} 份试卷、${questions} 道题，跳过 ${skipped} 份`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
