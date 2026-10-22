/**
 * 轻量 Markdown → HTML（只覆盖题库内容用到的子集）
 * - 标题 / 段落 / 列表 / 表格（GFM）/ 图片 / 分隔线
 * - 行内：**加粗**、*斜体*、~~删除线~~、`代码`
 * - 数学公式 $...$ / $$...$$ 用 KaTeX 渲染
 * - 题库私有标签：<Input2></Input2> → 填空横线、<br />、<sub>/<sup> 原样保留
 * 目的：服务端生成 PDF 时不必走 React/MDX 渲染。
 */
import katex from "katex"

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function renderMath(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode: display, output: "html" })
  } catch {
    return `<code>${escapeHtml(tex)}</code>`
  }
}

/** 行内渲染 */
export function inline(text: string): string {
  const parts: string[] = []
  let rest = text

  // 先抽出公式，避免后续转义破坏 LaTeX
  rest = rest.replace(/\$\$([^$]+)\$\$/g, (_m, tex) => {
    parts.push(renderMath(tex, true))
    return `\u0000${parts.length - 1}\u0000`
  })
  rest = rest.replace(/\$([^$]+)\$/g, (_m, tex) => {
    parts.push(renderMath(tex, false))
    return `\u0000${parts.length - 1}\u0000`
  })
  // 私有填空组件 → 下划线
  rest = rest.replace(/<Input2\s*><\/Input2>|<Input2\s*\/>/g, '<span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>')
  // <br /> 保留
  rest = rest.replace(/<br\s*\/?>/g, "<br/>")
  // sub/sup 保留
  const keep: string[] = []
  rest = rest.replace(/<\/?(?:sub|sup)>/g, (m) => {
    keep.push(m)
    return `\u0001${keep.length - 1}\u0001`
  })

  rest = escapeHtml(rest)
  rest = rest.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  rest = rest.replace(/~~([^~]+)~~/g, "<del>$1</del>")
  rest = rest.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
  rest = rest.replace(/`([^`]+)`/g, "<code>$1</code>")

  rest = rest.replace(/\u0001(\d+)\u0001/g, (_m, i) => keep[Number(i)] ?? "")
  rest = rest.replace(/\u0000(\d+)\u0000/g, (_m, i) => parts[Number(i)] ?? "")
  return rest
}

/** 图片地址：/exam-images/... → 供 LibreOffice 读取的本地绝对路径 */
export function resolveImageSrc(src: string): string {
  const mdRoot = process.env.MD_IMAGES_ROOT || "/home/gxwtf/jingshibang/output_docx_to_md"
  if (src.startsWith("/exam-images/")) {
    return `file://${mdRoot}/${src.slice("/exam-images/".length)}`
  }
  return src
}

/** 块级渲染 */
export function markdownToHtml(md: string): string {
  const lines = (md || "").replace(/\r\n/g, "\n").split("\n")
  const out: string[] = []
  let i = 0

  const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    // 表格
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
      const header = cells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(cells(lines[i]))
        i++
      }
      out.push(
        `<table><thead><tr>${header.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead>` +
          `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      )
      continue
    }

    // 标题
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      out.push(`<h${level}>${inline(h[2])}</h${level}>`)
      i++
      continue
    }

    // 分隔线
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) { out.push("<hr/>"); i++; continue }

    // 列表
    const isUl = /^\s*[-*]\s+/.test(line)
    const isOl = /^\s*\d+\.\s+/.test(line)
    if (isUl || isOl) {
      const tag = isUl ? "ul" : "ol"
      const items: string[] = []
      while (i < lines.length && (isUl ? /^\s*[-*]\s+/ : /^\s*\d+\.\s+/).test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ""))}</li>`)
        i++
      }
      out.push(`<${tag}>${items.join("")}</${tag}>`)
      continue
    }

    // 独立图片
    const img = /^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line)
    if (img) {
      out.push(`<p class="figure"><img src="${resolveImageSrc(img[2])}" alt="${escapeHtml(img[1] || "")}"/></p>`)
      i++
      continue
    }

    // 段落（连续非空行合并，行内图片单独成行会保留 <br/>）
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !isTableRow(lines[i]) && !/^#{1,4}\s/.test(lines[i])) {
      para.push(lines[i])
      i++
    }
    const paraHtml = para
      .map((l) => {
        const m = /^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(l)
        if (m) return `<img src="${resolveImageSrc(m[2])}" alt="${escapeHtml(m[1] || "")}"/>`
        return inline(l)
      })
      .join("<br/>")
    out.push(`<p>${paraHtml}</p>`)
  }

  return out.join("\n")
}
