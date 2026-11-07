/**
 * 给题组找封面：读题组 → 生成「裸正文」→ 调 article-cover → （可选）写回 QuestionGroup.imageUrl
 *
 * 分四步（每一步都可单独停在终端看结果）：
 *   1. 按 groupId 读 QuestionGroup + GroupItem（按 orderIndex）+ 关联 Question；
 *   2. 把 content（MDX：阅读材料 + 题目 + 选项）压成一篇**能当文章读的纯英文正文**；
 *      阅读类截掉题目区；完形填空 / 七选五把正确答案填回每个空；
 *      清洗 MDX、KaTeX、中文注音括号、全角标点，并**写死校验**（残留占位符 / 残留选项区）。
 *      完形填空或七选五只要有一个空没填上，直接 exit 1，绝不产出半成品。
 *   3. 裸正文写到 .cache/cover/<groupId>.txt（已被 .gitignore 忽略），
 *      CLI 结果 JSON 写到 .cache/cover/<groupId>.json；
 *      调 /home/gxwtf/article-cover/main.py（独立 venv，只读调用，不改它任何文件）。
 *   4. --write N 指定第 N 张封面写进 QuestionGroup.imageUrl，**默认 dry-run**，
 *      必须同时带 --apply 才真正执行 UPDATE。
 *
 * 用法（在 /home/gxwtf/gxexercise 仓库根目录）：
 *   # 只抽正文，不调 article-cover、不写库（调正文逻辑时用这个，秒出）
 *   npx tsx scripts/cover-from-group.ts --group cmvc0nsno04dolnu6394ikjlb --extract-only
 *
 *   # 抽正文 + 调 article-cover 拿 5 张封面候选（终端打印正文前 300 字 + 校验 + 封面简表）
 *   npx tsx scripts/cover-from-group.ts --group cmvc0nsno04dolnu6394ikjlb
 *   npx tsx scripts/cover-from-group.ts --group <id> --max-results 3 --no-clip --no-cache
 *
 *   # 预览写库 SQL（dry-run，不改数据）
 *   npx tsx scripts/cover-from-group.ts --group <id> --write 1
 *
 *   # 真正写库（唯一会改数据的形态）
 *   npx tsx scripts/cover-from-group.ts --group <id> --write 1 --apply
 *
 *   # 复用已有 JSON（不再跑 article-cover，用来调试写库 / 打印）
 *   npx tsx scripts/cover-from-group.ts --group <id> --write 2 --reuse-json
 *
 * 参数：
 *   --group <id>        题组 id（必填）
 *   --extract-only      只抽正文 + 校验，不调 article-cover，不写库
 *   --max-results <1..5> 透传给 article-cover（默认 5）
 *   --no-clip           透传，关闭 OpenCLIP 排序
 *   --no-cache          透传，绕过 article-cover 磁盘缓存
 *   --write <N>         选第 N 张封面（1 起）写进 QuestionGroup.imageUrl
 *   --apply             与 --write 同用，才真正 UPDATE；不带就是 dry-run
 *   --reuse-json        已有 .cache/cover/<id>.json 时不重跑 article-cover
 *   --show-body <n>     终端打印裸正文前 n 字符（默认 300，0 = 不打印）
 *
 * 退出码：0 成功；1 正文抽取 / 校验失败（含「某个空没填上」）；2 参数或数据库/CLI 错误。
 *
 * 退出码与校验的约定（写死在本文件里，不要放宽）：
 *   - 裸正文不得残留：___ / （1）/(1) / ①②③ / A． / # 标题 / MDX 组件 / ![]() / $..$
 *   - 完形填空、七选五：空数量与填好的数量必须严格相等，否则 exit 1
 *   - 裸正文英文词数低于 MIN_WORDS 视为抽取失败（防止把题组抽成空壳）
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/* ------------------------------------------------------------------ */
/* 配置                                                                */
/* ------------------------------------------------------------------ */

/** 仓库根：优先用当前工作目录（本脚本约定在仓库根跑），否则回落绝对路径。
 *  不用 __dirname，因为 tsx 下 .ts 可能按 ESM 执行。 */
const REPO_ROOT = fs.existsSync(path.join(process.cwd(), "prisma", "schema.prisma"))
  ? process.cwd()
  : "/home/gxwtf/gxexercise";
const CACHE_DIR = path.join(REPO_ROOT, ".cache", "cover");

/** article-cover 是独立项目，只读调用；想换路径用环境变量覆盖。 */
const COVER_PYTHON = process.env.ARTICLE_COVER_PYTHON || "/home/gxwtf/article-cover/.venv/bin/python";
const COVER_MAIN = process.env.ARTICLE_COVER_MAIN || "/home/gxwtf/article-cover/main.py";
const COVER_TIMEOUT_MS = Number(process.env.ARTICLE_COVER_TIMEOUT_MS || 240_000);

/** 裸正文最少英文词数；低于这个数说明抽取失败（不是「句子短」）。 */
const MIN_WORDS = 40;

const READING_TYPES = new Set(["en-reading", "reading-expression"]);
const CLOZE_TYPES = new Set(["cloze"]);
const SCF_TYPES = new Set(["seven-choose-five"]);
/** 作文：题干是中文写作要求 + 英文材料（广告/来信），没有英文长文可抽。 */
const WRITING_TYPES = new Set(["en-writing"]);
/** 中文题干类题型的最少汉字数（英文词数门槛对它们没意义）。 */
const MIN_CJK_CHARS = 30;

/* ------------------------------------------------------------------ */
/* 参数                                                                */
/* ------------------------------------------------------------------ */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const groupId = arg("group");
const extractOnly = has("extract-only");
const noClip = has("no-clip");
const noCache = has("no-cache");
const apply = has("apply");
const reuseJson = has("reuse-json");
const maxResults = Number(arg("max-results") ?? 5);
/** 写回哪一张：默认 best（分数最高）；--no-write 完全不写；--write N 指定序号。
 *  无论哪种，不带 --apply 都是 dry-run，不会改库。 */
const noWrite = has("no-write");
const writeArg = arg("write");
const writeTarget: "best" | number | undefined = noWrite
  ? undefined
  : writeArg === undefined || writeArg === "best"
    ? "best"
    : Number(writeArg);
/** 保留前 N 张候选（写进 <id>.candidates.json，方便以后人工换封面）。 */
const keepTop = Number(arg("top") ?? 5);
const showBody = Number(arg("show-body") ?? 300);

function die(code: number, ...msg: string[]): never {
  console.error(msg.join("\n"));
  process.exit(code);
}

if (!groupId) {
  die(2, "缺 --group <id>。用法见本文件头部注释：npx tsx scripts/cover-from-group.ts --group <id>");
}
if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 5) {
  die(2, `--max-results 只能是 1..5，收到 ${arg("max-results")}`);
}
if (typeof writeTarget === "number" && (!Number.isInteger(writeTarget) || writeTarget < 1)) {
  die(2, `--write 只能是 best 或从 1 开始的序号，收到 ${arg("write")}`);
}
if (!Number.isInteger(keepTop) || keepTop < 1 || keepTop > 5) {
  die(2, `--top 只能是 1..5，收到 ${arg("top")}`);
}
if (apply && writeTarget === undefined) {
  die(2, "--no-write 和 --apply 不能同时用（没有可写的东西）。");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/* ------------------------------------------------------------------ */
/* 1) 取题组 & 子题                                                     */
/* ------------------------------------------------------------------ */

interface OptionItem {
  key: string; // a / b / c / d（cloze、阅读）或 A / B / … G（七选五）
  text: string;
}

interface SubQuestion {
  orderIndex: number;
  id: string;
  questionType: string;
  content: string;
  answer: string;
  options: OptionItem[];
}

/** options 在库里是 Json：真实数据全是 [{id,label}] 数组（已核对 15334 条），
 *  这里仍兼容对象 {a:"…"}、纯字符串数组，避免以后被别的题型坑到。 */
function normalizeOptions(raw: unknown): OptionItem[] {
  const out: OptionItem[] = [];
  if (raw == null) return out;
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const el = raw[i];
      if (el && typeof el === "object") {
        const o = el as Record<string, unknown>;
        const key = String(o.id ?? o.key ?? o.value ?? String.fromCharCode(97 + i));
        const text = String(o.label ?? o.text ?? o.content ?? "");
        if (text.trim()) out.push({ key: key.trim(), text: text.trim() });
      } else if (typeof el === "string" && el.trim()) {
        out.push({ key: String.fromCharCode(97 + i), text: el.trim() });
      }
    }
    return out;
  }
  if (typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const text = typeof v === "string" ? v : String((v as Record<string, unknown>)?.label ?? "");
      if (text.trim()) out.push({ key: k.trim(), text: text.trim() });
    }
  }
  return out;
}

async function loadGroup(id: string) {
  const group = await prisma.questionGroup.findUnique({
    where: { id },
    include: {
      groupItems: {
        orderBy: { orderIndex: "asc" },
        include: { question: true },
      },
    },
  });
  if (!group) die(2, `找不到题组 ${id}`);
  const items: SubQuestion[] = group.groupItems.map((gi) => ({
    orderIndex: gi.orderIndex,
    id: gi.question.id,
    questionType: gi.question.questionType,
    content: gi.question.content ?? "",
    answer: (gi.question.answer ?? "").trim(),
    options: normalizeOptions(gi.question.options),
  }));
  return { group, items };
}

/* ------------------------------------------------------------------ */
/* 2) 生成裸正文                                                        */
/* ------------------------------------------------------------------ */

/** 空位哨兵：清洗全程带着它走，最后一步才换成答案文本，
 *  这样清洗规则（压缩空白 / 去括号 / 转标点）不会把空位本身弄丢。 */
const BLANK = "\u0001";

/** 题组 content 里出现的两种空位组件（全库只有这两种，已核 417 + 438 组）。 */
const COMP_CLOZE_BLANK = /<ClozeBlank\s*>\s*<\/ClozeBlank\s*>/g;
const COMP_BLANK = /<Blank\s*>\s*<\/Blank\s*>/g;

/** 题目区起点：题干 `（1）`、`1．`、`第1题`、`4．（6分）` 这几类。 */
function isQuestionStart(para: string): boolean {
  const t = para.trim();
  if (!t) return false;
  if (/^[（(]\s*\d{1,3}\s*[）)]/.test(t)) return true;
  if (/^\d{1,3}\s*[．.]\s*[（(]\s*\d+\s*分/.test(t)) return true;
  if (/^第\s*\d+\s*题/.test(t)) return true;
  if (/^\d{1,3}\s*[．]\s*\S/.test(t)) return true; // 全角句点才算题号，避免误伤 "1. Introduction"
  // 试卷里「72.」「72\.」（MDX 转义）这类两位以上题号；限 2–3 位，避免把 "1. xxx" 的列表误当题号
  if (/^\d{2,3}\s*\\?\.\s*\S/.test(t)) return true;
  if (/^\d{1,3}\s*[.．、]\s*[一二三四五六七八九十]/.test(t)) return true;
  return false;
}

/** 选项行：`A． xxx` / `B. xxx` / `C、xxx`。 */
const isOptionLine = (para: string) => /^[A-G]\s*[．.、]\s*\S/.test(para.trim());

/** 一行里连排的选项（"A. Pass on. B. Attack each other. C. Die away. D. Work together."）。 */
const isInlineOptionRun = (para: string) =>
  /^\s*A\s*[．.、]\s*\S/.test(para) && /\sB\s*[．.、]\s*\S/.test(para) && /\sC\s*[．.、]\s*\S/.test(para);

/** 选项「区块」：连续的 A、B… 行；单独一行 `A．` 可能是正文，要求至少 A+B 两行连排才认。 */
function optionRunAt(paras: string[], i: number): boolean {
  if (!isOptionLine(paras[i])) return false;
  const a = paras[i].trim()[0].toUpperCase();
  if (a !== "A") return false;
  // 同一段里连排（"A. x B. y C. z"）
  if (/\sB\s*[．.、]\s*\S/.test(paras[i])) return true;
  // 往后找最多 3 段内是否出现 B/C/D… 行（有的试卷把 A、B 排一行、C、D 排下一行）
  for (let k = i + 1; k < Math.min(i + 4, paras.length); k++) {
    const line = paras[k].trim();
    if (!line) continue;
    if (/^[B-G]\s*[．.、]\s*\S/.test(line)) return true;
    if (/\s[BCDEFG]\s*[．.、]\s*\S/.test(line)) return true;
    if (!isOptionLine(line)) break;
  }
  return false;
}

/** 截掉题目区：从第一个「题干段」或「选项区块」开始，后面全都不要。
 *  按行扫描而不是按空行分段 —— 有些 MDX 里题干/选项只用单个换行分隔，
 *  按空行切会把整片题目当成一段材料留下来。 */
function cutAtQuestionRegion(raw: string): { material: string; cutAt: number } {
  const lines = raw.split("\n");
  const optLine = (l: string) => /^[A-G]\s*[．.、]\s*\S/.test(l.trim());
  // 一位数 ASCII 句点题号（"1. How does the author…"）也算题干；限长度避免误伤正文列表
  const numberedQuestion = (l: string) => {
    const s = l.trim();
    if (/^[（(]\s*\d{1,3}\s*[）)]/.test(s)) return true;   // （2）xxx
    return /^\d{1,3}\s*[.．]\s+\S/.test(s) && s.length <= 160;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (isQuestionStart(line) || numberedQuestion(line)) {
      return { material: lines.slice(0, i).join("\n"), cutAt: i };
    }
    if (optLine(line)) {
      const next = lines.slice(i + 1).find((l) => l.trim());
      if ((next && optLine(next)) || /\sB\s*[．.、]\s*\S/.test(line)) {
        return { material: lines.slice(0, i).join("\n"), cutAt: i };
      }
    }
  }
  return { material: raw, cutAt: -1 };
}

/** 顶层切段：`# A` / `# B` 这类一级标题各算一段（`## 小标题` 不切）。
 *  一个题组里若有 `# A` + `# B` 两篇材料，两段都保留。 */
function splitTopSections(raw: string): string[] {
  const lines = raw.split("\n");
  const sections: string[][] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (/^#\s+\S/.test(line)) {
      if (cur.join("\n").trim()) sections.push(cur);
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.join("\n").trim()) sections.push(cur);
  return sections.map((s) => s.join("\n"));
}

/* --- 清洗 --------------------------------------------------------- */

/** 全角标点 → ASCII。只做「英文正文里出现过的」那些，另外 ﹣(U+FE63) 必须映射成连字符，
 *  否则 long﹣term 会变成两个词。 */
const FULLWIDTH_MAP: Array<[RegExp, string]> = [
  [/，/g, ","],
  [/．/g, "."],
  [/。/g, "."],
  [/：/g, ":"],
  [/；/g, ";"],
  [/？/g, "?"],
  [/！/g, "!"],
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
  [/[﹣－]/g, "-"],
  [/、/g, ","],
  [/（/g, "("],
  [/）/g, ")"],
  [/＄/g, "$"],
  [/…/g, "..."],
  [/～/g, "~"],
  [/　/g, " "],
];

const CJK_PAREN = /[(（]\s*[\u4e00-\u9fa5][\u4e00-\u9fa5\s、·]*\s*[)）]/g;

/** 去掉 markdown 图片与链接语法（选项里也可能整段是 ![](/exam-images/...) 这种图片选项，
 *  填答案时会被塞进正文，所以填完还要再清一遍）。 */
function stripMedia(t: string): string {
  let s = t;
  for (let i = 0; i < 3; i++) {
    s = s.replace(/!\[[^\]]*\]\((?:[^()]|\([^()]*\))*\)/g, " ");
  }
  s = s.replace(/!\[\s*\]\(\s*\)/g, " ").replace(/!\[\s*\]/g, " ");
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\[([^\[\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, "$1");
  }
  s = s.replace(/\]\s*\(\s*\)/g, " ").replace(/\[\s*\]\(\s*\)/g, " ");
  return s;
}

/** MDX / Markdown → 纯文本。按顺序做，别随意调换。 */
function cleanText(raw: string): string {
  let t = raw;

  // 1. 先把空位组件换成哨兵，避免后面被当组件删掉
  t = t.replace(COMP_CLOZE_BLANK, BLANK).replace(COMP_BLANK, BLANK);

  // 2. <br> → 换行（表格里靠它分行）
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/?(sup|sub)\s*>/gi, "");
  // 内嵌的普通 HTML 标签（<p> </p> <strong> <em> <span> <div> <u>）整对去掉
  // 允许带属性：<div class="joplin-table-wrapper">、<th colspan="2">
  t = t.replace(
    /<\/?(?:p|strong|em|span|div|u|b|i|table|thead|tbody|tfoot|tr|td|th|ul|ol|li|dl|dt|dd|h[1-6]|section|article|figure|figcaption|blockquote|center|font)(?:\s[^<>]*)?\/?>/gi,
    " ",
  );

  // 3. 图片整体删掉（alt 里常是「学科网(zxxk.com)版权所有」这类水印）
  //    URL 里可能带括号（维基媒体常见），所以允许多一层括号；空链接 ![]() 单独清。
  for (let i = 0; i < 3; i++) {
    t = t.replace(/!\[[^\]]*\]\((?:[^()]|\([^()]*\))*\)/g, "");
  }
  t = t.replace(/!\[\s*\]\(\s*\)/g, " ");
  t = t.replace(/!\[\s*\]/g, " ");

  // 4. 链接只留文字
  for (let i = 0; i < 3; i++) {
    t = t.replace(/\[([^\[\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, "$1");
  }
  t = t.replace(/\[\s*\]\(\s*\)/g, " ");
  //    库里有些表格是残缺 MDX（首行被截断），会留下 "…Programs**](https://…)  |" 这种尾巴
  t = t.replace(/\]\([^()]*\)/g, "");

  // 5. 裸 URL（含被空格拆散的 "www. xxx. com" 这类水印残渣交给第 14 步的行过滤）
  t = t.replace(/<?\bhttps?:\/\/[^\s)>\]]+/g, "");

  // 6. Markdown 表格：分隔行丢弃，其余每个单元格各成一行
  t = t
    .split("\n")
    .map((line) => {
      if (!line.trim().startsWith("|")) return line;
      const cells = line
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c && !/^:?-{2,}:?$/.test(c));
      return cells.join("\n");
    })
    .join("\n");
  //    残缺表格行可能只剩首尾竖线（分隔行被截断时），整行竖线去掉
  t = t.replace(/^[ \t]*\|+[ \t]*/gm, "").replace(/[ \t]*\|+[ \t]*$/gm, "");

  // 7. 标题符号、引用、列表符号
  //    `# A` / `# B` 这类「材料标签」整行丢掉（对语义没贡献，还会被当成正文首词）
  t = t.replace(/^#{1,6}\s+(?:[A-Z]|\d{1,2})\s*$/gm, "");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^\s*>\s?/gm, "");
  t = t.replace(/^\s*[-*•]\s+/gm, "");

  // 8. 转义字符 + 强调符号
  //    夹在字母之间的转义星号是「分词符」（Mandarin\*pronunciation），换成空格，
  //    否则去掉 * 之后两个词会粘成一个不存在的单词。
  t = t.replace(/([A-Za-z0-9])\\\*([A-Za-z0-9])/g, "$1 $2");
  t = t.replace(/\\([\\`*_{}\[\]()#+\-.!$>~])/g, "$1");
  t = t.replace(/\*\*/g, "");
  t = t.replace(/\*/g, "");
  // 下划线斜体只去「成对包单词」的（_Agent Cody Banks_ / __bold__），
  // 绝不能无脑删所有下划线：填空的 ___ 必须留到后面的残留检查里被抓出来。
  t = t.replace(/(^|[\s("“])__([^_\n]{1,120})__(?=$|[\s.,;:!?)"”])/gm, "$1$2");
  t = t.replace(/(^|[\s("“])_([^_\n]{1,120})_(?=$|[\s.,;:!?)"”])/gm, "$1$2");

  // 9. KaTeX：$$…$$ 一律删；$…$ 只在内部像公式（有 \ { ^ _）时才删，
  //    因为英文阅读里 $ 多半是价格（且库里价格多是转义后的 \$，第 8 步已还原成 $）。
  t = t.replace(/\$\$[\s\S]{0,400}?\$\$/g, " ");
  t = t.replace(/\$([^$\n]{1,120})\$/g, (m, inner: string) =>
    /[\\{^_]/.test(inner) ? " " : m,
  );

  // 10. 剩余 MDX 组件标签（<AnswerBox></AnswerBox> 之类壳子去掉、留内文）
  t = t.replace(/<\/?[A-Z][A-Za-z0-9]*(\s[^<>]*)?\/?>/g, " ");

  // 11. 中文注音括号：(脉搏) （逻辑） ( 光 催 化 )
  //     **换成空格**而不是删掉，否则 "the logic（逻辑）of" 会粘成 "logicof"。
  t = t.replace(CJK_PAREN, " ");
  t = t.replace(/[(（]\s*[\u4e00-\u9fa5][\u4e00-\u9fa5\s、·]*[)）]/g, " ");

  // 12. 全角标点
  for (const [re, to] of FULLWIDTH_MAP) t = t.replace(re, to);

  // 13. 逗号/分号/冒号后补空格（全角转过来时常缺）
  t = t.replace(/([,;:])(?=[A-Za-z])/g, "$1 ");

  // 14. 水印 / 站点垃圾：**只删水印本身，不整行丢**
  //     （有的题干和水印在同一行：「假设你是…写一篇短文。\[来源:学科网ZXXK\]」，
  //      整行丢会把题干也删掉，导致正文为空。）
  t = t
    .split("\n")
    .map((l) =>
      l
        .replace(/\[?\s*(?:来\s*源\s*[:：]\s*)?(?:学科网|zxxk)[^\]\n]*\]?/gi, " ")
        .replace(/版权所有/gi, " ")
        .trim(),
    )
    .filter((l) => !/^[\s|:_-]*$/.test(l))
    .join("\n");

  // 15. 压缩空白
  t = t.replace(/[ \t\u00a0]+/g, " ").replace(/ ?\n ?/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");

  // 16. 正文里的空位两侧保留一个空格，填答案时才自然（空格整理统一交给 tidy()）
  return tidy(t.replace(new RegExp(`[ \\t]*${BLANK}[ \\t]*`, "g"), ` ${BLANK} `));
}

/** 空白收尾：标点前不留空格、逗号句号后补空格、行首行尾不留空白、压缩空行。
 *  填完答案后要再跑一次（"Shaken , but" → "Shaken, but"）。 */
function tidy(text: string): string {
  return text
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])(?=[A-Za-z])/g, "$1 ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* --- 答案解析 ----------------------------------------------------- */

const isLetter = (s: string) => /^[A-Ga-g]$/.test(s);

/** 把某题的 answer 解析成「要填进空里的文本」。
 *  真实数据里答案全是单个字母（cloze/七选五 8928 条全部 A–G），
 *  但仍兼容答案直接写选项文本、或写 "##" 多答案的写法。 */
function resolveAnswerText(q: SubQuestion): { text: string; via: string } {
  const ans = q.answer.trim();
  if (!ans) return { text: "", via: "empty" };
  if (q.options.length === 0) return { text: ans, via: "raw-answer-no-options" };
  if (isLetter(ans)) {
    const hit = q.options.find((o) => o.key.toUpperCase() === ans.toUpperCase());
    if (hit) return { text: hit.text, via: `option-${hit.key}` };
    return { text: "", via: `option-${ans}-missing` };
  }
  const exact = q.options.find((o) => o.text.toLowerCase() === ans.toLowerCase());
  if (exact) return { text: exact.text, via: "answer-is-option-text" };
  // "A##B" 这类多写法：取第一个能对上选项的字母
  const letter = ans.match(/[A-Ga-g]/);
  if (letter) {
    const hit = q.options.find((o) => o.key.toUpperCase() === letter[0].toUpperCase());
    if (hit) return { text: hit.text, via: `option-${hit.key}-from-multi` };
  }
  return { text: ans, via: "raw-answer" };
}

/* --- 三种题型的正文抽取 ------------------------------------------- */

export type Strategy =
  | "reading-material"
  | "cloze-fill"
  | "seven-choose-five-fill"
  | "writing-prompt"
  | "generic-material";

interface ExtractResult {
  body: string;
  strategy: Strategy;
  /** 抽正文过程里的诊断信息，直接打到终端 */
  notes: string[];
  fill?: { blanks: number; filled: number; details: string[] };
}

/** 阅读理解 / 阅读表达：按 `# X` 切段，每段截掉题目区，剩下的材料拼起来。 */
function extractReading(raw: string): ExtractResult {
  const notes: string[] = [];
  const sections = splitTopSections(raw);
  const parts: string[] = [];
  let cut = 0;
  for (const sec of sections) {
    const { material, cutAt } = cutAtQuestionRegion(sec);
    if (cutAt >= 0) cut++;
    if (material.trim()) parts.push(material);
  }
  notes.push(`顶层材料段 ${sections.length} 个，其中 ${cut} 段截掉了题目区`);
  const body = cleanText(parts.join("\n\n"));
  return { body, strategy: "reading-material", notes };
}

/** 完形填空：第 n 个空 ↔ orderIndex 第 n 个子题，把答案填回原文。 */
function extractCloze(raw: string, items: SubQuestion[]): ExtractResult {
  const notes: string[] = [];
  const blankCount = (raw.match(COMP_CLOZE_BLANK) || []).length;
  const details: string[] = [];
  let body = cleanText(raw);
  let blanks = 0;

  if (blankCount > 0) {
    blanks = blankCount;
    let i = 0;
    body = body.replace(new RegExp(BLANK, "g"), () => {
      const q = items[i];
      const r = q ? resolveAnswerText(q) : { text: "", via: "no-question" };
      details.push(`空 ${i + 1} → 题 orderIndex=${q?.orderIndex ?? "-"} answer=${q?.answer ?? "-"} = ${r.text || "(空!)"} [${r.via}]`);
      i++;
      return r.text || BLANK;
    });
    notes.push(`<ClozeBlank> 空位 ${blanks} 个，子题 ${items.length} 个`);
    if (items.length > blanks) {
      notes.push(`注意：子题比空位多 ${items.length - blanks} 个，多出的子题没被用到（可能是数据多挂或题干里还有空没标组件）`);
    }
  } else {
    // 极少数题组不用组件，而是裸题号（如 36 … 55）当空位，这里做严格兜底：
    // 只有在「连续递增、且个数正好等于子题数」时才认，否则报错。
    const numBlanks = findNumberedBlanks(raw, items.length);
    if (!numBlanks) {
      die(
        1,
        `[extract] 完形填空没有任何 <ClozeBlank></ClozeBlank>，也没找到 ${items.length} 个连续递增的裸题号空位；` +
          `拒绝产出半成品。请先确认该题组 content 的真实格式：\n${raw.slice(0, 400)}`,
      );
    }
    blanks = numBlanks.length;
    notes.push(`没有组件空位，改用裸题号空位：${numBlanks.join(", ")}`);
    let idx = 0;
    body = body.replace(/\b\d{2}\b/g, (m) => {
      if (idx < numBlanks.length && Number(m) === numBlanks[idx]) {
        const q = items[idx];
        const r = q ? resolveAnswerText(q) : { text: "", via: "no-question" };
        details.push(`空 ${idx + 1}(${m}) → orderIndex=${q?.orderIndex ?? "-"} answer=${q?.answer ?? "-"} = ${r.text || "(空!)"} [${r.via}]`);
        idx++;
        return r.text || BLANK;
      }
      return m;
    });
  }

  return { body, strategy: "cloze-fill", notes, fill: { blanks, filled: details.length, details } };
}

/** 在原文里找「连续递增的两位裸题号」，个数必须正好等于 expect。 */
function findNumberedBlanks(raw: string, expect: number): number[] | null {
  if (expect <= 0) return null;
  const nums = [...raw.matchAll(/(?<![\dA-Za-z])(\d{2})(?![\dA-Za-z])/g)].map((m) => Number(m[1]));
  for (let start = 0; start < nums.length; start++) {
    const run: number[] = [nums[start]];
    for (let k = start + 1; k < nums.length && run.length < expect; k++) {
      if (nums[k] === run[run.length - 1] + 1) run.push(nums[k]);
      else break;
    }
    if (run.length === expect) return run;
  }
  return null;
}

/** 七选五：第 n 个空 ↔ orderIndex 第 n 个子题，答案字母 → 该题选项里的句子。 */
function extractScf(raw: string, items: SubQuestion[]): ExtractResult {
  const notes: string[] = [];
  const blanks = (raw.match(COMP_BLANK) || []).length;
  const details: string[] = [];
  let body = cleanText(raw);

  // 有些卷子把 A–G 选项框留在小组 content 末尾；这里兜底用「全体子题选项的并集」查字母
  const union = new Map<string, string>();
  for (const q of items) for (const o of q.options) union.set(o.key.toUpperCase(), o.text);

  let i = 0;
  body = body.replace(new RegExp(BLANK, "g"), () => {
    const q = items[i];
    let text = "";
    let via = "none";
    if (q) {
      const r = resolveAnswerText(q);
      if (r.text) {
        text = r.text;
        via = r.via;
      } else if (isLetter(q.answer) && union.has(q.answer.toUpperCase())) {
        text = union.get(q.answer.toUpperCase())!;
        via = `union-${q.answer.toUpperCase()}`;
      }
    }
    details.push(`空 ${i + 1} → orderIndex=${q?.orderIndex ?? "-"} answer=${q?.answer ?? "-"} = ${text || "(空!)"} [${via}]`);
    i++;
    return text || BLANK;
  });

  notes.push(`<Blank> 空位 ${blanks} 个，子题 ${items.length} 个`);
  if (union.size) notes.push(`子题选项字母并集 ${union.size} 个（A–G）`);
  return { body, strategy: "seven-choose-five-fill", notes, fill: { blanks, filled: details.length, details } };
}

/** 其他题型（grammar / word-choice / en-writing…）：能抽就抽，抽不出来就报错，不猜。 */
/** 作文题：保留中文写作要求 + 英文材料，砍掉末尾的「注意/提示词」评分说明。
 *  这类题没有英文长文，靠 LLM 从中文要求里读主题再出英文检索词。 */
function extractWriting(raw: string, title = ""): ExtractResult {
  const body = cleanText(raw);
  const cutMatch = body.match(/\n\s*(?:注意|提示词|要求)\s*[:：]/);
  let kept = cutMatch && cutMatch.index !== undefined ? body.slice(0, cutMatch.index) : body;
  // 有的题干极短（"请给 Jim 回一封邮件" + 注意：…），截完就没什么内容了 → 保留全文
  let cjk = (kept.match(/[\u4e00-\u9fa5]/g) || []).length;
  if (cjk < 30 && cutMatch) {
    kept = body;
    cjk = (kept.match(/[\u4e00-\u9fa5]/g) || []).length;
  }
  // 题干太短时（正文常在图片里），把题组标题补进去——标题往往就是写作话题，
  // 例：《介绍中国生肖》的 content 只有「请给 Jim 回一封邮件」。
  if (cjk < 30 && title.trim()) {
    kept = `${title.trim()}\n\n${kept}`;
  }
  return {
    body: tidy(kept),
    strategy: "writing-prompt",
    notes: [
      "作文题：保留中文写作要求与英文材料，截掉「注意/提示词」等评分说明",
      "英文词数门槛不适用，改用汉字数校验（LLM 会自己把中文主题翻成英文检索词）",
    ],
  };
}

function extractGeneric(raw: string): ExtractResult {
  const { material } = cutAtQuestionRegion(raw);
  return {
    body: cleanText(material.trim() ? material : raw),
    strategy: "generic-material",
    notes: ["该题型未做专门处理，按「截掉题目区 + 通用清洗」处理"],
  };
}

function extractBody(questionType: string, raw: string, items: SubQuestion[], title = ""): ExtractResult {
  let r: ExtractResult;
  if (CLOZE_TYPES.has(questionType)) r = extractCloze(raw, items);
  else if (SCF_TYPES.has(questionType)) r = extractScf(raw, items);
  else if (WRITING_TYPES.has(questionType)) {
    r = extractWriting(raw, title);
    // 作文题干里的「＿＿＿＿＿」是回信模板里的空，对找封面没意义
    r = { ...r, body: r.body.replace(/_{2,}/g, " ").replace(/＿{2,}/g, " ") };
  }
  else if (READING_TYPES.has(questionType)) {
    r = extractReading(raw);
    // 正文抽出来太短（材料在图片/表格里）时，把题组标题补进去当话题线索
    const w = (r.body.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
    if (w < 40 && title.trim()) r = { ...r, body: `${title.trim()}\n\n${r.body}` };

    // 阅读材料里可能带「＿＿＿＿」填空（阅读表达/完形式阅读），对找封面没意义，当空格处理。
    r = { ...r, body: r.body.replace(/_{2,}/g, " ").replace(/＿{2,}/g, " ") };
  } else r = extractGeneric(raw);
  // 填答案会引入新的空格问题（"Shaken ,"），出口统一再整理一次；
  // 图片选项填进正文后也会带 ![]() ，这里再清一遍。
  const filled = stripMedia(r.body).replace(
    /<\/?(?:p|strong|em|span|div|u|b|i|sup|sub|table|thead|tbody|tfoot|tr|td|th|ul|ol|li|dl|dt|dd|h[1-6]|section|article|figure|figcaption|blockquote|center|font|br)(?:\s[^<>]*)?\s*\/?>/gi,
    " ",
  );
  return { ...r, body: tidy(filled) };
}

/* --- 校验（写死，不许放宽） ---------------------------------------- */

const RESIDUAL_CHECKS: Array<{ name: string; re: RegExp }> = [
  { name: "下划线占位符 ___", re: /_{2,}/g },
  // 只查行首的题号；正文里的 "TWO (2) GUMMIES"、"six (6) months" 属正常表述，不能算残留
  { name: "全角题号 （1）", re: /^[ \t]*[（(]\s*\d{1,2}\s*[）)]/gm },
  { name: "圈号 ①②③", re: /[\u2460-\u2473]/g },
  // 正文里的「A. I. (artificial intelligence)」不能算残留选项：排除 A. I./B. I. 这类
  // 正文里的「A. J. Hayes」这种人名缩写不算选项：排除「X. Y.」单字母缩写
  { name: "选项行 A．/B.", re: /^[A-G]\s*[．.、]\s+(?![A-Z]\.\s)/gm },
  { name: "MDX 标题 #", re: /^#{1,6}\s/gm },
  { name: "MDX 组件 <X>", re: /<\/?[A-Za-z][A-Za-z0-9]*(\s[^<>]*)?\/?>/g },
  { name: "图片 ![]()", re: /!\[[^\]]*\]\(/g },
  { name: "链接 [](…)", re: /\[[^\]]*\]\(/g },
  // 注意：英文阅读里的 $ 多半是价格（"$10 an hour"），不能一律当 KaTeX 残留；
  // 只查「$$ 块 / LaTeX 命令 / 带 ^ _ 的行内公式」这三种真公式形态。
  { name: "KaTeX $$ 块", re: /\$\$/g },
  { name: "LaTeX 命令（\\frac 之类）", re: /\\[a-zA-Z]{2,}/g },
  { name: "KaTeX 行内公式（含 ^ _）", re: /\$[^$\n]{0,120}?[\^_][^$\n]{0,120}?\$/g },
  { name: "没填上的空位", re: new RegExp(BLANK, "g") },
  { name: "七选五选项框原文", re: /^\s*[A-G]\s*[.．]\s+.{0,80}$/gm },
];

function countWords(text: string): number {
  return (text.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
}

function countCjk(text: string): number {
  return (text.match(/[\u4e00-\u9fa5]/g) || []).length;
}

interface ValidationReport {
  ok: boolean;
  words: number;
  cjk: number;
  chars: number;
  rows: Array<{ name: string; count: number; samples: string[] }>;
  problems: string[];
}

function validate(result: ExtractResult, questionType: string): ValidationReport {
  const { body } = result;
  const problems: string[] = [];
  // 作文题干的「（1）…（4）」常是四幅图的顺序说明，不是残留题号，这类题型跳过该项。
  const checks = RESIDUAL_CHECKS.filter((c) => {
    if (WRITING_TYPES.has(questionType) && c.name.includes("全角题号")) return false;
    // 阅读材料（尤其诗歌）常用 ①②③ 做注释标记，属正文
    if (READING_TYPES.has(questionType) && c.name.includes("圈号")) return false;
    return true;
  });
  const rows = checks.map((c) => {
    const m = body.match(c.re) || [];
    // 例子里把控制字符（空位哨兵 \u0001）显示成 <BLANK>，否则终端看不出是什么
    const samples = [...new Set(m.map((s) => s.replace(new RegExp(BLANK, "g"), "<BLANK>").replace(/\s+/g, " ").trim()))].slice(0, 3);
    return { name: c.name, count: m.length, samples };
  });
  for (const r of rows) {
    if (r.count > 0) problems.push(`残留 ${r.name} ×${r.count}${r.samples.length ? `（例：${r.samples.join(" / ")}）` : ""}`);
  }

  // 空没填满 —— 这是最要命的一条：必须有空位、且填满
  if (result.fill) {
    if (result.fill.blanks === 0) problems.push("没有识别到任何空位（完形/七选五必须至少 1 个空）");
    if (result.fill.blanks !== result.fill.filled) {
      problems.push(`空位 ${result.fill.blanks} 个但只填了 ${result.fill.filled} 个`);
    }
    const emptyFill = result.fill.details.filter((d) => d.includes("(空!)"));
    if (emptyFill.length) problems.push(`有 ${emptyFill.length} 个空解析不出答案文本：${emptyFill.join("; ")}`);
  }

  const words = countWords(body);
  const cjk = countCjk(body);
  // 中文题干类（作文）英文本来就少，改看汉字数；其余题型仍要求足够英文正文。
  if (WRITING_TYPES.has(questionType)) {
    // 中英混排很常见（中文要求 + 英文广告/信件），合计够 30 个词/字就算可用；
    // 题目里已有中文标题（≥4 字）时视为话题明确（标题通常就是写作话题），不再卡长度。
    const hasTitleTopic = /[\u4e00-\u9fa5]{4,}/.test(result.notes.join(" ")) || (result.body.match(/[\u4e00-\u9fa5]/g) || []).length >= 8;
    if (cjk + words < 30 && !hasTitleTopic) {
      problems.push(`作文题干只有 ${cjk} 个汉字 + ${words} 个英文词，合计不足 30，视为抽取失败`);
    }
  } else if (words < MIN_WORDS) {
    // 阅读材料可能是表格/听力表格（文字很少），但题组标题本身能说明话题（如《旅游景点广告》）——
    // 这类只要标题有 ≥4 个汉字就放行，正文交给「标题补上下文」那条规则。
    const titleTopic = /[\u4e00-\u9fa5]{4,}/.test(body.split("\n")[0] || "");
    if (!titleTopic) problems.push(`英文词数 ${words} < ${MIN_WORDS}，视为抽取失败`);
  }
  if (/cloze|seven-choose-five/.test(questionType) && words < 100) {
    problems.push(`完形/七选五 词数只有 ${words}，看起来把文章抽丢了`);
  }

  return { ok: problems.length === 0, words, cjk, chars: body.length, rows, problems };
}

/* ------------------------------------------------------------------ */
/* 3) 调 article-cover                                                  */
/* ------------------------------------------------------------------ */

interface Cover {
  relevance_score: number;
  image_url: string;
  thumbnail_url?: string;
  source_url?: string;
  photographer?: string;
  description?: string;
  width?: number;
  height?: number;
  license?: string;
  license_url?: string;
  attribution?: string;
  matched_queries?: string[];
}

interface CoverResult {
  article_analysis?: { main_topic?: string; search_queries?: string[] };
  covers?: Cover[];
  meta?: {
    analysis_method?: string;
    clip_used?: boolean;
    elapsed_seconds?: number;
    warnings?: string[];
    provider_issues?: unknown;
  };
  error?: string;
}

function ensureCacheDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function runArticleCover(bodyFile: string, jsonFile: string) {
  const args = [COVER_MAIN, "--file", bodyFile, "--output", jsonFile];
  if (maxResults !== 5) args.push("--max-results", String(maxResults));
  if (noClip) args.push("--no-clip");
  if (noCache) args.push("--no-cache");

  console.log(`\n[3] 调用 article-cover（只读，不改它的任何文件）`);
  console.log(`    ${COVER_PYTHON} ${args.join(" ")}`);
  console.log(`    单篇约 20–30s，请稍等…`);

  const t0 = Date.now();
  const r = spawnSync(COVER_PYTHON, args, {
    encoding: "utf8",
    timeout: COVER_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (r.error) die(2, `[cover] 无法执行 article-cover：${r.error.message}`);
  if (r.status !== 0) {
    die(
      2,
      `[cover] article-cover 退出码 ${r.status}（耗时 ${elapsed}s）`,
      `stdout: ${(r.stdout || "").slice(-2000)}`,
      `stderr: ${(r.stderr || "").slice(-2000)}`,
    );
  }
  if (!fs.existsSync(jsonFile)) die(2, `[cover] 预期结果文件不存在：${jsonFile}`);
  console.log(`    完成：${elapsed}s → ${jsonFile}`);
}

function printCoverResult(res: CoverResult) {
  const meta = res.meta ?? {};
  const covers = res.covers ?? [];
  console.log(`\n[cover] meta`);
  console.log(`  analysis_method : ${meta.analysis_method ?? "-"}`);
  console.log(`  clip_used       : ${meta.clip_used ?? "-"}`);
  console.log(`  elapsed_seconds : ${meta.elapsed_seconds ?? "-"}`);
  console.log(`  warnings        : ${(meta.warnings ?? []).length === 0 ? "(无)" : JSON.stringify(meta.warnings)}`);
  if (meta.provider_issues) {
    const s = JSON.stringify(meta.provider_issues);
    console.log(`  provider_issues : ${s.length > 400 ? s.slice(0, 400) + "…" : s}`);
  }
  console.log(`  covers.length   : ${covers.length}`);
  if (res.article_analysis?.main_topic) {
    console.log(`  main_topic      : ${res.article_analysis.main_topic}`);
  }

  if (!covers.length) {
    console.log(`\n[cover] 没有拿到任何封面候选（阈值内无图）。`);
    return;
  }
  console.log(`\n[cover] 候选（按 relevance_score 降序）`);
  covers.forEach((c, i) => {
    const score = (c.relevance_score ?? 0).toFixed(3);
    const size = `${c.width ?? "?"}×${c.height ?? "?"}`;
    const desc = (c.description ?? "").replace(/\s+/g, " ").slice(0, 70);
    console.log(`  #${i + 1}  ${score}  ${size}  ${c.license ?? "?"}  ${c.photographer ?? "-"}  ${desc}`);
    console.log(`      ${c.image_url}`);
  });
}

/* ------------------------------------------------------------------ */
/* 4) 写回封面（默认 dry-run）                                          */
/* ------------------------------------------------------------------ */

/** best = article-cover 返回列表的第一张。
 *  注意不要改成「按 relevance_score 取最大」：排序里还有「主体+动作双命中」这道闸门，
 *  列表顺序才是最终结论（分数高的可能是「只有跑者没有盲人」的图）。 */
function resolveWriteIndex(covers: Cover[], target: "best" | number): number {
  return target === "best" ? 1 : target;
}

async function writeBack(id: string, current: string | null, covers: Cover[], target: "best" | number) {
  const n = resolveWriteIndex(covers, target);
  if (n > covers.length) {
    die(2, `[write] 只有 ${covers.length} 张封面候选，取不到第 ${n} 张。`);
  }
  const cover = covers[n - 1];
  const url = cover.image_url;
  if (!url) die(2, `[write] 第 ${n} 张封面没有 image_url。`);

  const sql = `UPDATE "QuestionGroup" SET "imageUrl" = ${lit(url)}, "updatedAt" = now() WHERE id = ${lit(id)};`;
  console.log(`\n[4] 写回封面（${target === "best" ? "默认 = 列表第 1 张" : "指定"} → 第 ${n} 张，共 ${covers.length} 张候选）`);
  console.log(`  当前 imageUrl : ${current ?? "(NULL)"}`);
  console.log(`  写入 imageUrl : ${url}`);
  console.log(`  对比          : ${current === url ? "无变化" : current ? "覆盖旧值" : "NULL → 有值"}`);
  console.log(`  ${apply ? "执行 SQL" : "dry-run SQL"} :`);
  console.log(`  ${sql}`);

  // 保留前 N 张候选，方便以后人工换封面（不写库，只落盘）
  const top = covers.slice(0, keepTop).map((c, i) => ({
    rank: i + 1,
    relevance_score: c.relevance_score,
    image_url: c.image_url,
    thumbnail_url: c.thumbnail_url,
    width: c.width,
    height: c.height,
    description: c.description,
    photographer: c.photographer,
    source_url: c.source_url,
    license: c.license,
    license_url: c.license_url,
    attribution: c.attribution,
    matched_queries: c.matched_queries,
    selected: i + 1 === n,
  }));
  const candidatesFile = path.join(CACHE_DIR, `${id}.candidates.json`);
  fs.writeFileSync(
    candidatesFile,
    JSON.stringify({ groupId: id, written: url, writtenRank: n, keepTop, candidates: top }, null, 2) + "\n",
    "utf8",
  );
  console.log(`  保留前 ${top.length} 张候选 → ${candidatesFile}`);
  console.log(`  换封面用：npx tsx scripts/cover-from-group.ts --group ${id} --write <序号> --apply`);

  if (!apply) {
    console.log(`\n  这是 dry-run，没有改库。要真正写入请加 --apply：`);
    console.log(`  npx tsx scripts/cover-from-group.ts --group ${id} --write ${n} --apply`);
    return;
  }

  await prisma.questionGroup.update({ where: { id }, data: { imageUrl: url } });
  const after = await prisma.questionGroup.findUnique({ where: { id }, select: { imageUrl: true, updatedAt: true } });
  if (after?.imageUrl !== url) die(2, `[write] UPDATE 后核对失败：库里是 ${after?.imageUrl}`);
  console.log(`  ✔ 已写库并核对：imageUrl = ${after?.imageUrl}（updatedAt=${after?.updatedAt?.toISOString()}）`);
}

function lit(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const { group, items } = await loadGroup(groupId!);

  console.log(`[1] 题组 ${group.id}`);
  console.log(`    title=${group.title}  type=${group.questionType}  subject=${group.subject}  grade=${group.grade ?? "-"}`);
  console.log(`    现 imageUrl=${group.imageUrl ?? "(NULL)"}  content ${group.content.length} 字符  子题 ${items.length} 个`);
  for (const q of items.slice(0, 12)) {
    console.log(
      `      #${q.orderIndex} ${q.id} type=${q.questionType} answer=${q.answer || "(空)"} options=${q.options.map((o) => o.key).join("")} | ${q.content.replace(/\s+/g, " ").slice(0, 60)}`,
    );
  }
  if (items.length > 12) console.log(`      …（还有 ${items.length - 12} 个子题）`);

  const result = extractBody(group.questionType, group.content, items, group.title);

  console.log(`\n[2] 裸正文（strategy=${result.strategy}）`);
  for (const n of result.notes) console.log(`    · ${n}`);
  if (result.fill) {
    for (const d of result.fill.details) console.log(`    · ${d}`);
  }

  const report = validate(result, group.questionType);
  console.log(`\n    词数（英文）: ${report.words}    汉字数: ${report.cjk}`);
  console.log(`    字符数      : ${report.chars}`);
  console.log(`    前 ${showBody} 字符:`);
  console.log("---8<---");
  console.log(showBody > 0 ? result.body.slice(0, showBody) : "(--show-body 0)");
  console.log("---8<---");

  console.log(`\n[校验] 残留检查（全部必须为 0）`);
  for (const r of report.rows) {
    const mark = r.count === 0 ? "ok  " : "FAIL";
    console.log(`  ${mark} ${r.name}: ${r.count}${r.samples.length ? `  例：${r.samples.join(" / ")}` : ""}`);
  }

  if (!report.ok) {
    die(
      1,
      `\n[校验] 失败，拒绝继续（不会产出半成品，也不会写库）：\n  - ` + report.problems.join("\n  - "),
    );
  }
  console.log(`[校验] 通过 ✔`);

  ensureCacheDir();
  const bodyFile = path.join(CACHE_DIR, `${group.id}.txt`);
  const jsonFile = path.join(CACHE_DIR, `${group.id}.json`);
  fs.writeFileSync(bodyFile, result.body.endsWith("\n") ? result.body : result.body + "\n", "utf8");
  console.log(`\n    裸正文已写入：${bodyFile}`);

  if (extractOnly) {
    console.log(`\n(--extract-only：跳过 article-cover 与写库)`);
    if (writeTarget !== undefined) console.log(`  注意：--write 需要封面结果，本次忽略。`);
    return;
  }

  if (!reuseJson || !fs.existsSync(jsonFile)) {
    runArticleCover(bodyFile, jsonFile);
  } else {
    console.log(`\n[3] --reuse-json：复用已有结果 ${jsonFile}`);
  }

  let res: CoverResult;
  try {
    res = JSON.parse(fs.readFileSync(jsonFile, "utf8")) as CoverResult;
  } catch (e) {
    die(2, `[cover] 结果 JSON 解析失败：${(e as Error).message}`);
  }
  if (res.error) die(2, `[cover] article-cover 返回 error：${res.error}`);

  printCoverResult(res);

  if (writeTarget !== undefined) {
    await writeBack(group.id, group.imageUrl, res.covers ?? [], writeTarget);
  } else {
    console.log(`\n[4] --no-write：不写库（也没有保留候选清单）。`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(2);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  });
