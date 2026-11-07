/**
 * 把已经跑过封面的题组汇总成一个静态审阅页（给人工看效果、换封面用）。
 *
 * 数据来源（都由 cover-from-group.ts 产出，已被 .gitignore 忽略）：
 *   .cache/cover/<groupId>.candidates.json  前 N 张候选（含 selected 标记）
 *   .cache/cover/<groupId>.json             article-cover 完整结果
 *
 * 用法（仓库根）：
 *   npx tsx scripts/cover-gallery.ts --groups id1,id2,id3 [--out .cache/cover/gallery]
 *   npx tsx scripts/cover-gallery.ts --all          # 扫 .cache/cover/*.candidates.json
 *
 * 产物：<out>/index.html（缩略图直接引远程 URL，不落地图片）
 * 起服务看效果：python3 -m http.server 8123 --bind 0.0.0.0 --directory .cache/cover/gallery
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const REPO_ROOT = fs.existsSync(path.join(process.cwd(), "prisma", "schema.prisma"))
  ? process.cwd()
  : "/home/gxwtf/gxexercise";
const CACHE_DIR = path.join(REPO_ROOT, ".cache", "cover");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const TYPE_LABEL: Record<string, string> = {
  "en-reading": "阅读",
  "reading-expression": "阅读表达",
  cloze: "完形填空",
  "seven-choose-five": "七选五",
  "en-writing": "作文",
  grammar: "语法填空",
  "word-choice": "选词填空",
};

interface CandidateFile {
  groupId: string;
  written: string;
  writtenRank: number;
  candidates: Array<{
    rank: number;
    relevance_score: number;
    image_url: string;
    thumbnail_url?: string;
    width?: number;
    height?: number;
    description?: string;
    photographer?: string;
    source_url?: string;
    license?: string;
    attribution?: string;
    matched_queries?: string[];
    selected?: boolean;
  }>;
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  const outDir = path.resolve(REPO_ROOT, arg("out") ?? path.join(".cache", "cover", "gallery"));
  let ids: string[] = [];
  if (has("all")) {
    ids = fs
      .readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith(".candidates.json"))
      .map((f) => f.replace(/\.candidates\.json$/, ""));
  } else {
    ids = (arg("groups") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!ids.length) {
    console.error("缺 --groups id1,id2 或 --all");
    process.exit(2);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const sections: string[] = [];
  for (const id of ids) {
    const candPath = path.join(CACHE_DIR, `${id}.candidates.json`);
    if (!fs.existsSync(candPath)) {
      console.warn(`跳过 ${id}：没有 ${candPath}`);
      continue;
    }
    const cand = JSON.parse(fs.readFileSync(candPath, "utf8")) as CandidateFile;
    const group = await prisma.questionGroup.findUnique({
      where: { id },
      select: { title: true, questionType: true, source: true, grade: true, subject: true, imageUrl: true },
    });
    const resPath = path.join(CACHE_DIR, `${id}.json`);
    let mainTopic = "";
    let meta: Record<string, unknown> = {};
    if (fs.existsSync(resPath)) {
      const res = JSON.parse(fs.readFileSync(resPath, "utf8"));
      mainTopic = res?.article_analysis?.main_topic ?? "";
      meta = res?.meta ?? {};
    }
    const typeLabel = TYPE_LABEL[group?.questionType ?? ""] ?? group?.questionType ?? "?";
    const current = group?.imageUrl ?? "";
    const picked = cand.candidates.find((c) => c.selected) ?? cand.candidates[0];

    const cards = cand.candidates
      .map((c) => {
        const isSel = c.selected;
        const thumb = c.thumbnail_url || c.image_url;
        return `
        <figure class="card ${isSel ? "sel" : ""}">
          <a href="${esc(c.image_url)}" target="_blank" rel="noreferrer">
            <img src="${esc(thumb)}" alt="${esc(c.description)}" loading="lazy" />
          </a>
          <figcaption>
            <div class="rank">#${c.rank} ${isSel ? '<span class="badge">已设为封面</span>' : ""}</div>
            <div class="score">score ${c.relevance_score?.toFixed(3)} · ${c.width}×${c.height}</div>
            <div class="desc">${esc(c.description)}</div>
            <div class="meta">${esc(c.attribution || c.photographer || "")}</div>
            <div class="meta">${esc((c.matched_queries || []).join(" / "))}</div>
            <div class="meta"><a href="${esc(c.source_url || c.image_url)}" target="_blank" rel="noreferrer">来源页</a> · ${esc(c.license || "")}</div>
            <code>npx tsx scripts/cover-from-group.ts --group ${esc(id)} --write ${c.rank} --apply</code>
          </figcaption>
        </figure>`;
      })
      .join("");

    sections.push(`
      <section>
        <header>
          <h2>${esc(group?.title ?? id)} <span class="type">${esc(typeLabel)}</span></h2>
          <div class="meta">${esc(group?.source ?? "")} ${group?.grade ? "· " + esc(group.grade) : ""} · ${esc(id)}</div>
          <div class="meta">主题（LLM）：${esc(mainTopic)}</div>
          <div class="meta">当前 imageUrl：${current ? `<a href="${esc(current)}" target="_blank" rel="noreferrer">${esc(current)}</a>` : "(NULL)"}
            ${picked && current === picked.image_url ? '<span class="badge ok">= 本次默认封面</span>' : ""}</div>
          <div class="meta">分析方式 ${esc(meta.analysis_method ?? "-")} · CLIP ${esc(meta.clip_used ?? "-")} · 耗时 ${esc(meta.elapsed_seconds ?? "-")}s</div>
        </header>
        <div class="grid">${cards}</div>
      </section>`);
  }

  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});

  const html = `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>广学题库封面审阅</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 24px; font: 14px/1.6 -apple-system, "Segoe UI", "Noto Sans CJK SC", sans-serif;
         background: #f6f6f7; color: #1a1a1a; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .hint { color: #666; margin-bottom: 24px; }
  section { background: #fff; border: 1px solid #e3e3e6; border-radius: 10px; padding: 18px; margin-bottom: 22px; }
  section header h2 { font-size: 17px; margin: 0 0 6px; }
  .type { display: inline-block; font-size: 12px; padding: 1px 8px; border-radius: 999px;
          background: #fdeaea; color: #a31f24; border: 1px solid #f3c9ca; vertical-align: middle; }
  .meta { color: #666; font-size: 12px; word-break: break-all; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 14px; }
  .card { margin: 0; border: 1px solid #e3e3e6; border-radius: 8px; overflow: hidden; background: #fafafa; }
  .card.sel { border-color: #a31f24; box-shadow: 0 0 0 2px rgba(163,31,36,.15); }
  .card img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #ddd; }
  figcaption { padding: 8px 10px 10px; }
  .rank { font-weight: 600; }
  .badge { font-size: 11px; background: #a31f24; color: #fff; border-radius: 999px; padding: 1px 8px; margin-left: 6px; }
  .badge.ok { background: #1f7a3f; }
  .score { font-size: 12px; color: #444; }
  .desc { font-size: 12px; color: #333; margin: 2px 0; }
  .card code { display: block; font-size: 11px; color: #555; background: #f0f0f2; padding: 4px 6px;
               border-radius: 4px; margin-top: 6px; word-break: break-all; }
</style></head>
<body>
  <h1>广学题库 · 封面候选审阅</h1>
  <div class="hint">每题组默认封面 = article-cover 返回列表的第 1 张（已过「主体+动作」闸门，红框标注）。换封面：把卡片里的命令在仓库根执行。共 ${sections.length} 个题组。</div>
  ${sections.join("\n")}
</body></html>`;

  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "index.html");
  fs.writeFileSync(outFile, html, "utf8");
  console.log(`已生成：${outFile}（${sections.length} 个题组）`);
  console.log(`本地看：python3 -m http.server 8123 --bind 0.0.0.0 --directory ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
