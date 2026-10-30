/**
 * 把 exam-parser 修好的 JSON **原地同步**进题库（不删除、不新建、不动作答记录）
 *
 * 与 `sync-math-json.ts` 同一套匹配口径，但支持四个 JSON 根、两种结构（sections / groups），
 * 且会同步 analysis（质量脚手架 --repair 会把答案里串进来的解析迁到 analysis）。
 *
 * 用法：
 *   npx tsx scripts/sync-json-to-db.ts --subject 语文 --type 二模 --dry-run
 *   npx tsx scripts/sync-json-to-db.ts --subject 语文 --type 二模 --apply
 *   npx tsx scripts/sync-json-to-db.ts --subject 英语 --type 一模 --file <json> --apply
 *   npx tsx scripts/sync-json-to-db.ts --subject 数学 --type 二模 --apply --report qa/sync-数学-二模.md
 *
 * JSON 根（自动按学科选）：
 *   英语            → ~/jingshibang/output_json/<类型>/英语/
 *   语文            → ~/jingshibang/output_json_chinese/<类型>/
 *   政治            → ~/jingshibang/output_json_politics/<类型>/
 *   数学/物理/化学  → ~/jingshibang/output_json_math/<类型>/<学科>/
 *
 * 匹配规则（**找不到就跳过，绝不用「新建」兜底**）：
 *   1. TestPaper：title = JSON paper.title（缺省用文件名去 .json）且 subject 一致 → 找不到记「库中缺卷」；
 *   2. 题组：按 PaperItem.orderIndex 顺序对 JSON sections/groups 顺序；两边数量不等 → 跳过整卷并记警告
 *      （数量不等意味着顺序无法可信对齐，错位写入比不写更糟）；
 *   3. 小题：按 GroupItem.orderIndex 顺序对 JSON questions 顺序；数量不等 → 跳过该题组并记警告。
 *
 * 只 update，绝不 delete / create：
 *   Question      : content / options / answer / analysis / score
 *   QuestionGroup : title / content / category / score
 * 其它字段（questionType、subject、source、tags、year…）与题目/题组 ID 一律不动，
 * 所以 QuestionSubmission / QuestionGroupSubmission 的作答记录必然原样保留。
 *
 * 几个刻意的保守约定：
 * - 图片：JSON 里若还是相对 `images/xxx.png`，改写成 /exam-images/<类型>/<学科>/<卷>/images/xxx.png
 *   （与 import-math-json.ts / sync-math-json.ts 一致）；数据库里已有的绝对路径原样保留。
 * - 选项 ID 大小写：JSON 是 A/B/C/D，库里英语/语文/数学是 a/b/c/d、物理是 A/B/C/D。
 *   选项集合与库里一致（忽略大小写）时沿用**库里的 ID**，只换 label——避免把学生作答里
 *   存的选项 ID 改掉（BlankFillingLogic 等是按 ID 严格比较的）。
 * - JSON 里某字段为空（content / options / analysis）而库里有值 → **不覆盖**，记一条「保留库值」计数，
 *   防止把库里的人工补充内容抹掉。
 * - 题组分值 = 小题分值之和（与 import-*.ts 的写法一致）；题组标题沿用该卷既有命名法：
 *   库里是「卷名·分类」的（语文/数学/物理/化学/政治）继续用「卷名·分类」，
 *   库里是「节标题」的（英语）继续用 JSON 节标题，试卷名一律不改。
 * - 库中该卷若是「图片版」（题面 <QImg>，化学图片版就是这种）而 JSON 是文本版 → 不同源，跳过并记警告。
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const JSON_ROOTS: Record<string, string> = {
  英语: "/home/gxwtf/jingshibang/output_json",
  语文: "/home/gxwtf/jingshibang/output_json_chinese",
  政治: "/home/gxwtf/jingshibang/output_json_politics",
  数学: "/home/gxwtf/jingshibang/output_json_math",
  物理: "/home/gxwtf/jingshibang/output_json_math",
  化学: "/home/gxwtf/jingshibang/output_json_math",
};

function arg(name: string, def?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
}
const hasFlag = (n: string) => process.argv.includes(`--${n}`);

interface Opt { id: string; label: string }
interface Q {
  id?: number;
  questionType?: string;
  content?: string;
  options?: Opt[];
  answer?: string;
  analysis?: string;
  score?: number;
}
interface Unit {
  type?: string;
  questionType?: string;
  title?: string;
  category?: string;
  score?: number;
  article?: string | null;
  content?: string | null;
  intro?: string | null;
  questions?: Q[];
}
interface PaperJson {
  paper?: { title?: string; subject?: string };
  sections?: Unit[];
  groups?: Unit[];
}

/** 学科目录 */
function subjectDir(subject: string, type: string): string {
  const root = JSON_ROOTS[subject];
  if (!root) throw new Error(`不支持的学科：${subject}（支持 英语/语文/政治/数学/物理/化学）`);
  if (!fs.existsSync(root)) throw new Error(`JSON 根不存在：${root}`);
  if (subject === "英语") return path.join(root, type, "英语");
  if (subject === "语文" || subject === "政治") return path.join(root, type);
  return path.join(root, type, subject);
}

const IMG_MD = /!\[([^\]]*)\]\((images\/[^)]+)\)/g;

/**
 * 图片链接目标里的空格 / ASCII 括号要做百分号编码，否则 CommonMark 会把链接截断
 * （`![](/exam-images/.. /2020北京通州高三二模英语 (教师版)/images/a.png)` 里空格会让链接失效）。
 * 只处理 /exam-images/ 与 images/ 开头的目标，且是幂等的：已经 %20/%28/%29 的不会再动。
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

/** 把 `![](images/x.png)` 改写成 nginx 可服务的 /exam-images/...，再做链接目标编码 */
function rewriteImages(text: string, type: string, stem: string, subject: string): string {
  if (!text) return "";
  const abs = text.replace(IMG_MD, (_m, alt: string, p: string) =>
    `![${alt}](/exam-images/${type}/${subject}/${stem}/images/${path.basename(p)})`);
  return encodeImageDest(abs);
}

/** 选项：JSON 的 id 若是库里已有的同一位置选项（忽略大小写），沿用库里 ID */
function mergeOptions(dbOpts: any, jsonOpts: Opt[], rewrite: (s: string) => string) {
  const db = Array.isArray(dbOpts) ? (dbOpts as Opt[]) : [];
  const sameLen = db.length === jsonOpts.length;
  const sameSet = sameLen && db.every((o) => jsonOpts.some((j) => String(j.id).toLowerCase() === String(o.id).toLowerCase()));
  const ids = sameSet ? db.map((o) => String(o.id)) : jsonOpts.map((o) => String(o.id));
  return jsonOpts.map((o, i) => ({ id: ids[i] ?? String(o.id), label: rewrite(String(o.label ?? "")) }));
}

function jsonEqual(a: any, b: any): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function normOpts(o: any): Opt[] | null {
  if (!Array.isArray(o)) return null;
  return (o as any[]).map((x) => ({ id: String(x?.id ?? ""), label: String(x?.label ?? "") }));
}

interface PaperLog {
  subject: string;
  type: string;
  file: string;
  title: string;
  paperId?: string;
  matched: boolean;
  groupsTotal: number;
  groupsSynced: number;
  questionsSynced: number;
  questionsChanged: number;
  changedFields: Record<string, number>;
  skippedGroups: { unit: string; reason: string }[];
  skip?: string;
  notes: string[];
}

function newLog(subject: string, type: string, file: string, title: string): PaperLog {
  return {
    subject, type, file, title, matched: false,
    groupsTotal: 0, groupsSynced: 0, questionsSynced: 0, questionsChanged: 0,
    changedFields: {}, skippedGroups: [], notes: [],
  };
}

/** 单卷同步；任何结构对不上都只跳过、不兜底新建 */
async function syncPaper(
  file: string, type: string, subject: string, apply: boolean, limit: number,
): Promise<PaperLog> {
  const data = JSON.parse(fs.readFileSync(file, "utf-8")) as PaperJson;
  const stem = path.basename(file, ".json");
  const title = (data.paper?.title || "").trim() || stem;
  const units: Unit[] = data.sections || data.groups || [];
  const structure = data.sections ? "sections" : data.groups ? "groups" : "(none)";
  const log = newLog(subject, type, file, title);
  log.groupsTotal = units.length;

  if (!units.length) { log.skip = `JSON 无 ${structure} 内容`; return log; }

  const paper = await prisma.testPaper.findFirst({
    where: { title, subject },
    include: { paperItems: { orderBy: { orderIndex: "asc" } } },
  });
  if (!paper) { log.skip = "库中缺卷"; return log; }
  log.matched = true;
  log.paperId = paper.id;

  if (paper.paperItems.length !== units.length) {
    log.skip = `题组数不一致（库 ${paper.paperItems.length} / JSON ${units.length}），顺序无法可信对齐`;
    return log;
  }

  // 载入全部题组（含小题顺序）
  const groups = [];
  for (const item of paper.paperItems) {
    const g = await prisma.questionGroup.findUnique({
      where: { id: item.itemId },
      include: { groupItems: { orderBy: { orderIndex: "asc" } } },
    });
    if (!g) { log.skip = `题组记录缺失（${item.itemId}）`; return log; }
    groups.push(g);
  }
  // 不同源守卫：库中该卷是图片版（题面 <QImg>），JSON 是文本版
  const dbQ1 = groups[0]?.groupItems[0]
    ? await prisma.question.findUnique({ where: { id: groups[0].groupItems[0].questionId }, select: { content: true, questionType: true } })
    : null;
  const jsonHasQImg = units.some((u) => (u.questions || []).some((q) => /<QImg/i.test(q.content || "")));
  if (dbQ1 && /<QImg/i.test(dbQ1.content || "") && !jsonHasQImg) {
    log.skip = "库中该卷为图片版（题面 <QImg>），与文本版 JSON 不同源";
    return log;
  }

  const bump = (k: string) => { log.changedFields[k] = (log.changedFields[k] || 0) + 1; };

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const g = groups[i];
    const label = (u.title || u.category || `第${i + 1}题组`).trim();
    const jsonQs = u.questions || [];
    if (g.groupItems.length !== jsonQs.length) {
      log.skippedGroups.push({ unit: label, reason: `小题数不一致（库 ${g.groupItems.length} / JSON ${jsonQs.length}）` });
      continue;
    }

    // ── 题组：title / content / category / score ──
    const groupData: Record<string, any> = {};
    const dupTitle = `${title}·`;
    const wantsTitle = g.title.startsWith(dupTitle)
      ? `${title}·${(u.category || u.title || "").trim() || g.title.slice(dupTitle.length)}`
      : ((u.title || u.category || "").trim() || g.title);
    if (wantsTitle && wantsTitle !== g.title) { groupData.title = wantsTitle; bump("group.title"); }
    const bodyRaw = ((u.article && u.article.trim()) ? u.article : (u.content && u.content.trim() ? u.content : ""));
    const body = rewriteImages(bodyRaw, type, stem, subject);
    if (body && body !== g.content) { groupData.content = body; bump("group.content"); }
    else if (!body && g.content) log.notes.push(`${label}：JSON 题面为空、库里有值，保留库值`);
    const cat = (u.category || "").trim();
    if (cat && cat !== g.category) { groupData.category = cat; bump("group.category"); }
    // 题组分值：优先用 JSON 题组自身的 score；缺失时用小题分值之和（与 import-*.ts 同口径）。
    // 库字段是 Int、英语真题题组常见 12.5 这种半分，差 0.5 以内视为「同一个值」，不去来回改。
    const sum = jsonQs.reduce((n, q) => n + (typeof q.score === "number" ? q.score : 0), 0);
    const wantScore = (typeof u.score === "number" && u.score > 0) ? u.score : Math.round(sum);
    if (wantScore > 0 && Math.abs(wantScore - g.score) > 0.5) { groupData.score = Math.round(wantScore); bump("group.score"); }

    if (apply && Object.keys(groupData).length) {
      await prisma.questionGroup.update({ where: { id: g.id }, data: groupData });
    }
    if (Object.keys(groupData).length) log.groupsSynced++;

    // ── 小题：content / options / answer / analysis / score ──
    for (let j = 0; j < jsonQs.length; j++) {
      if (limit > 0 && log.questionsSynced >= limit) break;
      const q = jsonQs[j];
      const gi = g.groupItems[j];
      const dbQ = await prisma.question.findUnique({ where: { id: gi.questionId } });
      if (!dbQ) { log.notes.push(`${label} 第${j + 1}题：库里题目记录缺失，跳过`); continue; }
      log.questionsSynced++;

      const data: Record<string, any> = {};
      const content = rewriteImages(q.content || "", type, stem, subject);
      if (content && content !== dbQ.content) { data.content = content; bump("question.content"); }
      else if (!content && dbQ.content) log.notes.push(`${label} 第${j + 1}题：JSON 题干为空、库里有值，保留库值`);

      const jsonOpts = Array.isArray(q.options) ? q.options : [];
      if (jsonOpts.length) {
        const merged = mergeOptions(dbQ.options, jsonOpts, (s) => rewriteImages(s, type, stem, subject));
        if (!jsonEqual(merged, normOpts(dbQ.options))) { data.options = merged; bump("question.options"); }
      } else if (normOpts(dbQ.options)?.length) {
        log.notes.push(`${label} 第${j + 1}题：JSON 无选项、库里有选项，保留库值`);
      }

      if (typeof q.answer === "string" && q.answer !== (dbQ.answer ?? "")) {
        data.answer = q.answer; bump("question.answer");
      }
      if (typeof q.analysis === "string" && q.analysis.trim()) {
        if (q.analysis !== (dbQ.analysis ?? "")) { data.analysis = q.analysis; bump("question.analysis"); }
      } else if (dbQ.analysis && dbQ.analysis.trim()) {
        log.notes.push(`${label} 第${j + 1}题：JSON 解析为空、库里有值，保留库值`);
      }
      if (typeof q.score === "number" && Number.isFinite(q.score) && q.score > 0 && q.score !== dbQ.score) {
        data.score = q.score; bump("question.score");
      } else if (typeof q.score === "number" && !(q.score > 0)) {
        log.notes.push(`${label} 第${j + 1}题：JSON 分值为 ${q.score}，保留库值 ${dbQ.score}`);
      }

      if (Object.keys(data).length) {
        log.questionsChanged++;
        if (apply) await prisma.question.update({ where: { id: dbQ.id }, data });
      }
    }
    if (limit > 0 && log.questionsSynced >= limit) { log.skip = `--limit ${limit} 截断`; break; }
  }
  return log;
}

const MODE_ZH = (apply: boolean) => (apply ? "apply（已写库）" : "dry-run（只看不写）");

function mdReport(logs: PaperLog[], apply: boolean, startedAt: string) {
  const bySubject = new Map<string, PaperLog[]>();
  for (const l of logs) {
    const k = `${l.subject} ${l.type}`;
    bySubject.set(k, [...(bySubject.get(k) || []), l]);
  }
  const lines: string[] = [];
  lines.push(`# JSON → DB 原地同步报告（${apply ? "apply" : "dry-run"}）`, "");
  lines.push(`- 生成时间：${startedAt}`);
  lines.push(`- 模式：${MODE_ZH(apply)}`);
  lines.push(`- 口径：只 update，不 delete / create；按「试卷标题 + 题组顺序 + 小题顺序」原地更新`, "");
  lines.push("## 汇总", "");
  lines.push("| 学科 | 类型 | JSON 卷 | 库中命中 | 同步卷 | 题组（变更/总） | 更新小题（有变更/扫描） | 跳过卷 | 跳过题组 |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const [k, ls] of bySubject) {
    const [subject, type] = k.split(" ");
    const hit = ls.filter((l) => l.matched).length;
    const synced = ls.filter((l) => l.matched && !l.skip).length;
    const groups = ls.reduce((n, l) => n + l.groupsSynced, 0);
    const groupsAll = ls.reduce((n, l) => n + l.groupsTotal, 0);
    const changed = ls.reduce((n, l) => n + l.questionsChanged, 0);
    const scanned = ls.reduce((n, l) => n + l.questionsSynced, 0);
    const skipped = ls.filter((l) => l.skip).length;
    const skippedGroups = ls.reduce((n, l) => n + l.skippedGroups.length, 0);
    lines.push(`| ${subject} | ${type} | ${ls.length} | ${hit} | ${synced} | ${groups}/${groupsAll} | ${changed}/${scanned} | ${skipped} | ${skippedGroups} |`);
  }
  const fields = new Map<string, number>();
  for (const l of logs) for (const [k, n] of Object.entries(l.changedFields)) fields.set(k, (fields.get(k) || 0) + n);
  lines.push("", "## 字段变更统计", "", "| 字段 | 条数 |", "| --- | --- |");
  for (const [k, n] of [...fields.entries()].sort()) lines.push(`| ${k} | ${n} |`);

  lines.push("", "## 明细", "");
  for (const [k, ls] of bySubject) {
    lines.push(`### ${k}`, "");
    lines.push("| 卷 | 题组（变更/总） | 更新小题（有变更/扫描） | 跳过原因 |");
    lines.push("| --- | --- | --- | --- |");
    for (const l of ls) {
      const reason = l.skip || l.skippedGroups.map((s) => `${s.unit}: ${s.reason}`).join("；") || "";
      lines.push(`| ${l.title} | ${l.groupsSynced}/${l.groupsTotal} | ${l.questionsChanged}/${l.questionsSynced} | ${reason} |`);
    }
    lines.push("");
  }
  const skipped = logs.filter((l) => l.skip);
  if (skipped.length) {
    lines.push("## 跳过卷汇总", "");
    const byReason = new Map<string, string[]>();
    for (const l of skipped) byReason.set(l.skip!, [...(byReason.get(l.skip!) || []), l.title]);
    for (const [r, ts] of byReason) lines.push(`- **${r}**（${ts.length} 份）：${ts.slice(0, 8).join("、")}${ts.length > 8 ? " …" : ""}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const subject = arg("subject", "")!;
  const type = arg("type", "二模")!;
  const apply = hasFlag("apply");
  const reportPath = arg("report");
  const limit = Number(arg("limit", "0"));
  const fileArg = arg("file");
  if (!subject) throw new Error("缺少 --subject（英语/语文/政治/数学/物理/化学）");
  if (!apply && !hasFlag("dry-run")) {
    console.log("⚠ 未指定 --apply，按 dry-run 处理（不写库）");
  }

  let files: string[];
  if (fileArg) {
    const f = path.resolve(fileArg);
    if (!fs.existsSync(f)) throw new Error(`文件不存在：${f}`);
    files = [f];
  } else {
    const dir = subjectDir(subject, type);
    if (!fs.existsSync(dir)) throw new Error(`目录不存在：${dir}`);
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => path.join(dir, f));
    if (!files.length) throw new Error(`目录里没有 .json：${dir}`);
  }

  const startedAt = new Date().toISOString();
  console.log(`${MODE_ZH(apply)}｜${subject} ${type}｜待处理 ${files.length} 份 JSON`);

  const logs: PaperLog[] = [];
  for (const f of files) {
    let log: PaperLog;
    try {
      log = await syncPaper(f, type, subject, apply, limit);
    } catch (e) {
      log = newLog(subject, type, f, path.basename(f, ".json"));
      log.skip = `异常：${String((e as Error)?.message || e).slice(0, 160)}`;
    }
    logs.push(log);
    if (log.skip) console.log(`  ⤼ ${log.title}：跳过（${log.skip}）`);
    else console.log(`  ✓ ${log.title}：题组 ${log.groupsSynced}/${log.groupsTotal}，小题变更 ${log.questionsChanged}/${log.questionsSynced}${log.skippedGroups.length ? `，跳过题组 ${log.skippedGroups.length}` : ""}`);
  }

  const hit = logs.filter((l) => l.matched).length;
  const synced = logs.filter((l) => l.matched && !l.skip).length;
  const groups = logs.reduce((n, l) => n + l.groupsSynced, 0);
  const changed = logs.reduce((n, l) => n + l.questionsChanged, 0);
  const scanned = logs.reduce((n, l) => n + l.questionsSynced, 0);
  const skipped = logs.filter((l) => l.skip);
  console.log(
    `\n${apply ? "[apply]" : "[dry-run]"} ${subject} ${type}：JSON ${logs.length} 卷 / 库中命中 ${hit} / 同步 ${synced} 卷 / 题组变更 ${groups} / 小题扫描 ${scanned}、需变更 ${changed} / 跳过 ${skipped.length} 卷`,
  );
  if (skipped.length) {
    const byReason = new Map<string, number>();
    for (const l of skipped) byReason.set(l.skip!, (byReason.get(l.skip!) || 0) + 1);
    for (const [r, n] of byReason) console.log(`  ⚠ ${r}：${n} 卷`);
  }
  if (reportPath) {
    const out = path.resolve(reportPath);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, mdReport(logs, apply, startedAt) + "\n", "utf-8");
    console.log(`报告已写入：${out}`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
