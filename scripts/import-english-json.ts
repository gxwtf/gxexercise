/**
 * 把英语 JSON（output_json/<类型>/英语/<卷>.json 或 output_json_english/<类型>/<卷>.json）安全导入题库
 *
 * 结构对齐 problem_generate/import-exam.ts（英语链路 ① 的入库口径），但**重导保护**照抄
 * scripts/import-biology-json.ts 的做法：
 *   1. 备份：先把旧试卷的题组结构 + 全部作答（试卷/题组/小题提交）快照到内存；
 *   2. 恢复：按「题组标题」+「题干内容指纹」把旧作答映射到新 id 上重建
 *      （分数、AI 批改结果、提交时间都保留），映射不上**直接中止**，绝不静默丢作答；
 *   3. 提交：删旧卷 + 建新卷/题组/题目在同一个事务里完成，作答重建在事务提交后写回。
 *
 * 用法：
 *   npx tsx scripts/import-english-json.ts --file ~/jingshibang/output_json/上期末/英语/2026北京朝阳高三（上）期末英语.json --dry-run
 *   npx tsx scripts/import-english-json.ts --file <同上> --force
 *   npx tsx scripts/import-english-json.ts --type 上期末 --dry-run      # 整个类型批量（只报告）
 *
 * 选项：
 *   --file <path>        单份 JSON（与 --type 二选一，--file 优先）
 *   --type <类型>        批量：output_json/<类型>/英语/*.json 与 output_json_english/<类型>/*.json
 *   --dry-run            只打印将要做的事（含旧卷/作答统计），不写库
 *   --force              库里已有同名套卷时覆盖（默认跳过）
 *   --drop-submissions   确认丢弃旧作答（默认有作答且映射不上就中止）
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { paperTitleWithSubject } from "../src/constants/subjects";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * 英语 JSON 有两个历史根目录（结构都是 <根>/<类型>/…）：
 *   1. output_json/<类型>/英语/<卷>.json      —— 老链路（一模/二模/上期末/下期末/真题）
 *   2. output_json_english/<类型>/<卷>.json   —— 新链路，按学科分根（与 output_json_bio 同构，
 *      2026 上学期的期中卷只在这里）
 * --type 批量时两个根都找，同名 JSON 以第一个根为准。
 */
const JSON_ROOTS = [
  "/home/gxwtf/jingshibang/output_json",
  "/home/gxwtf/jingshibang/output_json_english",
];

/** 某个「类型」下所有待导入的英语 JSON（跨两个根，按文件名去重） */
function filesOfType(type: string): string[] {
  const dirs = [
    path.join(JSON_ROOTS[0], type, SUBJECT),
    path.join(JSON_ROOTS[1], type),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".json") || seen.has(f)) continue;
      seen.add(f);
      out.push(path.join(dir, f));
    }
  }
  return out;
}
const SUBJECT = "英语";

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
  blankIndex?: number;
}
interface Section {
  type?: string;
  questionType: string;
  title: string;
  category?: string;
  score?: number;
  grade?: string;
  source?: string;
  tags?: string[];
  article?: string;
  content?: string;
  options?: Opt[];
  questions: Q[];
}
interface Paper {
  title: string;
  subject?: string;
  source?: string;
  grade?: string;
  year?: number | null;
  totalScore?: number | null;
  duration?: number | null;
  description?: string | null;
  tags?: string[];
}
interface EngPaper { paper: Paper; sections: Section[] }

const normText = (t: string) =>
  (t || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\s+/g, "");

interface OldGroup {
  gid: string;
  label: string;
  category: string;
  articleNorm: string;
  qs: { qid: string; norm: string; orderIndex: number }[];
}
interface Snapshot {
  groups: OldGroup[];
  gsubs: any[];
  qsubs: any[];
  tsubs: any[];
}

/** 备份：旧题组结构 + 全部作答（作答挂在即将被删的 id 上，必须先留底） */
async function snapshotPaper(paperId: string): Promise<Snapshot> {
  const items = await prisma.paperItem.findMany({
    where: { paperId }, orderBy: { orderIndex: "asc" }, select: { itemId: true },
  });
  const groupIds = items.map((i) => i.itemId);
  const groups = await prisma.questionGroup.findMany({
    where: { id: { in: groupIds } },
    include: {
      groupItems: {
        orderBy: { orderIndex: "asc" },
        include: { question: { select: { id: true, content: true } } },
      },
    },
  });
  const gsubs = await prisma.questionGroupSubmission.findMany({
    where: { questionGroupId: { in: groupIds } },
  });
  const qsubs = gsubs.length
    ? await prisma.questionSubmission.findMany({
        where: { groupSubmissionId: { in: gsubs.map((g) => g.id) } },
      })
    : [];
  const tsubs = await prisma.testPaperSubmission.findMany({ where: { testPaperId: paperId } });
  return {
    groups: groups.map((g) => ({
      gid: g.id,
      label: g.title,
      category: g.category,
      articleNorm: normText(g.content),
      qs: g.groupItems.map((gi) => ({
        qid: gi.question.id,
        norm: normText(gi.question.content),
        orderIndex: gi.orderIndex,
      })),
    })),
    gsubs,
    qsubs,
    tsubs,
  };
}

/** 映射计划：题组按「文章正文 + 题干重合度」配对（题组标题是 AI 生成的，每次跑都会变），
 *  组内题目按内容指纹（退化到位置）配对。配不上就抛错，由调用方决定是否中止。 */
function buildRemapPlan(snap: Snapshot, sections: Section[]) {
  const secArticle = sections.map((s) => normText(s.article || s.content || ""));
  const secQnorms = sections.map((s) => s.questions.map((q) => normText(q.content || "")));

  // 打分：题干完全相同的条数 * 2 + 文章正文相同 + 题组数相同的小奖励
  const scored: { oi: number; si: number; score: number }[] = [];
  snap.groups.forEach((og, oi) => {
    const oq = new Set(og.qs.map((q) => q.norm).filter(Boolean));
    sections.forEach((_s, si) => {
      const sq = new Set(secQnorms[si].filter(Boolean));
      let overlap = 0;
      for (const n of oq) if (sq.has(n)) overlap++;
      let score = overlap * 2;
      if (og.articleNorm && secArticle[si] && og.articleNorm === secArticle[si]) score += 3;
      // 标题偶尔没变，也给一点分
      if ((sections[si].title || "") === og.label) score += 2;
      if (score > 0) scored.push({ oi, si, score });
    });
  });
  scored.sort((a, b) => b.score - a.score);

  const gmap = new Map<string, number>();
  const usedSections = new Set<number>();
  for (const { oi, si } of scored) {
    const og = snap.groups[oi];
    if (gmap.has(og.gid) || usedSections.has(si)) continue;
    gmap.set(og.gid, si);
    usedSections.add(si);
  }
  for (const og of snap.groups) {
    if (!gmap.has(og.gid)) throw new Error(`题组「${og.label}」在新数据里找不到对应（题干/正文都对不上）`);
  }

  const qmap = new Map<string, { gi: number; qi: number }>();
  for (const og of snap.groups) {
    const gi = gmap.get(og.gid)!;
    const norms = secQnorms[gi];
    const byNorm = new Map<string, number>();
    norms.forEach((n, i) => { if (n && !byNorm.has(n)) byNorm.set(n, i); });
    const sameCount = norms.length === og.qs.length;
    og.qs.forEach((oq, pos) => {
      let qi: number | undefined;
      // 语法填空等题的 content 可能为空或高度重复：只在「唯一命中」时才按内容对
      if (oq.norm) {
        const hits = norms.filter((n) => n === oq.norm).length;
        if (hits === 1) qi = byNorm.get(oq.norm);
      }
      if (qi === undefined && sameCount) qi = pos;
      if (qi === undefined) {
        throw new Error(`题组「${og.label}」第 ${pos + 1} 道题在新数据里对不上`);
      }
      qmap.set(oq.qid, { gi, qi });
    });
  }
  return { gmap, qmap };
}

/** 恢复：按映射把作答重建到新 id 上（保留分数、AI 批改、提交时间） */
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
    const qid = created[target.gi].qids[target.qi];
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

async function deletePaper(paperId: string) {
  const items = await prisma.paperItem.findMany({ where: { paperId }, select: { itemId: true } });
  const groupIds = items.map((i) => i.itemId);
  if (groupIds.length) {
    const gis = await prisma.groupItem.findMany({
      where: { groupId: { in: groupIds } }, select: { questionId: true },
    });
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

async function importOne(file: string, dryRun: boolean, force: boolean, dropSubs: boolean) {
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as EngPaper;
  const p = raw.paper || ({} as Paper);
  const sections = raw.sections || [];
  // 英语解析产物的 paper.title 不带「英语」，入库时按其他学科的惯例补齐（见 paperTitleWithSubject）
  const rawTitle = p.title || path.basename(file, ".json");
  const title = paperTitleWithSubject(rawTitle, SUBJECT);
  if (!sections.length) throw new Error("JSON 里没有 sections");

  const nQ = sections.reduce((n, s) => n + s.questions.length, 0);
  // 兼容老数据：库里可能还是没补「英语」的旧标题，两种都算「已存在」
  const exists = await prisma.testPaper.findFirst({
    where: { title: { in: Array.from(new Set([title, rawTitle])) }, subject: SUBJECT }, select: { id: true },
  });

  if (dryRun) {
    console.log(`[dry-run] ${title}：${sections.length} 组 / ${nQ} 题（${p.grade || "-"} ${p.year ?? "-"}）`);
    if (exists) {
      const snap = await snapshotPaper(exists.id);
      const subs = `试卷 ${snap.tsubs.length} / 题组 ${snap.gsubs.length} / 小题 ${snap.qsubs.length}`;
      console.log(`           库里已存在（${exists.id}），作答：${subs}`);
      if (snap.tsubs.length + snap.gsubs.length + snap.qsubs.length > 0) {
        try {
          buildRemapPlan(snap, sections);
          console.log("           → 映射预演通过，加 --force 可安全覆盖");
        } catch (e) {
          console.log(`           → ⚠ 映射预演失败：${(e as Error).message}（需 --drop-submissions 才敢覆盖）`);
        }
      } else {
        console.log("           → 无作答，加 --force 直接覆盖");
      }
    } else {
      console.log("           库里没有同名套卷，直接导入即可");
    }
    return { papers: 0, groups: 0, questions: 0 };
  }

  let snap: Snapshot | null = null;
  let plan: ReturnType<typeof buildRemapPlan> | null = null;
  if (exists) {
    if (!force) {
      console.log(`跳过（已存在，加 --force 覆盖）：${title}`);
      return { papers: 0, groups: 0, questions: 0 };
    }
    snap = await snapshotPaper(exists.id);
    const hasSubs = snap.tsubs.length + snap.gsubs.length + snap.qsubs.length > 0;
    if (hasSubs && dropSubs) {
      console.log(`⚠ ${title}：按 --drop-submissions 丢弃作答（试卷 ${snap.tsubs.length} / 题组 ${snap.gsubs.length} / 小题 ${snap.qsubs.length}）`);
    } else if (hasSubs) {
      try {
        plan = buildRemapPlan(snap, sections);
      } catch (e) {
        throw new Error(
          `${title}：${(e as Error).message}，为免丢作答已中止。确认要丢弃这些作答请加 --drop-submissions` +
          `（当前：试卷 ${snap.tsubs.length} / 题组 ${snap.gsubs.length} / 小题 ${snap.qsubs.length}）`,
        );
      }
      console.log(`↻ ${title}：检测到作答（试卷 ${snap.tsubs.length} / 题组 ${snap.gsubs.length} / 小题 ${snap.qsubs.length}），重建后按内容映射保留`);
    }
    await deletePaper(exists.id);
  }

  const tags0 = Array.from(new Set([...(p.tags || []), SUBJECT]));
  const created: { gid: string; qids: string[] }[] = [];
  let newPaperId = "";
  await prisma.$transaction(async (tx) => {
    const paper = await tx.testPaper.create({
      data: {
        title,
        description: p.description ?? "",
        subject: SUBJECT,
        source: paperTitleWithSubject(p.source || title, SUBJECT),
        grade: p.grade || "高三",
        year: p.year ?? null,
        totalScore: p.totalScore ?? null,
        duration: p.duration ?? null,
        tags: tags0,
      },
    });
    newPaperId = paper.id;
    let order = 0;
    for (const sec of sections) {
      const content = sec.article || sec.content || "";
      const group = await tx.questionGroup.create({
        data: {
          title: sec.title,
          content,
          questionType: sec.questionType,
          score: Math.round(sec.score || 0),
          subject: SUBJECT,
          source: paperTitleWithSubject(sec.source || p.source || title, SUBJECT),
          grade: sec.grade || p.grade || "高三",
          category: sec.category || "",
          tags: Array.from(new Set([...(sec.tags || []), ...tags0])),
        },
      });
      await tx.paperItem.create({
        data: { paperId: paper.id, itemId: group.id, itemType: "questionGroup", orderIndex: order++ },
      });
      const rec = { gid: group.id, qids: [] as string[] };
      created.push(rec);
      let gi = 0;
      for (const q of sec.questions) {
        const createdQ = await tx.question.create({
          data: {
            content: q.content || "",
            questionType: q.questionType,
            options: (q.options || []) as never,
            answer: q.answer || "",
            analysis: q.analysis || "",
            score: q.score ?? 0,
            subject: SUBJECT,
            source: paperTitleWithSubject(sec.source || p.source || title, SUBJECT),
            category: sec.category || "",
            grade: sec.grade || p.grade || "高三",
            year: p.year ?? null,
            tags: Array.from(new Set([...(sec.tags || []), ...tags0])),
          },
        });
        rec.qids.push(createdQ.id);
        await tx.groupItem.create({
          data: { groupId: group.id, questionId: createdQ.id, orderIndex: gi++ },
        });
      }
    }
  });
  if (snap && plan) await restoreSubmissions(newPaperId, created, snap, plan);
  console.log(`✓ ${title}：${sections.length} 组 / ${nQ} 题（试卷 id ${newPaperId}）`);
  return { papers: 1, groups: sections.length, questions: nQ };
}

async function main() {
  const file = arg("file");
  const type = arg("type");
  const dryRun = has("dry-run");
  const force = has("force");
  const dropSubs = has("drop-submissions");

  let files: string[] = [];
  if (file) {
    files = [path.resolve(file)];
  } else if (type) {
    files = filesOfType(type);
  } else {
    console.error("用法: --file <json> 或 --type <类型> [--dry-run] [--force] [--drop-submissions]");
    process.exit(1);
  }
  if (!files.length) {
    console.log("没有待导入的 JSON");
    return;
  }
  console.log(`待处理 ${files.length} 份（${dryRun ? "dry-run，不写库" : "写库"}${force ? "，--force" : ""}）`);
  let tp = 0, tg = 0, tq = 0, failed = 0;
  for (const f of files) {
    try {
      const r = await importOne(f, dryRun, force, dropSubs);
      tp += r.papers; tg += r.groups; tq += r.questions;
    } catch (e) {
      failed++;
      console.error(`✗ ${path.basename(f)}: ${String((e as Error)?.message || e).slice(0, 400)}`);
    }
  }
  console.log(`\n完成：试卷 ${tp} 份 / 题组 ${tg} 个 / 题目 ${tq} 道${failed ? ` / 失败 ${failed} 份` : ""}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
