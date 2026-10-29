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
 *
 * 重导保护：--force 会删掉旧题组与作答记录，默认会先把作答快照下来、按「题组名 + 题干内容」映射到新 id 上重建
 * （分数、AI 批改结果、提交时间都保留）；映射不上会直接中止。确实要丢弃作答时显式加 --drop-submissions。
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
  qs: { qid: string; norm: string; orderIndex: number }[];
}

interface Snapshot {
  groups: OldGroup[];
  gsubs: any[];
  qsubs: any[];
  tsubs: any[];
}

/** 重导前把旧的题组结构 + 全部作答快照下来（作答挂在会被删掉的 id 上，必须先留底） */
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
  return {
    groups: groups.map((g) => ({
      gid: g.id,
      label: labelOf(g.title),
      category: g.category,
      qs: g.groupItems.map((gi) => ({ qid: gi.question.id, norm: normText(gi.question.content), orderIndex: gi.orderIndex })),
    })),
    gsubs,
    qsubs,
    tsubs,
  };
}

/** 建立「旧题目 → 新题目」映射：先按题组名对，再按内容指纹对；对不上就报错（绝不静默丢作答） */
function buildRemapPlan(snap: Snapshot, sections: Section[], labels: string[]) {
  const gmap = new Map<string, number>();
  for (const og of snap.groups) {
    let idx = labels.indexOf(og.label);
    if (idx < 0) {
      const cands = sections.map((s, i) => i).filter((i) => (sections[i].category || "") === og.category);
      if (cands.length === 1) idx = cands[0];
    }
    if (idx < 0) throw new Error(`题组「${og.label}」在新数据里找不到对应`);
    gmap.set(og.gid, idx);
  }
  const qmap = new Map<string, { gi: number; qi: number }>();
  for (const og of snap.groups) {
    const gi = gmap.get(og.gid)!;
    const norms = sections[gi].questions.map((q) => normText(q.content || ""));
    const byNorm = new Map<string, number>();
    norms.forEach((n, i) => { if (!byNorm.has(n)) byNorm.set(n, i); });
    const sameCount = norms.length === og.qs.length;
    og.qs.forEach((oq, pos) => {
      let qi: number | undefined;
      // 填空题的 content 本身是空串（题干在题组材料里），不能拿内容指纹对，只能按位置；其余题优先按内容
      if (oq.norm) {
        const hits = norms.filter((n) => n === oq.norm).length;
        if (hits === 1) qi = byNorm.get(oq.norm);
      }
      if (qi === undefined && sameCount) qi = pos;
      if (qi === undefined) throw new Error(`题组「${og.label}」第 ${pos + 1} 道题在新数据里对不上`);
      qmap.set(oq.qid, { gi, qi });
    });
  }
  return { gmap, qmap };
}

/** 重建完后把作答按映射写回新 id（保留原分数、AI 批改结果、提交时间） */
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

async function importOne(file: string, dryRun: boolean, force: boolean, dropSubs: boolean) {
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as BioPaper;
  const sections = raw.sections || raw.groups || [];
  const title = raw.paper.title || path.basename(file, ".json");
  const stem = path.basename(file, ".json");
  const p = raw.paper;

  if (!sections.length) throw new Error("JSON 里没有 sections/groups");

  // 结构自检
  const problems: string[] = [];
  const seen = new Map<string, number>();
  // 题组标签只算一次（带重名后缀），后面建组、比对旧数据都用同一批标签
  const labels = sections.map((sec) => groupLabel(sec, seen));
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
    console.log(`[dry-run] ${title}：${sections.length} 组 / ${nQ} 题（${labels.join("、")}）`);
    return { papers: 0, groups: 0, questions: 0 };
  }

  const exists = await prisma.testPaper.findFirst({ where: { title, subject: SUBJECT }, select: { id: true } });
  let snap: Snapshot | null = null;
  let plan: { gmap: Map<string, number>; qmap: Map<string, { gi: number; qi: number }> } | null = null;
  if (exists) {
    if (!force) { console.log(`跳过（已存在，加 --force 覆盖）：${title}`); return { papers: 0, groups: 0, questions: 0 }; }
    // 重导会删掉旧题组与作业记录：先把作答留底，能对上就在新 id 上重建
    snap = await snapshotPaper(exists.id);
    const hasSubs = snap.tsubs.length + snap.gsubs.length + snap.qsubs.length > 0;
    if (hasSubs && dropSubs) {
      console.log(`⚠ ${title}：按 --drop-submissions 丢弃作答（试卷 ${snap.tsubs.length} / 题组 ${snap.gsubs.length} / 小题 ${snap.qsubs.length}）`);
    } else if (hasSubs) {
      try {
        plan = buildRemapPlan(snap, sections, labels);
      } catch (e) {
        throw new Error(`${title}：${(e as Error).message}，为免丢作答已中止。确认要丢弃这些作答请加 --drop-submissions（当前：试卷 ${snap.tsubs.length} / 题组 ${snap.gsubs.length} / 小题 ${snap.qsubs.length}）`);
      }
      console.log(`↻ ${title}：检测到作答（试卷 ${snap.tsubs.length} / 题组 ${snap.gsubs.length} / 小题 ${snap.qsubs.length}），重建后会按内容映射保留`);
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
    newPaperId = paper.id;
    let order = 0;
    const createdGroups: { gid: string; qids: string[] }[] = [];
    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si];
      const isFill = sec.questionType === "biology-fill";
      const category = sec.category || (isFill ? "实验探究" : "选择");
      const group = await tx.questionGroup.create({
        data: {
          title: `${title}·${labels[si]}`,
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
      const rec: { gid: string; qids: string[] } = { gid: group.id, qids: [] };
      createdGroups.push(rec);
      let gi = 0;
      for (const q of sec.questions) {
        const createdQ = await tx.question.create({
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
        rec.qids.push(createdQ.id);
        await tx.groupItem.create({ data: { groupId: group.id, questionId: createdQ.id, orderIndex: gi++ } });
      }
    }
    created.push(...createdGroups);
  });
  if (snap && plan) {
    await restoreSubmissions(newPaperId, created, snap, plan);
  }
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
  const dropSubs = has("drop-submissions");

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
      const r = await importOne(f, dryRun, force, dropSubs);
      tp += r.papers; tg += r.groups; tq += r.questions;
    } catch (e) {
      console.error(`✗ ${path.basename(f)}: ${String((e as Error)?.message || e).slice(0, 300)}`);
    }
  }
  console.log(`\n完成：试卷 ${tp} 份 / 题组 ${tg} 个 / 题目 ${tq} 道`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
