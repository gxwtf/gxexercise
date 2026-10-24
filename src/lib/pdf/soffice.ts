/** HTML → PDF（用 LibreOffice headless，中文由系统 SimSun/宋体 字体渲染） */
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

function run(cmd: string, args: string[], timeout = 90_000): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout }, (err, _stdout, stderr) => {
      if (err) reject(new Error(`soffice 失败: ${stderr || err.message}`))
      else resolve()
    })
  })
}

export async function htmlToPdf(html: string, timeout = 90_000): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "gxpdf-"))
  const profile = await mkdtemp(path.join(tmpdir(), "gxlo-"))
  try {
    const src = path.join(dir, "doc.html")
    await writeFile(src, html, "utf-8")
    await run("soffice", [
      `-env:UserInstallation=file://${profile}`,
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      dir,
      src,
    ], timeout)
    return await readFile(path.join(dir, "doc.pdf"))
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    await rm(profile, { recursive: true, force: true }).catch(() => {})
  }
}

/** 统一的 PDF 页面外壳：A4、宋体 + Times New Roman、12pt 正文 */
export function pageHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/><title>${title.replace(/[<>&]/g, "")}</title>
<style>
  /* LibreOffice 只认「两个长度值」的 @page size（写 A4 会出 Letter）；多值 margin 简写会让段落左缩进 */
  @page { size: 210mm 297mm; margin-top: 16mm; margin-right: 14mm; margin-bottom: 16mm; margin-left: 14mm; }
  body { font-family: "Times New Roman", "SimSun", "宋体", serif; font-size: 12pt; line-height: 1.75; color: black; margin-top: 0; margin-right: 0; margin-bottom: 0; margin-left: 0; }
  h1 { font-size: 17pt; text-align: center; margin-top: 0; margin-bottom: 4pt; }
  h2 { font-size: 13.5pt; margin-top: 16pt; margin-bottom: 8pt; padding-bottom: 3pt; border-bottom: 1.2pt solid black; break-after: avoid; }
  h3 { font-size: 12pt; margin-top: 10pt; margin-bottom: 6pt; break-after: avoid; }
  p { margin-top: 0; margin-bottom: 8pt; text-align: justify; }
  .meta { font-size: 10.5pt; color: gray; text-align: center; margin-top: 0; margin-bottom: 14pt; }
  table { border-collapse: collapse; margin-top: 6pt; margin-bottom: 10pt; }
  td, th { padding-top: 4pt; padding-right: 6pt; padding-bottom: 4pt; padding-left: 6pt; font-size: 11pt; text-align: left; vertical-align: top; }
  th { background: #f1f1f1; }
  .c { text-align: center; }
  .strong { font-weight: bold; }
  img { max-width: 78%; height: auto; }
  .figure { text-align: center; }
  .blank { display: inline-block; min-width: 40pt; border-bottom: .8pt solid black; }
  del { color: firebrick; }
  strong { color: firebrick; }
  sup, sub { font-size: 70%; }
  /* AI 批改正文左对齐：两端对齐 + 行内 <br> 会被 LibreOffice 拉出巨大词间距 */
  .ai-md, .ai-md p, .ai-md li { text-align: left; }
  .math-disp { display: block; text-align: center; margin-top: 4pt; margin-bottom: 4pt; }
  .foot { margin-top: 18pt; padding-top: 6pt; border-top: .8pt solid gray; font-size: 9.5pt; color: gray; text-align: center; }
</style></head>
<body>${body}</body></html>`
}
