/**
 * 「大题」入库：数学解答题（math-solve）/ 物理计算题（physics-solve）/ 物理实验题（physics-fill）
 *
 * 契约见 /home/gxwtf/bigq/CONTRACT.md 第 1、2 节。数据来源与 import-math-json.ts 相同：
 *   ~/jingshibang/output_json_math/<类型>/<学科>/<卷>.json
 * 图片：复制到 ~/jingshibang/output_docx_to_md/<类型>/<学科>/<卷>/images/，
 *       并把 ![](images/x.png) 改写成 /exam-images/<类型>/<学科>/<卷>/images/x.png（空格 / ASCII 括号做百分号编码）。
 *
 * 两种写库形态：
 *   1. 卷不存在（一模 / 高考真题）→ 整卷新建：TestPaper + 全部 section 的题组 / 单题 / PaperItem 顺序；
 *   2. 卷已存在（3 套二模）→ 只**追加**新 section 对应的题组（<卷名>·第N题）+ 单题，顺序接在既有 PaperItem
 *      之后，只更新 paper.totalScore。**既有题组 / 单题一律不碰，id 不变**（作答记录不受影响）。
 *
 * 幂等：同一份 JSON 再跑一次是「0 变更」—— 已存在且已导入的 section 不会再写一遍。
 *
 * 用法：
 *   npx tsx scripts/import-big-questions.ts --dry-run                       # 全量预览（不带 --apply 一律 dry-run）
 *   npx tsx scripts/import-big-questions.ts --type 二模 --subject 数学 --dry-run
 *   npx tsx scripts/import-big-questions.ts --file <json> --dry-run
 *   npx tsx scripts/import-big-questions.ts --apply --manifest /home/gxwtf/bigq/import-manifest.json
 *   npx tsx scripts/import-big-questions.ts --file <json> --apply --force   # 重导：先快照作答，映射不上就中止
 *   npx tsx scripts/import-big-questions.ts --rollback /home/gxwtf/bigq/import-manifest.json [--dry-run]
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

const JSON_ROOT = "/home/gxwtf/jingshibang/output_json_math";
const MD_ROOT = "/home/gxwtf/jingshibang/output_docx_to_md";

/** 新增三个新题型的 questionType（题组级） */
const BIG_TYPES = new Set(["math-solve", "physics-solve", "physics-fill"]);
const TYPES = ["一模", "二模", "真题"];
const SUBJECTS = ["数学", "物理"];

/** 契约第 0 节钉死的 8 套示例卷（每科）。不带 --file 时只吃这些卷，免得把 2011~2019 的老卷一起导进去 */
const TARGET_TITLES: Record<string, string[]> = {
  数学: [
    "2026北京高考真题数学", "2025北京高考真题数学",
    "2026北京西城高三一模数学", "2026北京海淀高三一模数学", "2026北京丰台高三一模数学",
    "2026北京西城高三二模数学", "2026北京海淀高三二模数学", "2026北京丰台高三二模数学",
  ],
  物理: [
    "2026北京高考真题物理", "2025北京高考真题物理",
    "2026北京西城高三一模物理", "2026北京海淀高三一模物理", "2026北京丰台高三一模物理",
    "2026北京西城高三二模物理", "2026北京海淀高三二模物理", "2026北京丰台高三二模物理",
  ],
};

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const has = (n: string) => process.argv.includes(`--${n}`);

interface Opt { id: string; label: string }
interface JQ {
  id?: number | string;
  questionType?: string;
  content?: string;
  options?: Opt[];
  answer?: string;
  analysis?: string;
  score?: number;
}
interface JSection {
  type?: string;
  questionType?: string;
  title?: string;
  category?: string;
  score?: number;
  content?: string;
  questions?: JQ[];
}
interface JPaper {
  paper: {
    title?: string; subject?: string; source?: string; grade?: string;
    year?: number | null; totalScore?: number | null; duration?: number | null; tags?: string[];
  };
  sections?: JSection[];
  groups?: JSection[];
}

// ---------------------------------------------------------------- 文本 / 图片

const IMG_MD = /!\[([^\]]*)\]\(\s*(images\/[^)\s]+)\s*\)/g;

/**
 * 图片链接目标里的空格 / ASCII 括号做百分号编码，否则 CommonMark 会把链接截断
 * （幂等：已经 %20/%28/%29 的不会再动）。与 scripts/sync-json-to-db.ts 同口径。
 */
function encodeImageDest(text: string): string {
  if (!text || !text.includes("](")) return text || "";
  let out = "";
  let i = 0;
  for (;;) {
    const k = text.indexOf("](", i);
    if (k < 0) { out += text.slice(i); break; }
    out += text.slice(i, k + 2);
    let j = k + 2, depth = 0, end = -1;
    while (j < text.length) {
      const ch = text[j];
      if (ch === "\n") break;
      if (ch === "(") depth++;
      else if (ch === ")") { if (depth === 0) { end = j; break; } depth--; }
      j++;
    }
    if (end < 0) { out += text.slice(k + 2); break; }
    const dest = text.slice(k + 2, end);
    const isImg = dest.startsWith("/exam-images/") || dest.startsWith("images/");
    out += (isImg ? dest.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29") : dest) + ")";
    i = end + 1;
  }
  return out;
}

/** 卷目录名变体：JSON 里的卷名不带「（教师版）」，md 目录常带 */
function dirVariants(name: string): string[] {
  const out = [name];
  for (const suf of ["（教师版）", "(教师版)", "（学生版）", "含答案", "（含答案）"]) out.push(name + suf);
  out.push(name.replace(/（教师版）|\(教师版\)|含答案/g, ""));
  return Array.from(new Set(out));
}

interface ImagePlan {
  dstDir: string;
  /** 原引用（images/x.png） → 入库后的 URL（已编码） */
  mapping: Map<string, string>;
  /** 原引用 → 磁盘上的源文件 */
  sources: Map<string, string>;
  missing: string[];
}

/** 收集 JSON 里所有 images/ 引用，定位源文件，算出改写后的 URL（dry-run 也跑，但不写盘） */
function planImages(raw: JPaper, file: string, typeDir: string, subject: string, stem: string): ImagePlan {
  const refs = new Set<string>();
  const scan = (t?: string) => {
    for (const m of String(t || "").matchAll(IMG_MD)) refs.add(m[2]);
  };
  for (const sec of raw.sections || raw.groups || []) {
    scan(sec.content);
    for (const q of sec.questions || []) {
      scan(q.content);
      scan(q.answer);
      for (const o of q.options || []) scan(String(o?.label ?? ""));
    }
  }
  const srcDirs: string[] = [path.join(path.dirname(file), "images"), path.join(JSON_ROOT, "images")];
  for (const d of dirVariants(stem)) srcDirs.push(path.join(MD_ROOT, typeDir, subject, d, "images"));

  const dstDir = path.join(MD_ROOT, typeDir, subject, stem, "images");
  const mapping = new Map<string, string>();
  const sources = new Map<string, string>();
  const missing: string[] = [];
  for (const ref of Array.from(refs).sort()) {
    const base = path.basename(ref);
    const src = srcDirs.map((d) => path.join(d, base)).find((p) => fs.existsSync(p));
    if (!src) { missing.push(ref); continue; }
    sources.set(ref, src);
    mapping.set(ref, `/exam-images/${typeDir}/${subject}/${stem}/images/${base}`);
  }
  return { dstDir, mapping, sources, missing };
}

/** 把引用改写成 /exam-images/... 并做链接目标编码 */
function rewriteImages(text: string | undefined, plan: ImagePlan): string {
  const src = String(text || "");
  if (!src) return "";
  const out = src.replace(IMG_MD, (_m, alt: string, p: string) => {
    const url = plan.mapping.get(p) || `/exam-images/${path.basename(path.dirname(plan.dstDir))}/images/${path.basename(p)}`;
    return `![${alt}](${url})`;
  });
  return encodeImageDest(out);
}

/** 真正复制图片；返回复制的张数 */
function materializeImages(plan: ImagePlan): number {
  let n = 0;
  for (const [ref, src] of plan.sources) {
    const dst = path.join(plan.dstDir, path.basename(ref));
    if (path.resolve(src) !== path.resolve(dst)) {
      fs.mkdirSync(plan.dstDir, { recursive: true });
      fs.copyFileSync(src, dst);
    }
    n++;
  }
  return n;
}

// ---------------------------------------------------------------- 结构工具

/** 题组标题后缀：优先「第N题」，否则用 category / title */
function sectionLabel(sec: JSection): string {
  const t = (sec.title || "").trim();
  const m = t.match(/第\s*(\d+)\s*题/);
  if (m) return `第${m[1]}题`;
  return (sec.category || t || sec.questionType || "未命名").trim();
}

/** 题组标题里「试卷名·X」的 X 部分 */
function labelOfTitle(title: string): string {
  const i = title.indexOf("·");
  return i >= 0 ? title.slice(i + 1) : title;
}

/** 内容指纹：去掉图片引用与所有空白，用来把旧题和新题对上（重导后 id 会变） */
function normText(t: string | undefined): string {
  return String(t || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\s+/g, "");
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- 自检

/** 结构自检：只报问题（返回字符串数组），结构性硬错另外 throw */
function validatePaper(secs: JSection[], subject: string, plan: ImagePlan): string[] {
  const problems: string[] = [];
  for (const sec of secs) {
    const name = sec.title || sec.category || sec.questionType || "?";
    const qs = sec.questions || [];
    if (!qs.length) throw new Error(`section「${name}」的 questions 为空`);
    const qt = String(sec.questionType || "");
    if (qt === "math-solve" || qt === "physics-solve") {
      if (qs.length !== 1) problems.push(`「${name}」${qt} 应一题一组，实际 ${qs.length} 题`);
      const bad = qs.filter((q) => String(q.questionType || "text") !== "text").length;
      if (bad) problems.push(`「${name}」有 ${bad} 道单题的 questionType 不是 text`);
    }
    if (qt === "physics-fill") {
      const blanks = (String(sec.content || "").match(/<(?:Input(Long)?|AnswerBox)\b[^<>]*>/g) || []).length;
      if (blanks && blanks !== qs.length) problems.push(`「${name}」内联空 ${blanks} 个 ≠ 小问 ${qs.length} 道`);
      const bad = qs.filter((q) => String(q.questionType || "input") !== "input").length;
      if (bad) problems.push(`「${name}」有 ${bad} 个空的 questionType 不是 input`);
      const empty = qs.filter((q) => !String(q.answer || "").trim()).length;
      if (empty) problems.push(`「${name}」有 ${empty} 个空没有参考答案`);
    }
    if (BIG_TYPES.has(qt) && !String(sec.category || "").trim()) problems.push(`「${name}」缺 category`);
    if (subject === "数学" && qt !== "math-solve" && qt !== "math-choice" && qt !== "math-fill") {
      problems.push(`「${name}」questionType=${qt || "(空)"} 与数学的题型不符`);
    }
    const sum = qs.reduce((n, q) => n + num(q.score), 0);
    if (sec.score != null && Math.abs(sum - num(sec.score)) > 0.01) {
      problems.push(`「${name}」分值不符：单题合计 ${sum} vs section ${sec.score}`);
    }
  }
  if (plan.missing.length) problems.push(`缺图 ${plan.missing.length} 张：${plan.missing.slice(0, 4).join(", ")}`);
  return problems;
}

// ---------------------------------------------------------------- 作答快照 / 映射（--force 重导用）

interface OldGroupSnap {
  gid: string;
  title: string;
  qs: { qid: string; norm: string; orderIndex: number; hasSubs: boolean }[];
  gsubs: any[];
  qsubs: any[];
}

async function snapshotGroup(gid: string): Promise<OldGroupSnap> {
  const g = await prisma.questionGroup.findUnique({
    where: { id: gid },
    include: { groupItems: { orderBy: { orderIndex: "asc" }, include: { question: true } } },
  });
  if (!g) throw new Error(`题组不存在：${gid}`);
  const qids = g.groupItems.map((gi) => gi.questionId);
  const qsubs = qids.length ? await prisma.questionSubmission.findMany({ where: { questionId: { in: qids } } }) : [];
  const gsubs = await prisma.questionGroupSubmission.findMany({ where: { questionGroupId: gid } });
  const withSubs = new Set(qsubs.map((s) => s.questionId));
  return {
    gid,
    title: g.title,
    qs: g.groupItems.map((gi) => ({
      qid: gi.questionId,
      norm: normText(gi.question.content),
      orderIndex: gi.orderIndex,
      hasSubs: withSubs.has(gi.questionId),
    })),
    gsubs,
    qsubs,
  };
}

/**
 * 旧题 → 新题映射：优先内容指纹（唯一命中），指纹为空或撞车时按位置（题数相同才允许）。
 * 对不上就抛错 —— 绝不允许静默丢作答。
 */
function buildRemap(snap: OldGroupSnap, newQs: JQ[]): Map<string, number> {
  const norms = newQs.map((q) => normText(q.content));
  const byNorm = new Map<string, number[]>();
  norms.forEach((n, i) => { if (n) byNorm.set(n, [...(byNorm.get(n) || []), i]); });
  const sameCount = norms.length === snap.qs.length;
  const map = new Map<string, number>();
  for (const oq of snap.qs) {
    if (!oq.hasSubs) continue;
    let idx: number | undefined;
    const hits = oq.norm ? byNorm.get(oq.norm) : undefined;
    if (hits && hits.length === 1) idx = hits[0];
    if (idx === undefined && sameCount) idx = oq.orderIndex;
    if (idx === undefined) {
      throw new Error(`题组「${snap.title}」第 ${oq.orderIndex + 1} 道题在新 JSON 里对不上（有作答，不能丢）`);
    }
    map.set(oq.qid, idx);
  }
  return map;
}

/** 重建后把作答按映射写回新 id（保留原分数、AI 批改结果、提交时间） */
async function restoreGroupSubmissionsTx(
  tx: any, newGid: string, newQids: string[], snap: OldGroupSnap, remap: Map<string, number>,
) {
  const gmapNew = new Map<string, string>();
  for (const g of snap.gsubs) {
    const n = await tx.questionGroupSubmission.create({
      data: {
        userId: g.userId,
        questionGroupId: newGid,
        testSubmissionId: g.testSubmissionId ?? null,
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
    const idx = remap.get(q.questionId);
    const qid = idx === undefined ? undefined : newQids[idx];
    if (!qid) continue;
    await tx.questionSubmission.create({
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
  return { gsubs: gmapNew.size, qsubs: n };
}

// ---------------------------------------------------------------- 删除

async function deleteGroupTx(tx: any, gid: string) {
  const gis = await tx.groupItem.findMany({ where: { groupId: gid }, select: { questionId: true } });
  const qids = Array.from(new Set<string>(gis.map((g: any) => g.questionId)));
  const gsubs = await tx.questionGroupSubmission.findMany({ where: { questionGroupId: gid }, select: { id: true } });
  const gsubIds = gsubs.map((g: any) => g.id);
  const or: any[] = [];
  if (qids.length) or.push({ questionId: { in: qids } });
  if (gsubIds.length) or.push({ groupSubmissionId: { in: gsubIds } });
  if (or.length) await tx.questionSubmission.deleteMany({ where: { OR: or } });
  await tx.questionGroupSubmission.deleteMany({ where: { questionGroupId: gid } });
  await tx.groupItem.deleteMany({ where: { groupId: gid } });
  await tx.paperItem.deleteMany({ where: { itemId: gid } });
  await tx.questionGroup.delete({ where: { id: gid } });
  if (qids.length) await tx.question.deleteMany({ where: { id: { in: qids } } });
}

async function deletePaperById(paperId: string) {
  const items = await prisma.paperItem.findMany({ where: { paperId }, select: { itemId: true } });
  await prisma.$transaction(async (tx) => {
    for (const i of items) await deleteGroupTx(tx, i.itemId);
    await tx.testPaperSubmission.deleteMany({ where: { testPaperId: paperId } });
    await tx.testPaper.delete({ where: { id: paperId } });
  }, { timeout: 120_000, maxWait: 20_000 });
}

// ---------------------------------------------------------------- 写库

interface CreateCtx {
  paperId: string;
  title: string;
  subject: string;
  p: JPaper["paper"];
  tags0: string[];
  plan: ImagePlan;
  orderIndex: number;
}

async function createGroupTx(tx: any, sec: JSection, ctx: CreateCtx): Promise<{ gid: string; title: string; qids: string[] }> {
  const { paperId, title, subject, p, tags0, plan } = ctx;
  const label = sectionLabel(sec);
  const qt = String(sec.questionType || "");
  const category = String(sec.category || (BIG_TYPES.has(qt) ? "" : "选择"));
  const qs = sec.questions || [];
  const sum = qs.reduce((n, q) => n + num(q.score), 0);
  const gtags = Array.from(new Set([...tags0, category].filter(Boolean)));
  const group = await tx.questionGroup.create({
    data: {
      title: `${title}·${label}`,
      content: rewriteImages(sec.content, plan),
      questionType: qt,
      score: round2(sum || num(sec.score)),
      subject,
      source: p.source || title,
      grade: p.grade || "高三",
      category,
      tags: gtags,
    },
  });
  await tx.paperItem.create({ data: { paperId, itemId: group.id, itemType: "questionGroup", orderIndex: ctx.orderIndex } });
  const qids: string[] = [];
  let gi = 0;
  for (const q of qs) {
    const opts = Array.isArray(q.options) && q.options.length
      ? q.options.map((o) => ({ id: String(o.id), label: rewriteImages(String(o.label ?? ""), plan) }))
      : undefined;
    const createdQ = await tx.question.create({
      data: {
        questionType: String(q.questionType || (qt === "physics-fill" ? "input" : "text")),
        content: rewriteImages(q.content, plan),
        options: opts as never,
        answer: rewriteImages(String(q.answer ?? ""), plan),
        analysis: rewriteImages(String(q.analysis ?? ""), plan),
        score: num(q.score),
        subject,
        source: p.source || title,
        grade: p.grade || "高三",
        category,
        year: p.year ?? null,
        tags: gtags,
      },
    });
    qids.push(createdQ.id);
    await tx.groupItem.create({ data: { groupId: group.id, questionId: createdQ.id, orderIndex: gi++ } });
  }
  return { gid: group.id, title: group.title, qids };
}

interface PaperResult {
  title: string;
  subject: string;
  type: string;
  file: string;
  action: "create" | "append" | "noop" | "failed";
  paperId: string | null;
  groupsCreated: number;
  questionsCreated: number;
  groupsReplaced: number;
  groupsSkipped: number;
  totalScore: number | null;
  totalScoreBefore: number | null;
  imagesPlanned: number;
  imagesCopied: number;
  missingImages: string[];
  problems: string[];
  drift: string[];
  createdGroups: { id: string; title: string }[];
}

/**
 * 套卷简介（TestPaper.description）的写法，对齐库里既有约定：
 * `<卷名>（<学科> · 选择+大题）` —— 只写粗粒度题型概览，**不逐个列大题分类**
 * （早期版本按 section 的 category 拼，物理卷会变成「实验题+实验题+实验题+力学+…」）。
 */
function describePaper(source: string, subject: string, secs: JSection[]): string {
  const has = (t: string) => secs.some((s) => s.questionType === t)
  const kinds: string[] = []
  const push = (v: string) => { if (!kinds.includes(v)) kinds.push(v) }
  if (has("math-choice") || has("physics-choice") || has("chemistry-choice") || has("biology-choice")) push("选择")
  if (has("math-fill")) push("填空")
  // 顺序按卷面：选择 → 填空 → 实验题 → 解答/计算题
  if (has("physics-fill")) push("实验题")
  if (has("math-solve") || has("physics-solve")) push(subject === "物理" ? "计算题" : "解答题")
  if (!kinds.length) {
    // 其它学科按现有写法只给学科名
    return `${source}（${subject}）`
  }
  return `${source}（${subject} · ${kinds.join("+")}）`
}

function printResult(r: PaperResult, dryRun: boolean) {  const tag = dryRun ? "[dry-run] " : "";
  const action = r.action === "create" ? "整卷新建" : r.action === "append" ? "追加/更新" : r.action === "failed" ? "失败" : "无变更";
  const bits = [
    `${r.groupsSkipped} 组已存在`,
    r.groupsCreated ? `新建 ${r.groupsCreated} 组 / ${r.questionsCreated} 题` : "",
    r.groupsReplaced ? `重导 ${r.groupsReplaced} 组` : "",
    `图片 ${r.imagesPlanned}${dryRun ? "" : `（复制 ${r.imagesCopied}）`}`,
    `totalScore ${r.totalScoreBefore ?? "-"}${r.totalScore !== r.totalScoreBefore ? ` → ${r.totalScore ?? "-"}` : ""}`,
  ].filter(Boolean);
  console.log(`${tag}${action} ${r.title}：${bits.join(" / ")}`);
  for (const p of r.problems) console.log(`     ⚠ ${p}`);
  for (const d of r.drift) console.log(`     ⚠ 内容差异（按契约不写库）：${d}`);
  if (r.missingImages.length) console.log(`     ⚠ 缺图：${r.missingImages.slice(0, 5).join(", ")}`);
}

async function importOne(
  file: string,
  typeDir: string,
  subject: string,
  dryRun: boolean,
  force: boolean,
): Promise<PaperResult> {
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as JPaper;
  const stem = path.basename(file, ".json");
  const secs = (raw.sections || raw.groups || []) as JSection[];
  if (!secs.length) throw new Error("JSON 里没有 sections/groups");
  const p = raw.paper || {};
  if (p.subject && p.subject !== subject) throw new Error(`paper.subject=${p.subject} 与 --subject ${subject} 不符`);
  const title = paperTitleWithSubject(String(p.title || stem), subject);

  const plan = planImages(raw, file, typeDir, subject, stem);
  const problems = validatePaper(secs, subject, plan);
  const tags0 = Array.from(new Set([...(p.tags || []), subject]));
  const sumAll = round2(secs.reduce(
    (n, s) => n + (s.score != null ? num(s.score) : (s.questions || []).reduce((m, q) => m + num(q.score), 0)), 0));
  const totalScore = p.totalScore != null ? num(p.totalScore) : sumAll;
  // 只对「含大题的完整 JSON」做总分核对：老的只有选择/填空的 JSON，paper.totalScore 是全卷分，section 合计只到 40~65
  if (p.totalScore != null && secs.some((s) => BIG_TYPES.has(String(s.questionType || ""))) && Math.abs(sumAll - totalScore) > 0.01) {
    problems.push(`卷面总分 ${totalScore} vs 各 section 合计 ${sumAll}`);
  }

  const existing = await prisma.testPaper.findFirst({ where: { title, subject }, select: { id: true, totalScore: true, description: true } });
  const res: PaperResult = {
    title, subject, type: typeDir, file, action: "noop", paperId: existing?.id ?? null,
    groupsCreated: 0, questionsCreated: 0, groupsReplaced: 0, groupsSkipped: 0,
    totalScore, totalScoreBefore: existing?.totalScore ?? null,
    imagesPlanned: plan.mapping.size, imagesCopied: 0,
    missingImages: plan.missing, problems, drift: [], createdGroups: [],
  };

  // ---------- 情形 A：卷不存在 → 整卷新建 ----------
  if (!existing) {
    res.action = "create";
    res.groupsCreated = secs.length;
    res.questionsCreated = secs.reduce((n, s) => n + (s.questions || []).length, 0);
    if (dryRun) { printResult(res, true); return res; }

    res.imagesCopied = materializeImages(plan);
    const paperId = await prisma.$transaction(async (tx) => {
      const paper = await tx.testPaper.create({
        data: {
          title,
          description: describePaper(p.source || title, subject, secs),
          subject,
          source: p.source || title,
          grade: p.grade || "高三",
          year: p.year ?? null,
          totalScore,
          duration: p.duration ?? null,
          tags: tags0,
        },
      });
      let order = 0;
      for (const sec of secs) {
        const g = await createGroupTx(tx, sec, { paperId: paper.id, title, subject, p, tags0, plan, orderIndex: order++ });
        res.createdGroups.push({ id: g.gid, title: g.title });
      }
      return paper.id;
    }, { timeout: 120_000, maxWait: 20_000 });
    res.paperId = paperId;
    printResult(res, false);
    return res;
  }

  // ---------- 情形 B：卷已存在 → 只追加 / 只重导匹配上的 section ----------
  const items = await prisma.paperItem.findMany({
    where: { paperId: existing.id }, orderBy: { orderIndex: "asc" }, select: { itemId: true, orderIndex: true },
  });
  const groupIds = items.map((i) => i.itemId);
  const groups = groupIds.length
    ? await prisma.questionGroup.findMany({
        where: { id: { in: groupIds } },
        include: { groupItems: { orderBy: { orderIndex: "asc" }, include: { question: true } } },
      })
    : [];
  const gmap = new Map(groups.map((g) => [g.id, g] as const));
  const ordered = items.map((i) => ({ orderIndex: i.orderIndex, g: gmap.get(i.itemId)! })).filter((x) => x.g);
  const byFullTitle = new Map(ordered.map((x) => [x.g.title, x.g] as const));
  const bySuffix = new Map(ordered.map((x) => [labelOfTitle(x.g.title), x.g] as const));
  let nextOrder = items.length ? Math.max(...items.map((i) => i.orderIndex)) + 1 : 0;

  const toCreate: { sec: JSection; orderIndex: number }[] = [];
  const toReplace: { gid: string; sec: JSection; orderIndex: number; snap: OldGroupSnap; remap: Map<string, number> }[] = [];

  for (const sec of secs) {
    const label = sectionLabel(sec);
    const qt = String(sec.questionType || "");
    let matched = byFullTitle.get(`${title}·${label}`) || bySuffix.get(label) || undefined;
    if (!matched && !BIG_TYPES.has(qt)) {
      // 选择 / 填空这类既有 section：按 questionType + category 兜底（库里标题可能叫「·选择」）
      matched = ordered.find((x) => x.g.questionType === qt && normText(x.g.category) === normText(sec.category))?.g;
    }
    if (matched) {
      res.groupsSkipped++;
      if (matched.questionType !== qt) {
        res.problems.push(`库中题组「${matched.title}」questionType=${matched.questionType} ≠ JSON ${qt}`);
      }
      // 内容漂移检查（只提示，不写库）
      const dbQs = matched.groupItems.map((gi: any) => gi.question);
      const jsonQs = sec.questions || [];
      const sig = (q: any) => `${normText(q.content)}|${String(q.answer ?? "").replace(/\s+/g, "")}|${num(q.score)}`;
      if (dbQs.map(sig).join("\n") !== jsonQs.map(sig).join("\n")) {
        res.drift.push(`「${label}」库中 ${dbQs.length} 题 / JSON ${jsonQs.length} 题（题组「${matched.title}」）`);
      }
      if (force) {
        const snap = await snapshotGroup(matched.id);
        const remap = buildRemap(snap, jsonQs);
        const idx = items.find((i) => i.itemId === matched!.id)!.orderIndex;
        toReplace.push({ gid: matched.id, sec, orderIndex: idx, snap, remap });
        res.groupsReplaced++;
      }
      continue;
    }
    toCreate.push({ sec, orderIndex: nextOrder++ });
  }

  res.groupsCreated = toCreate.length;
  res.questionsCreated = toCreate.reduce((n, c) => n + (c.sec.questions || []).length, 0);
  const scoreDirty = totalScore !== (existing.totalScore ?? null);
  // 简介也要跟整卷题型对齐（老数据里「选择+填空」这种半卷写法会残留）
  const wantDesc = describePaper(p.source || title, subject, secs);
  const descDirty = (existing.description ?? "") !== wantDesc;
  res.action = res.groupsCreated || res.groupsReplaced || scoreDirty || descDirty ? "append" : "noop";

  if (dryRun) { printResult(res, true); return res; }

  if (res.groupsCreated || res.groupsReplaced) res.imagesCopied = materializeImages(plan);

  await prisma.$transaction(async (tx) => {
    for (const r of toReplace) {
      await deleteGroupTx(tx, r.gid);
      const g = await createGroupTx(tx, r.sec, { paperId: existing.id, title, subject, p, tags0, plan, orderIndex: r.orderIndex });
      res.createdGroups.push({ id: g.gid, title: g.title });
      const restored = await restoreGroupSubmissionsTx(tx, g.gid, g.qids, r.snap, r.remap);
      if (restored.gsubs || restored.qsubs) {
        console.log(`     ↻ 「${g.title}」作答复原：题组 ${restored.gsubs} / 小题 ${restored.qsubs}`);
      }
    }
    for (const c of toCreate) {
      const g = await createGroupTx(tx, c.sec, { paperId: existing.id, title, subject, p, tags0, plan, orderIndex: c.orderIndex });
      res.createdGroups.push({ id: g.gid, title: g.title });
    }
    // 追加后整卷题型变了（如「选择+填空」→「选择+填空+解答题」），简介一并刷新
    if (scoreDirty || descDirty) {
      await tx.testPaper.update({
        where: { id: existing.id },
        data: { ...(scoreDirty ? { totalScore } : {}), ...(descDirty ? { description: wantDesc } : {}) },
      });
    }
  }, { timeout: 180_000, maxWait: 20_000 });

  printResult(res, false);
  return res;
}

// ---------------------------------------------------------------- 清单 / 回退

interface ManifestEntry {
  type: string;
  subject: string;
  title: string;
  paperId: string;
  action: "create" | "append";
  groupsCreated: { id: string; title: string }[];
  questionsCreated: number;
  totalScoreBefore: number | null;
  totalScoreAfter: number | null;
  at: string;
}

function readManifest(file: string): ManifestEntry[] {
  if (!fs.existsSync(file)) return [];
  try {
    const v = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Array.isArray(v) ? (v as ManifestEntry[]) : [];
  } catch { return []; }
}

function writeManifest(file: string, entries: ManifestEntry[]) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(entries, null, 2), "utf-8");
}

async function rollback(file: string, dryRun: boolean) {
  const entries = readManifest(file);
  if (!entries.length) { console.log(`清单为空或不存在：${file}`); return; }
  console.log(`回退清单 ${file}：${entries.length} 条${dryRun ? "（dry-run）" : ""}`);
  let n = 0;
  for (const e of entries) {
    const p = await prisma.testPaper.findUnique({ where: { id: e.paperId }, select: { id: true, title: true, subject: true } });
    if (!p) { console.log(`   - 已不存在：${e.title}（${e.paperId}）`); continue; }
    if (e.action === "create") {
      if (dryRun) { console.log(`   [dry-run] 将删除整卷 ${p.subject} / ${p.title}`); continue; }
      await deletePaperById(p.id);
      console.log(`   ✗ 已删除整卷 ${p.subject} / ${p.title}`);
      n++;
      continue;
    }
    if (dryRun) { console.log(`   [dry-run] 将删除追加的 ${e.groupsCreated.length} 个题组：${e.title}`); continue; }
    await prisma.$transaction(async (tx) => {
      for (const g of e.groupsCreated) {
        const still = await tx.questionGroup.findUnique({ where: { id: g.id }, select: { id: true } });
        if (still) await deleteGroupTx(tx, g.id);
      }
      if (e.totalScoreBefore != null) {
        await tx.testPaper.update({ where: { id: e.paperId }, data: { totalScore: e.totalScoreBefore } });
      }
    }, { timeout: 180_000, maxWait: 20_000 });
    console.log(`   ✗ 已撤销追加 ${e.groupsCreated.length} 个题组：${e.title}（totalScore 回到 ${e.totalScoreBefore}）`);
    n++;
  }
  console.log(`回退完成：${n} 条`);
}

// ---------------------------------------------------------------- main

function collectFiles(typeDir: string, subject: string, file: string | undefined): { ready: string[]; missing: string[] } {
  if (file) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) throw new Error(`文件不存在：${abs}`);
    return { ready: [abs], missing: [] };
  }
  const dir = path.join(JSON_ROOT, typeDir, subject);
  const tag = typeDir === "真题" ? "高考真题" : typeDir;
  const ready: string[] = [];
  const missing: string[] = [];
  for (const t of (TARGET_TITLES[subject] || []).filter((x) => x.includes(tag))) {
    const f = path.join(dir, `${t}.json`);
    if (fs.existsSync(f)) ready.push(f); else missing.push(f);
  }
  return { ready, missing };
}

async function main() {
  const rollbackFile = arg("rollback");
  const dryRunFlag = has("dry-run");
  const applyFlag = has("apply");
  if (dryRunFlag && applyFlag) throw new Error("--dry-run 与 --apply 不能同时给");
  const dryRun = !applyFlag;

  if (rollbackFile) {
    await rollback(rollbackFile, dryRun);
    await prisma.$disconnect(); await pool.end();
    return;
  }

  const file = arg("file");
  const typeArg = arg("type");
  const subjectArg = arg("subject");
  const force = has("force");
  const limit = Number(arg("limit", "0"));
  const manifestFile = arg("manifest");
  if (typeArg && !TYPES.includes(typeArg)) throw new Error(`--type 只能是 ${TYPES.join(" / ")}`);
  if (subjectArg && !SUBJECTS.includes(subjectArg)) throw new Error(`--subject 只能是 ${SUBJECTS.join(" / ")}`);

  const types = file ? [typeArg || "二模"] : (typeArg ? [typeArg] : TYPES);
  const subjects = file ? [subjectArg || "数学"] : (subjectArg ? [subjectArg] : SUBJECTS);

  console.log(dryRun
    ? "== dry-run：不写库、不复制图片；确认无误后加 --apply 真正写入 ==\n"
    : "== --apply：真正写库（先确保已跑过 --dry-run 并把变更条数报给 lead）==\n");

  const results: PaperResult[] = [];
  const notReady: string[] = [];
  for (const t of types) {
    for (const s of subjects) {
      const { ready, missing } = collectFiles(t, s, file);
      notReady.push(...missing);
      let files = ready;
      if (limit > 0) files = files.slice(0, limit);
      if (!files.length) continue;
      console.log(`— ${s} / ${t}：待处理 ${files.length} 份${missing.length ? `（JSON 未就绪 ${missing.length} 份）` : ""}`);
      for (const f of files) {
        try {
          results.push(await importOne(f, t, s, dryRun, force));
        } catch (e) {
          console.error(`✗ ${path.basename(f)}: ${String((e as Error)?.message || e).slice(0, 300)}`);
          results.push({
            title: path.basename(f, ".json"), subject: s, type: t, file: f, action: "failed", paperId: null,
            groupsCreated: 0, questionsCreated: 0, groupsReplaced: 0, groupsSkipped: 0,
            totalScore: null, totalScoreBefore: null, imagesPlanned: 0, imagesCopied: 0, missingImages: [],
            problems: [`失败：${String((e as Error)?.message || e).slice(0, 200)}`], drift: [], createdGroups: [],
          });
        }
      }
      console.log("");
    }
  }

  // ---- 汇总 ----
  const creates = results.filter((r) => r.action === "create");
  const appends = results.filter((r) => r.action === "append");
  const noops = results.filter((r) => r.action === "noop");
  const failed = results.filter((r) => r.action === "failed");
  const gCreated = results.reduce((n, r) => n + r.groupsCreated, 0);
  const qCreated = results.reduce((n, r) => n + r.questionsCreated, 0);
  const gReplaced = results.reduce((n, r) => n + r.groupsReplaced, 0);
  const scoreUpdates = results.filter((r) => r.action !== "noop" && r.totalScore !== r.totalScoreBefore).length;
  const imgPlanned = results.reduce((n, r) => n + r.imagesPlanned, 0);
  const imgCopied = results.reduce((n, r) => n + r.imagesCopied, 0);
  const miss = Array.from(new Set(results.flatMap((r) => r.missingImages)));
  const drift = results.flatMap((r) => r.drift.map((d) => `${r.title}: ${d}`));

  console.log("================ 汇总 ================");
  console.log(`整卷新建 ${creates.length} 份 / 追加 ${appends.length} 份 / 无变更 ${noops.length} 份 / 失败 ${failed.length} 份`);
  console.log(`将变更：题组 +${gCreated}、单题 +${qCreated}${gReplaced ? `、重导题组 ${gReplaced}` : ""}、更新 totalScore 的卷 ${scoreUpdates} 份`);
  console.log(`图片：引用 ${imgPlanned} 张${dryRun ? "" : `，已复制 ${imgCopied} 张`}${miss.length ? `，缺图 ${miss.length} 张` : "，无缺图"}`);
  if (miss.length) console.log(`缺图清单：${miss.slice(0, 20).join(", ")}${miss.length > 20 ? ` …共 ${miss.length}` : ""}`);
  if (notReady.length) console.log(`JSON 未就绪 ${notReady.length} 份：${notReady.map((f) => path.basename(f)).join("、")}`);
  if (drift.length) {
    console.log(`\n⚠ 与库中已有内容有差异（按契约不写库，仅提示）${drift.length} 处：`);
    for (const d of drift) console.log(`   - ${d}`);
  }
  const problems = results.flatMap((r) => r.problems.map((x) => `${r.title}: ${x}`));
  if (problems.length) {
    console.log(`\n自检问题 ${problems.length} 条：`);
    for (const x of problems) console.log(`   - ${x}`);
  }
  console.log(`\n${dryRun ? "（dry-run：以上变更一条都没写入）" : "已写库。"}`);

  if (manifestFile && !dryRun) {
    // 同一份卷多次导入时合并到一条上：action 取「create 优先」（整卷是我们建的，回退就该整卷删掉），
    // groupsCreated 取并集（回退时逐组撤销追加），totalScoreBefore 保留最早那次的值。
    const prev = readManifest(manifestFile);
    const prevByPaper = new Map(prev.map((e) => [e.paperId, e] as const));
    const touched = new Set(results.filter((r) => r.paperId && r.action !== "noop").map((r) => r.paperId!));
    const entries: ManifestEntry[] = prev.filter((e) => !touched.has(e.paperId));
    for (const r of results) {
      if (!r.paperId || r.action === "noop") continue;
      const before = prevByPaper.get(r.paperId);
      const groups = [...(before?.groupsCreated || [])];
      for (const g of r.createdGroups) if (!groups.some((x) => x.id === g.id)) groups.push(g);
      entries.push({
        type: r.type, subject: r.subject, title: r.title, paperId: r.paperId,
        action: before?.action === "create" || r.action === "create" ? "create" : "append",
        groupsCreated: groups,
        questionsCreated: (before?.questionsCreated || 0) + r.questionsCreated,
        totalScoreBefore: before ? before.totalScoreBefore : r.totalScoreBefore,
        totalScoreAfter: r.totalScore,
        at: new Date().toISOString(),
      });
    }
    writeManifest(manifestFile, entries);
    console.log(`清单已写入：${manifestFile}（${entries.length} 条）`);
  }

  await prisma.$disconnect(); await pool.end();
  if (failed.length) process.exitCode = 1;
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); await pool.end(); process.exit(1); });
