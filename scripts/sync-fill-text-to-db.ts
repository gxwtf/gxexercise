/**
 * 把 JSON 里的「非选择题题组」原地同步到生产库（题组 content / 小题 questionType）
 *
 * 用途：解析口径变更时**不重导、不换 id**，只把 JSON 的最新内容写回库里，因而不影响作答记录。
 * 目前用于 2026-11 的口径调整（历史 / 地理 / 政治）：
 *   三科大题答题框换成英语「阅读表达」那款 → 占位符统一成 `<AnswerBox></AnswerBox>`；
 *   版式仍是单栏（材料与设问内联在题组 content 里），小问仍是 questionType=input。
 * 若 JSON 与库里的题组数 / 小题数对不上，直接报错跳过该卷（绝不猜）。
 *
 * 用法：
 *   npx tsx scripts/sync-fill-text-to-db.ts --subject 历史 --type 一模 --dry-run
 *   npx tsx scripts/sync-fill-text-to-db.ts --subject 地理 --type 一模 --apply --backup ~/backups/answerbox-一模.json
 *   npx tsx scripts/sync-fill-text-to-db.ts --subject 政治 --file <json> --apply --backup <file>
 *   npx tsx scripts/sync-fill-text-to-db.ts --rollback ~/backups/answerbox-一模.json
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DATA_ROOT = "/home/gxwtf/jingshibang";
const JSON_ROOT: Record<string, string> = {
  历史: path.join(DATA_ROOT, "output_json_history"),
  地理: path.join(DATA_ROOT, "output_json_geography"),
  政治: path.join(DATA_ROOT, "output_json_politics"),
};

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const has = (n: string) => process.argv.includes(`--${n}`);

interface Q { id?: number | string; questionType?: string; content?: string; answer?: string; score?: number }
interface Section { questionType?: string; title?: string; category?: string; score?: number; content?: string; questions: Q[] }
interface PaperJson { paper: { title: string; subject?: string }; sections?: Section[]; groups?: Section[] }

interface BackupGroup { gid: string; title: string; content: string; questions: { qid: string; questionType: string }[] }
interface Backup { paperId: string; subject: string; title: string; groups: BackupGroup[] }

async function syncOne(file: string, subject: string, apply: boolean, backups: Backup[]) {
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as PaperJson;
  const sections = (raw.sections || raw.groups || []).filter((s) => (s.questionType || "").endsWith("-fill"));
  const title = raw.paper.title || path.basename(file, ".json");
  const paper = await prisma.testPaper.findFirst({ where: { title, subject }, select: { id: true } });
  if (!paper) { console.log(`  ✗ 库里没有套卷：${subject} / ${title}`); return 0; }
  const items = await prisma.paperItem.findMany({ where: { paperId: paper.id }, orderBy: { orderIndex: "asc" }, select: { itemId: true } });
  const groups = await prisma.questionGroup.findMany({
    where: { id: { in: items.map((i) => i.itemId) } },
    include: { groupItems: { orderBy: { orderIndex: "asc" }, include: { question: true } } },
  });
  const byId = new Map(groups.map((g) => [g.id, g]));
  const ordered = items.map((i) => byId.get(i.itemId)!);

  const jsonAllSections = raw.sections || raw.groups || [];
  if (ordered.length !== jsonAllSections.length) {
    throw new Error(`${title}：库里 ${ordered.length} 个题组 ≠ JSON ${jsonAllSections.length} 个 section`);
  }

  const backup: Backup = { paperId: paper.id, subject, title, groups: [] };
  let changedGroups = 0, changedQs = 0;
  for (let i = 0; i < ordered.length; i++) {
    const g = ordered[i];
    const sec = jsonAllSections[i];
    const isFill = (sec.questionType || "").endsWith("-fill");
    if (!isFill) continue;                              // 选择题题组不动
    if ((sec.content || "").includes("<Input")) {
      console.log(`  ⚠ 「${g.title}」JSON 里还留着占位符，跳过（先重跑转换脚本）`);
      continue;
    }
    backup.groups.push({
      gid: g.id,
      title: g.title,
      content: g.content,
      questions: g.groupItems.map((gi) => ({ qid: gi.question.id, questionType: gi.question.questionType })),
    });
    const qs = sec.questions || [];
    if (g.groupItems.length !== qs.length) {
      throw new Error(`「${g.title}」库里 ${g.groupItems.length} 道题 ≠ JSON ${qs.length} 道`);
    }
    const contentChanged = g.content !== (sec.content || "");
    if (contentChanged) changedGroups += 1;
    for (let j = 0; j < qs.length; j += 1) {
      const oldType = g.groupItems[j].question.questionType;
      const newType = qs[j].questionType || "text";
      if (oldType !== newType) changedQs += 1;
      if (apply) {
        await prisma.question.update({ where: { id: g.groupItems[j].question.id }, data: { questionType: newType } });
      }
    }
    if (apply && contentChanged) {
      await prisma.questionGroup.update({ where: { id: g.id }, data: { content: sec.content || "" } });
    }
  }
  backups.push(backup);
  console.log(`  ${apply ? "✓" : "[dry-run]"} ${title}：${backup.groups.length} 个大题题组，content 变更 ${changedGroups} 个，题目类型变更 ${changedQs} 个`);
  return changedGroups + changedQs;
}

async function rollback(file: string) {
  const backups = JSON.parse(fs.readFileSync(file, "utf-8")) as Backup[];
  console.log(`回退 ${backups.length} 份卷…`);
  for (const b of backups) {
    for (const g of b.groups) {
      await prisma.questionGroup.update({ where: { id: g.gid }, data: { content: g.content } });
      for (const q of g.questions) {
        await prisma.question.update({ where: { id: q.qid }, data: { questionType: q.questionType } });
      }
    }
    console.log(`   ↺ 已还原 ${b.subject} / ${b.title}`);
  }
}

async function main() {
  const rollbackFile = arg("rollback");
  if (rollbackFile) { await rollback(rollbackFile); await prisma.$disconnect(); return; }

  const subject = arg("subject");
  const type = arg("type", "一模")!;
  const file = arg("file");
  const apply = has("apply");
  const backupFile = arg("backup");
  if (!subject || !JSON_ROOT[subject]) throw new Error(`--subject 只能是 ${Object.keys(JSON_ROOT).join(" / ")}`);

  let files: string[];
  if (file) files = [path.resolve(file)];
  else {
    const dir = path.join(JSON_ROOT[subject], type);
    files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f)).sort() : [];
  }
  if (!files.length) { console.log("没有待处理的 JSON"); await prisma.$disconnect(); return; }

  const backups: Backup[] = [];
  let total = 0;
  console.log(`[${subject}] ${files.length} 份${apply ? "（写库）" : "（dry-run）"}`);
  for (const f of files) {
    try { total += await syncOne(f, subject, apply, backups); }
    catch (e) { console.error(`✗ ${path.basename(f)}: ${(e as Error).message}`); }
  }
  if (apply && backupFile) {
    fs.mkdirSync(path.dirname(path.resolve(backupFile)), { recursive: true });
    const prev = fs.existsSync(backupFile) ? (JSON.parse(fs.readFileSync(backupFile, "utf-8")) as Backup[]) : [];
    fs.writeFileSync(backupFile, JSON.stringify([...prev, ...backups], null, 2), "utf-8");
    console.log(`备份写到 ${backupFile}`);
  }
  console.log(`\n完成：需要变更 ${total} 处${apply ? "（已应用）" : "（dry-run，加 --apply 才写）"}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
