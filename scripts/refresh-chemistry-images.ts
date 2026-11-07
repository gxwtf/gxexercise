/**
 * 化学「图片版」套卷的图批量重切 + 刷新库里的图地址。
 *
 * 背景：`output_docx_to_md/<类型>/化学/<卷>/images/qNN.png` 是流水线（exam-parser/crop_questions_pdf.py）
 * 按题从原卷 PDF 裁出来的。裁图脚本改过口径（右边界/页脚），早批次生成的图会比正文窄一点
 * （典型：2026 海淀期中化学第 12 题右边被切掉），所以用当前脚本整批重切一遍，
 * 再把库里 `Question.content` 里的 `<QImg src="...?v=" px="">` 更新成新 mtime / 新像素宽
 * （`?v=` 变了浏览器才不会用旧缓存）。
 *
 * 只动「图片文件 + Question.content 的 ?v/px」，不碰题目结构、分值、题组、作答。
 *
 * 用法：
 *   npx tsx scripts/refresh-chemistry-images.ts --type 二模 --dry-run
 *   npx tsx scripts/refresh-chemistry-images.ts --type 二模 --apply
 *   npx tsx scripts/refresh-chemistry-images.ts --type 上期中 --apply --only 2026北京海淀高三（上）期中化学
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const has = (n: string) => process.argv.includes(`--${n}`);

const DATA_ROOT = "/home/gxwtf/jingshibang";
const PARSER = path.join(DATA_ROOT, "exam-parser", "crop_questions_pdf.py");

/** 与 batch_image_papers.py 一致：去掉（教师版）/含答案等后缀 */
function stemOf(file: string): string {
  return file.replace(/\.pdf$/i, "").replace(/（教师版）|\(教师版\)|含答案|教师版/g, "").trim();
}

/** 读 PNG 宽高（只读前 24 字节，够 PNG IHDR） */
function pngWidth(file: string): number | null {
  try {
    const buf = fs.readFileSync(file);
    if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return null;
    return buf.readUInt32BE(16);
  } catch {
    return null;
  }
}

async function refreshOne(type: string, subject: string, pdf: string, apply: boolean) {
  const stem = stemOf(path.basename(pdf));
  if (!apply) return { stem, status: "干跑（不裁图）", changed: 0 };
  const serve = path.join(DATA_ROOT, "output_docx_to_md", type, subject, stem, "images");
  if (!fs.existsSync(path.dirname(serve))) return { stem, status: "跳过（没有图片目录）", changed: 0 };

  const tmpOut = fs.mkdtempSync("/tmp/chem-crop-");
  const r = spawnSync("python3", [PARSER, "-p", pdf, "-o", tmpOut, "--serve-dir", serve, "-T", type, "-s", subject], {
    encoding: "utf-8",
    timeout: 10 * 60_000,
  });
  if (r.status !== 0) {
    return { stem, status: `裁图失败：${(r.stderr || r.stdout || "").slice(-160).replace(/\s+/g, " ")}`, changed: 0 };
  }

  let changed = 0;
  for (const f of fs.readdirSync(serve).filter((x) => /^q\d+\.png$/.test(x))) {
    const full = path.join(serve, f);
    const no = f.match(/^q(\d+)\.png$/)![1];
    const v = Math.floor(fs.statSync(full).mtimeMs / 1000);
    const w = pngWidth(full);
    if (!w) continue;
    // 库里这题的 content 里有 …/<stem>/images/q<no>.png?v=… px="…"
    const questions = await prisma.question.findMany({
      where: { content: { contains: `/${stem}/images/q${no}.png` } },
      select: { id: true, content: true },
    });
    for (const q of questions) {
      const next = q.content
        .replace(new RegExp(`q${no}\\.png\\?v=\\d+`, "g"), `q${no}.png?v=${v}`)
        .replace(/px="\d+"/g, `px="${w}"`);
      if (next === q.content) continue;
      if (apply) await prisma.question.update({ where: { id: q.id }, data: { content: next } });
      changed++;
    }
  }
  fs.rmSync(tmpOut, { recursive: true, force: true });
  return { stem, status: "ok", changed };
}

async function main() {
  const type = arg("type", "二模") ?? "二模";
  const subject = arg("subject", "化学") ?? "化学";
  const apply = has("apply");
  const only = arg("only");
  const src = path.join(DATA_ROOT, "gaozhong", type, subject);
  const pdfs = fs.readdirSync(src).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
  const picked = only ? pdfs.filter((f) => stemOf(f) === only || f === only) : pdfs;

  console.log(`${apply ? "写库" : "干跑"}：${type}/${subject} 共 ${picked.length} 套（源 ${src}）`);
  let ok = 0;
  let changedTotal = 0;
  const fails: string[] = [];
  const t0 = Date.now();
  for (let i = 0; i < picked.length; i++) {
    const file = path.join(src, picked[i]);
    try {
      const r = await refreshOne(type, subject, file, apply);
      if (r.status === "ok") {
        ok++;
        changedTotal += r.changed;
        console.log(`[${i + 1}/${picked.length}] ✓ ${r.stem}  更新 ${r.changed} 题`);
      } else {
        fails.push(`${r.stem}：${r.status}`);
        console.log(`[${i + 1}/${picked.length}] ✗ ${r.stem}  ${r.status}`);
      }
    } catch (e) {
      fails.push(`${picked[i]}：${String((e as Error)?.message ?? e).slice(0, 120)}`);
      console.log(`[${i + 1}/${picked.length}] ✗ ${picked[i]} 异常`);
    }
  }
  console.log(`\n完成：成功 ${ok} 套 / 失败 ${fails.length} 套 / 更新 ${changedTotal} 条题目内容，用时 ${Math.round((Date.now() - t0) / 1000)}s`);
  if (fails.length) {
    console.log("失败清单：");
    for (const f of fails.slice(0, 20)) console.log("  -", f);
  }
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
