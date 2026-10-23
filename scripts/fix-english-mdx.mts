/**
 * 英语题面 MDX 安全化：把 PDF→MD 留下的裸 HTML（表格/列表/br/裸 < >）转成可渲染的 MDX。
 *
 * - <table>…</table> → markdown 表格
 * - <ul><li>…</li></ul> → markdown 列表
 * - <br> 在表格行里 → <br />，其它地方 → 换行
 * - <https://…> 自动链接 → [url](url)（URL 里的空格去掉）
 * - 其它标签去掉；裸 < > 转 $<$ / $>$；{ } 转义
 * 只在该字段能 serialize 通过时才写库。
 *
 * 用法：npx tsx scripts/fix-english-mdx.ts [--dry-run] [--subject 英语]
 */
import "dotenv/config";
import { serialize } from "next-mdx-remote/serialize";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const mdxOptions = { remarkPlugins: [remarkGfm, remarkMath], rehypePlugins: [rehypeKatex] };
const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const dry = process.argv.includes("--dry-run");

function tableToMd(block: string): string {
  const rows = [...block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  if (!rows.length) return block.replace(/<[^>]+>/g, "");
  const parsed = rows.map((r) =>
    [...r.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) =>
      c[1].replace(/<br\s*\/?>/gi, "<br />").replace(/<[^>]+>/g, "").replace(/\|/g, "\\|").trim()
    )
  );
  const width = Math.max(...parsed.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  const head = pad(parsed[0]);
  const lines = [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`];
  for (const r of parsed.slice(1)) lines.push(`| ${pad(r).join(" | ")} |`);
  return lines.join("\n");
}

export function fixText(input: string): string {
  if (!input) return input;
  let t = input;
  // 自动链接 <https://…>（URL 里可能有空格）
  t = t.replace(/<(https?:\/\/[^<>]+)>/gi, (_m, url: string) => {
    const clean = url.replace(/\s+/g, "");
    return `[${clean}](${clean})`;
  });
  t = t.replace(/<table[\s\S]*?<\/table>/gi, (b) => tableToMd(b));
  t = t.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (b) =>
    [...b.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => "- " + m[1].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").trim())
      .join("\n")
  );
  // 表格行内的 <br> 保留成 <br />；其它 <br> 当换行
  t = t.split("\n").map((ln) =>
    ln.trimStart().startsWith("|")
      ? ln.replace(/<br\s*\/?>/gi, "<br />")
      : ln.replace(/<br\s*\/?>/gi, "\n")
  ).join("\n");
  // 保留自定义组件标签
  const keep: string[] = [];
  t = t.replace(/<\/?(?:Dot|U|Center|RightAlign|Input2?|Superscript|Blank|ClozeBlank)\s*\/?>/g, (m) => {
    keep.push(m);
    return `@@KEEP${keep.length - 1}@@`;
  });
  t = t.replace(/<\/?[a-zA-Z][^>]*>/g, "");        // 其它标签去掉，文字保留
  t = t.replace(/</g, "$<$").replace(/>/g, "$>$");
  t = t.replace(/\\+(?=[{}])/g, "");
  t = t.replace(/\{/g, "\\{").replace(/\}/g, "\\}");
  t = t.replace(/@@KEEP(\d+)@@/g, (_m, i: string) => keep[Number(i)]);
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

async function ok(text: string) {
  try {
    await serialize(text, { mdxOptions });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const subject = arg("subject", "英语");
  const groups = await prisma.questionGroup.findMany({
    where: { subject },
    select: { id: true, title: true, content: true },
  });
  let gFixed = 0, qFixed = 0, stillBad: string[] = [];
  for (const g of groups) {
    if (!g.content) continue;
    if (await ok(g.content)) continue;
    const fixed = fixText(g.content);
    if (!(await ok(fixed))) {
      stillBad.push(`group ${g.title}`);
      continue;
    }
    if (!dry) await prisma.questionGroup.update({ where: { id: g.id }, data: { content: fixed } });
    gFixed++;
  }
  const qs = await prisma.question.findMany({
    where: { subject },
    select: { id: true, content: true, analysis: true, options: true },
  });
  for (const q of qs) {
    const fields: Record<string, string> = {};
    if (q.content && !(await ok(q.content))) fields.content = fixText(q.content);
    if (q.analysis && !(await ok(q.analysis))) fields.analysis = fixText(q.analysis);
    const opts = (q.options as { id: string; label: string }[] | null) || [];
    if (opts.length) {
      let changed = false;
      const next = opts.map((o) => {
        const label = String(o.label || "");
        if (label && !label.includes("<") && !label.includes("{")) return o;
        return { ...o, label };
      });
      // 选项里带标签的情况：逐个校验
      const badIdx: number[] = [];
      for (let i = 0; i < opts.length; i++) {
        const label = String(opts[i].label || "");
        if (label && (label.includes("<") || label.includes("{")) && !(await ok(label))) badIdx.push(i);
      }
      if (badIdx.length) {
        for (const i of badIdx) next[i] = { ...next[i], label: fixText(String(opts[i].label || "")) };
        changed = true;
      }
      if (changed) fields.options = JSON.stringify(next);
    }
    if (!Object.keys(fields).length) continue;
    if (dry) { qFixed++; continue; }
    await prisma.question.update({
      where: { id: q.id },
      data: {
        ...(fields.content ? { content: fields.content } : {}),
        ...(fields.analysis ? { analysis: fields.analysis } : {}),
        ...(fields.options ? { options: JSON.parse(fields.options) as unknown as object } : {}),
      },
    });
    qFixed++;
  }
  console.log(`英语安全化：题组修复 ${gFixed} 个，题目修复 ${qFixed} 道${dry ? "（dry-run）" : ""}`);
  if (stillBad.length) console.log("仍无法渲染：", stillBad.slice(0, 10));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
