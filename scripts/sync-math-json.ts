/**
 * 把 output_json_math 下的 JSON 原地同步到数据库（不改 ID、不删练习记录）
 * 用法：npx tsx scripts/sync-math-json.ts --type 二模 [--dry-run]
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

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const dryRun = process.argv.includes("--dry-run");

interface Opt { id: string; label: string }
interface Q { id: number; questionType: string; content: string; options: Opt[]; answer: string; score: number }
interface Sec { type: string; questionType: string; title: string; category: string; questions: Q[] }
interface Paper { paper: { title: string }; sections: Sec[] }

/** 把 JSON 里的相对图片路径改写成 nginx 可服务的 /exam-images/... 路径 */
function rewriteImages(text: string, typeDir: string, stem: string): string {
  return (text || "").replace(/!\[\]\((images\/[^)]+)\)/g, (_m, p) =>
    `![](${`/exam-images/${typeDir}/数学/${stem}/images/${path.basename(p)}`})`);
}

async function main() {
  const type = arg("type", "二模")!;
  const dir = path.join(JSON_ROOT, type, "数学");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  let papers = 0, groups = 0, questions = 0;
  const missing: string[] = [];

  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as Paper;
    const title = data.paper.title || path.basename(f, ".json");
    const paper = await prisma.testPaper.findFirst({
      where: { title, subject: "数学" },
      include: { paperItems: { orderBy: { orderIndex: "asc" } } },
    });
    if (!paper) { missing.push(title); continue; }
    papers++;

    for (let i = 0; i < data.sections.length; i++) {
      const sec = data.sections[i];
      const item = paper.paperItems[i];
      if (!item) continue;
      const group = await prisma.questionGroup.findUnique({
        where: { id: item.itemId },
        include: { groupItems: { orderBy: { orderIndex: "asc" } } },
      });
      if (!group) continue;
      const newTitle = `${title}·${sec.category}`;
      const newScore = Math.round(sec.questions.reduce((n, q) => n + (q.score || 0), 0));
      if (!dryRun) {
        await prisma.questionGroup.update({ where: { id: group.id }, data: { title: newTitle, score: newScore } });
      }
      groups++;

      const stem = path.basename(f, ".json");
      for (let j = 0; j < sec.questions.length; j++) {
        const q = sec.questions[j];
        const gi = group.groupItems[j];
        if (!gi) continue;
        const options = sec.type === "选择题"
          ? (q.options || []).map((o) => ({ id: o.id, label: rewriteImages(o.label, type, stem) }))
          : undefined;
        if (!dryRun) {
          await prisma.question.update({
            where: { id: gi.questionId },
            data: {
              content: rewriteImages(q.content, type, stem),
              options,
              answer: q.answer ?? "",
              score: q.score ?? 5,
            },
          });
        }
        questions++;
      }
    }
  }
  console.log(`${dryRun ? "[dry-run] " : ""}同步 ${papers} 份试卷 / ${groups} 个题组 / ${questions} 道题`);
  if (missing.length) console.log(`⚠ 库中缺少 ${missing.length} 份试卷：${missing.slice(0, 3).join("、")}…`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
