/**
 * 把语文 JSON（output_json_chinese/<类型>/<卷>.json）导入题库
 *
 * 数据结构：{paper:{...}, sections:[{category, questionType, title, content, score, questions:[...]}]}
 * 兼容旧格式 {paper, groups}（2025 及以前的语文 JSON）；sections 优先。
 * - 每个 group 建一个 QuestionGroup（category 决定它出现在哪个题型页）
 * - 同时建一张 TestPaper（套卷），把各题组按顺序挂进去，可整套练习
 *
 * 用法：
 *   npx tsx scripts/import-chinese-json.ts --file ~/jingshibang/output_json_chinese/二模/2025北京西城高三二模语文.json --dry-run
 *   npx tsx scripts/import-chinese-json.ts --file ...            # 导入
 *   npx tsx scripts/import-chinese-json.ts --file ... --force    # 覆盖（先删旧数据）
 *   npx tsx scripts/import-chinese-json.ts --type 二模            # 导入目录下全部
 *   npx tsx scripts/import-chinese-json.ts --type 二模 --force --manifest /tmp/manifest.json
 *   npx tsx scripts/import-chinese-json.ts --rollback /tmp/manifest.json   # 按清单回退（新建的删掉、覆盖的用 .old-groups.json 还原）
 *   npx tsx scripts/import-chinese-json.ts --delete "2026北京西城高三一模语文"
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const JSON_ROOT = "/home/gxwtf/jingshibang/output_json_chinese";

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const has = (n: string) => process.argv.includes(`--${n}`);

interface Opt { id: string; label: string }
interface Q {
  id: number | string; questionType: string; content: string;
  options?: Opt[]; answer?: string; analysis?: string; score?: number;
}
interface Group {
  category: string; questionType: string; title: string; intro?: string;
  content: string; score?: number; questions: Q[];
}
interface Paper {
  paper: { title: string; subject: string; source?: string; grade?: string; year?: number | null; totalScore?: number | null; duration?: number | null; tags?: string[] };
  sections?: Group[];
  groups?: Group[];
}

/** 导入清单：记录每卷「导入前是否存在 / 原 paperId / 旧格式备份路径」，供 --rollback 使用 */
interface ManifestRow {
  title: string;
  subject: string;
  jsonFile: string;
  existed: boolean;
  oldPaperId: string | null;
  oldBackup: string | null;
}

function readManifest(file: string): ManifestRow[] {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8")) as ManifestRow[];
}

function writeManifest(file: string, rows: ManifestRow[]) {
  fs.writeFileSync(file, JSON.stringify(rows, null, 2), "utf-8");
}

/** 目录模式要跳过旧格式备份与临时文件 */
function isImportableJson(file: string): boolean {
  const base = path.basename(file);
  return base.endsWith(".json") && !base.includes(".old-groups.") && !base.startsWith(".");
}

async function deletePaperById(paperId: string, title: string) {
  const items = await prisma.paperItem.findMany({ where: { paperId }, select: { itemId: true } });
  for (const it of items) {
    await prisma.questionGroup.delete({ where: { id: it.itemId } });
  }
  await prisma.paperItem.deleteMany({ where: { paperId } });
  await prisma.testPaper.delete({ where: { id: paperId } });
  console.log(`  ✗ 已删除：${title}`);
}


/* ───────────────────────── 重导时保留作答（快照 → 重建 → 按内容映射写回） ───────────────────────── */

/** 题组标题里「试卷名·X」的 X 部分，用来和旧库的题组对上 */
function labelOf(title: string): string {
  const i = title.indexOf("·");
  return i >= 0 ? title.slice(i + 1) : title;
}

/** 内容指纹：去掉图片引用与所有空白，用来把旧题和新题对上（重导后 id 会变） */
function normText(t: string): string {
  return (t || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\s+/g, "");
}

interface OldGroup {
  gid: string;
  label: string;
  category: string;
  hasSubs: boolean;
  qs: { qid: string; norm: string; orderIndex: number }[];
}

interface Snapshot {
  groups: OldGroup[];
  gsubs: any[];
  qsubs: any[];
  tsubs: any[];
}

async function snapshotPaper(paperId: string): Promise<Snapshot> {
  const items = await prisma.paperItem.findMany({ where: { paperId }, orderBy: { orderIndex: "asc" }, select: { itemId: true } });
  const groupIds = items.map((i) => i.itemId);
  const groups = await prisma.questionGroup.findMany({
    where: { id: { in: groupIds } },
    include: {
      groupItems: { orderBy: { orderIndex: "asc" }, include: { question: { select: { id: true, content: true } } } },
    },
  });
  const gsubs = await prisma.questionGroupSubmission.findMany({ where: { questionGroupId: { in: groupIds } } });
  const qsubs = gsubs.length
    ? await prisma.questionSubmission.findMany({ where: { groupSubmissionId: { in: gsubs.map((g) => g.id) } } })
    : [];
  const tsubs = await prisma.testPaperSubmission.findMany({ where: { testPaperId: paperId } });
  const withSubs = new Set(gsubs.map((g) => g.questionGroupId));
  return {
    groups: groupIds.map((gid) => {
      const g = groups.find((x) => x.id === gid);
      if (!g) return null;
      return {
        gid: g.id,
        label: labelOf(g.title),
        category: g.category,
        hasSubs: withSubs.has(g.id),
        qs: g.groupItems.map((gi) => ({ qid: gi.question.id, norm: normText(gi.question.content || ""), orderIndex: gi.orderIndex })),
      };
    }).filter((x): x is OldGroup => Boolean(x)),
    gsubs,
    qsubs,
    tsubs,
  };
}

/** 旧题目 → 新题目 映射：先按题组名/分类对，再按内容指纹对；对不上直接报错（绝不静默丢作答） */
function buildRemapPlan(snap: Snapshot, sections: Group[]) {
  const labels = sections.map((g) => `${g.category}`);
  const gmap = new Map<string, number>();
  for (const og of snap.groups) {
    if (!og.hasSubs) continue;
    let idx = labels.indexOf(og.label);
    if (idx < 0) {
      const cands = sections.map((g, i) => ({ g, i })).filter((x) => (x.g.category || "") === og.category);
      if (cands.length === 1) idx = cands[0].i;
    }
    if (idx < 0) throw new Error(`题组「${og.label}」在新数据里找不到对应`);
    gmap.set(og.gid, idx);
  }
  const qmap = new Map<string, { gi: number; qi: number }>();
  for (const og of snap.groups) {
    if (!og.hasSubs) continue;
    const gi = gmap.get(og.gid)!;
    const norms = sections[gi].questions.map((q) => normText(q.content || ""));
    const sameCount = norms.length === og.qs.length;
    og.qs.forEach((oq, pos) => {
      let qi: number | undefined;
      if (oq.norm) {
        const hits = norms.filter((n) => n === oq.norm).length;
        if (hits === 1) qi = norms.indexOf(oq.norm);
      }
      if (qi === undefined && sameCount) qi = pos;
      if (qi === undefined) throw new Error(`题组「${og.label}」第 ${pos + 1} 道题在新数据里对不上`);
      qmap.set(oq.qid, { gi, qi });
    });
  }
  return { gmap, qmap };
}

async function restoreSubmissions(
  newPaperId: string,
  created: { gid: string; qids: string[] }[],
  snap: Snapshot,
  plan: { gmap: Map<string, number>; qmap: Map<string, { gi: number; qi: number }> },
) {
  const tmap = new Map<string, string>();
  for (const t of snap.tsubs) {
    const n = await prisma.testPaperSubmission.create({
      data: {
        userId: t.userId,
        testPaperId: newPaperId,
        content: (t.content ?? undefined) as never,
        score: t.score,
        duration: t.duration,
        startedAt: t.startedAt,
        submittedAt: t.submittedAt,
        createdAt: t.createdAt,
      },
    });
    tmap.set(t.id, n.id);
  }
  const gmapNew = new Map<string, string>();
  for (const g of snap.gsubs) {
    const gi = plan.gmap.get(g.questionGroupId);
    if (gi === undefined) continue;
    const n = await prisma.questionGroupSubmission.create({
      data: {
        userId: g.userId,
        questionGroupId: created[gi].gid,
        testSubmissionId: g.testSubmissionId ? (tmap.get(g.testSubmissionId) ?? null) : null,
        score: g.score,
        isCorrect: g.isCorrect,
        correctNum: g.correctNum,
        totalNum: g.totalNum,
        duration: g.duration,
        createdAt: g.createdAt,
      },
    });
    gmapNew.set(g.id, n.id);
  }
  let n = 0;
  for (const q of snap.qsubs) {
    const target = plan.qmap.get(q.questionId);
    if (!target) continue;
    const qid = created[target.gi]?.qids[target.qi];
    if (!qid) continue;
    await prisma.questionSubmission.create({
      data: {
        userId: q.userId,
        questionId: qid,
        groupSubmissionId: q.groupSubmissionId ? (gmapNew.get(q.groupSubmissionId) ?? null) : null,
        content: (q.content ?? undefined) as never,
        score: q.score,
        isCorrect: q.isCorrect,
        aiFeedback: (q.aiFeedback ?? undefined) as never,
        gradingStatus: q.gradingStatus,
        shareAsExcellent: q.shareAsExcellent,
        createdAt: q.createdAt,
      },
    });
    n++;
  }
  console.log(`   ↻ 已恢复作答：试卷 ${tmap.size} 份 / 题组 ${gmapNew.size} 份 / 小题 ${n} 条`);
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

function secsAll(raw: Paper): Group[] {
  return raw.sections ?? raw.groups ?? [];
}

async function importOne(
  file: string,
  dryRun: boolean,
  force: boolean,
  withPaper: boolean,
  manifest?: ManifestRow[],
) {
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as Paper;
  const p = raw.paper;
  const title = p.title;
  const subject = p.subject || "语文";

  const exists = await prisma.testPaper.findFirst({ where: { title, subject }, select: { id: true } });
  if (manifest) {
    const backup = path.join(path.dirname(file), `${title}.old-groups.json`);
    manifest.push({
      title,
      subject,
      jsonFile: file,
      existed: Boolean(exists),
      oldPaperId: exists?.id ?? null,
      oldBackup: fs.existsSync(backup) ? backup : null,
    });
  }
  let snap: Snapshot | null = null;
  let plan: { gmap: Map<string, number>; qmap: Map<string, { gi: number; qi: number }> } | null = null;
  if (exists) {
    if (!force) { console.log(`跳过（已存在）：${title}`); return { papers: 0, groups: 0, questions: 0 }; }
    // 默认行为不变：有作答时拒绝重导；加 --keep-submissions 则先快照、重建后按内容映射写回
    if (has("keep-submissions")) {
      snap = await snapshotPaper(exists.id);
      const hasSubs = snap.tsubs.length + snap.gsubs.length + snap.qsubs.length > 0;
      if (hasSubs) {
        plan = buildRemapPlan(snap, secsAll(raw));
        console.log(`↻ ${title}：检测到作答（试卷 ${snap.tsubs.length} / 题组 ${snap.gsubs.length} / 小题 ${snap.qsubs.length}），重建后按内容映射保留`);
      }
    } else {
      await assertNoSubmissions(exists.id, title);
    }
    if (!dryRun) await deletePaper(exists.id, title);
  }

  const secs: Group[] = raw.sections ?? raw.groups ?? [];
  const nQ = secs.reduce((n, g) => n + g.questions.length, 0);
  if (dryRun) {
    console.log(`[dry-run] ${title}: ${secs.length} 组 / ${nQ} 题｜` +
      secs.map((g) => `${g.category}(${g.questions.length})`).join(" "));
    return { papers: 1, groups: secs.length, questions: nQ };
  }

  const tags0 = Array.from(new Set([...(p.tags || []), subject]));

  const paper = withPaper
    ? await prisma.testPaper.create({
        data: {
          title,
          description: `${p.source || title}（${subject} · 套卷）`,
          subject,
          source: p.source || title,
          grade: p.grade || "高三",
          year: p.year ?? null,
          totalScore: p.totalScore ?? null,
          duration: p.duration ?? null,
          tags: tags0,
        },
      })
    : null;

  let order = 0;
  const createdGroups: { gid: string; qids: string[] }[] = [];
  for (const g of secs) {
    const tags = Array.from(new Set([...tags0, g.category]));
    const group = await prisma.questionGroup.create({
      data: {
        title: `${title}·${g.category}`,
        content: g.content || "",
        questionType: g.questionType,
        score: Math.round(g.questions.reduce((n, q) => n + (q.score || 0), 0)) || (g.score || 0),
        subject,
        source: p.source || title,
        grade: p.grade || "高三",
        category: g.category,
        tags,
      },
    });
    if (paper) {
      await prisma.paperItem.create({ data: { paperId: paper.id, itemId: group.id, itemType: "questionGroup", orderIndex: order++ } });
    }
    createdGroups.push({ gid: group.id, qids: [] });
    let gi = 0;
    for (const q of g.questions) {
      const created = await prisma.question.create({
        data: {
          questionType: q.questionType,
          content: q.content || "",
          options: q.options && q.options.length ? (q.options as unknown as object) : undefined,
          answer: q.answer || "",
          analysis: q.analysis || "",
          score: q.score ?? 0,
          subject,
          source: p.source || title,
          grade: p.grade || "高三",
          category: g.category,
          year: p.year ?? null,
          tags,
        },
      });
      await prisma.groupItem.create({ data: { groupId: group.id, questionId: created.id, orderIndex: gi++ } });
      createdGroups[createdGroups.length - 1].qids.push(created.id);
    }
  }
  if (paper && snap && plan) await restoreSubmissions(paper.id, createdGroups, snap, plan);
  console.log(`✓ ${title}：${secs.length} 组 / ${nQ} 题`);
  return { papers: paper ? 1 : 0, groups: secs.length, questions: nQ };
}

async function main() {
  const rollbackFile = arg("rollback");
  if (rollbackFile) {
    const rows = readManifest(rollbackFile);
    console.log(`回退 ${rows.length} 卷…`);
    for (const row of rows) {
      const cur = await prisma.testPaper.findFirst({ where: { title: row.title, subject: row.subject }, select: { id: true } });
      if (cur) await deletePaperById(cur.id, row.title);
      if (row.existed && row.oldBackup && fs.existsSync(row.oldBackup)) {
        await importOne(row.oldBackup, false, false, true);
        console.log(`  ↩ 已用旧格式还原：${row.title}`);
      }
    }
    console.log("回退完成");
    await prisma.$disconnect();
    return;
  }

  const delTitle = arg("delete");
  if (delTitle) {
    const t = await prisma.testPaper.findFirst({ where: { title: delTitle }, select: { id: true } });
    if (!t) { console.log(`没有这套卷：${delTitle}`); await prisma.$disconnect(); return; }
    await assertNoSubmissions(t.id, delTitle);
    await deletePaperById(t.id, delTitle);
    await prisma.$disconnect();
    return;
  }

  const file = arg("file");
  const type = arg("type", "二模")!;
  const dryRun = has("dry-run");
  const force = has("force");
  const withPaper = !has("no-paper");

  let files: string[];
  if (file) files = [path.resolve(file)];
  else {
    const dir = path.join(JSON_ROOT, type);
    files = fs.readdirSync(dir).map((f) => path.join(dir, f)).filter(isImportableJson).sort();
  }
  const manifestPath = arg("manifest");
  const manifest: ManifestRow[] | undefined = manifestPath ? [] : undefined;
  console.log(`待导入 ${files.length} 份（${dryRun ? "dry-run" : "写库"}）`);
  let tp = 0, tg = 0, tq = 0;
  for (const f of files) {
    try {
      const r = await importOne(f, dryRun, force, withPaper, manifest);
      tp += r.papers; tg += r.groups; tq += r.questions;
    } catch (e) {
      console.error(`✗ ${path.basename(f)}: ${String((e as Error)?.message || e).slice(0, 200)}`);
    }
  }
  if (manifestPath && manifest && !dryRun) {
    writeManifest(manifestPath, manifest);
    console.log(`清单：${manifestPath}（${manifest.length} 卷）`);
  }
  console.log(`\n完成：试卷 ${tp} 份 / 题组 ${tg} 个 / 题目 ${tq} 道`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
