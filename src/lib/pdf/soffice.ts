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
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: "Times New Roman", "SimSun", "宋体", serif; font-size: 12pt; line-height: 1.75; color: black; }
  h1 { font-size: 17pt; text-align: center; margin: 0 0 4pt; }
  h2 { font-size: 13.5pt; margin: 16pt 0 8pt; padding-bottom: 3pt; border-bottom: 1.2pt solid black; }
  h3 { font-size: 12pt; margin: 10pt 0 6pt; }
  p { margin: 0 0 8pt; text-align: justify; }
  .meta { font-size: 10.5pt; color: gray; text-align: center; margin: 0 0 14pt; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; }
  th, td { border: 1pt solid gray; padding: 4pt 6pt; font-size: 11pt; }
  th { background: whitesmoke; }
  img { max-width: 78%; height: auto; }
  .figure { text-align: center; }
  .blank { display: inline-block; min-width: 40pt; border-bottom: .8pt solid black; }
  del { color: firebrick; }
  strong { color: firebrick; }
  .katex-display { margin: 6pt 0; }
  .foot { margin-top: 18pt; padding-top: 6pt; border-top: .8pt solid gray; font-size: 9.5pt; color: gray; text-align: center; }
</style></head>
<body>${body}</body></html>`
}
