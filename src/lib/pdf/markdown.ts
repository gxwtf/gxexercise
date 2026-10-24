/**
 * 轻量 Markdown → HTML（只覆盖题库内容用到的子集）
 * - 标题 / 段落 / 列表 / 表格（GFM）/ 图片 / 分隔线
 * - 行内：**加粗**、*斜体*、~~删除线~~、`代码`
 * - 数学公式 $...$ / $$...$$ 用 KaTeX 渲染
 * - 题库私有标签：<Input2></Input2>、<Input></Input>、<ClozeBlank></ClozeBlank>、<Blank></Blank>
 *   以及 <Center>/<RightAlign>/<Superscript>/<Dot>/<U> 等语义标签 → 对应的打印样式
 * - 爬取内容里夹带的原始 HTML（表格 / div 等）按白名单原样保留
 * 目的：服务端生成 PDF 时不必走 React/MDX 渲染。
 *
 * 两种填空模式：
 * - `line`（默认）：一条下划线，用于回顾 PDF 这类不要求题号的场景
 * - `number`：带题号的短横线（____3____），用于题组 / 套卷的纸质作答卷
 */
import { latexToHtml } from "./latex"
import { readImageSize } from "./image-size"

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** 打印稿里插图的最大显示尺寸（pt）；LibreOffice 只认 width/height 属性 */
const DEFAULT_IMAGE_MAX_WIDTH_PT = 340
const DEFAULT_IMAGE_MAX_HEIGHT_PT = 170

export interface MarkdownOptions {
  /** 填空的渲染方式：line=下划线；number=带题号的填空 */
  blankMode?: "line" | "number"
  /** blankMode=number 时第一个填空的题号，默认 1 */
  blankStart?: number
  /** 插图最大宽度（pt），默认 340pt ≈ 120mm */
  imageMaxWidthPt?: number
  /** 插图最大高度（pt），默认 170pt ≈ 60mm */
  imageMaxHeightPt?: number
}

interface RenderContext {
  blankMode: "line" | "number"
  nextBlank: number
  tokens: string[]
  imageMaxWidthPt: number
  imageMaxHeightPt: number
}

function createContext(options: MarkdownOptions = {}): RenderContext {
  return {
    blankMode: options.blankMode ?? "line",
    nextBlank: options.blankStart ?? 1,
    tokens: [],
    imageMaxWidthPt: options.imageMaxWidthPt ?? DEFAULT_IMAGE_MAX_WIDTH_PT,
    imageMaxHeightPt: options.imageMaxHeightPt ?? DEFAULT_IMAGE_MAX_HEIGHT_PT,
  }
}

/** 公式：翻译成 sup/sub + Unicode（LibreOffice 的 HTML 导入不认 KaTeX 的 CSS 布局） */
function renderMath(tex: string, display: boolean): string {
  try {
    const html = latexToHtml(tex, display)
    return display ? `<span class="math-disp">${html}</span>` : html
  } catch {
    return `<code>${escapeHtml(tex)}</code>`
  }
}

/** 填空横线：line=长下划线，number=带题号的下划线
 *  用真实的「下划线字符」而不是 CSS 边框：LibreOffice 的 HTML 导入对 inline 元素的
 *  border/min-width 支持很差，印出来会只剩一个孤零零的题号。 */
function blankHtml(ctx: RenderContext): string {
  if (ctx.blankMode === "number") {
    const n = ctx.nextBlank
    ctx.nextBlank += 1
    return `<span class="blank">___${n}___</span>`
  }
  return `<span class="blank">__________</span>`
}

/** 图片地址：/exam-images/... → 供 LibreOffice 读取的本地绝对路径 */
export function resolveImageSrc(src: string): string {
  // 题库图片 src 带 ?v=<时间戳> 缓存参数，落到文件系统前必须去掉，
  // 否则 LibreOffice 拿到 "xxx.png?v=1792817624" 找不到文件 → 图片整片空白
  const clean = String(src ?? "")
    .trim()
    .split("?")[0]
    .split("#")[0]
  const mdRoot = process.env.MD_IMAGES_ROOT || "/home/gxwtf/jingshibang/output_docx_to_md"
  if (clean.startsWith("/exam-images/")) {
    return `file://${mdRoot}/${clean.slice("/exam-images/".length)}`
  }
  return clean
}

/**
 * 生成 <img>：按图片原始像素算显示尺寸，写进 width/height 属性。
 * （LibreOffice 的 HTML 导入会忽略 img 的 CSS 宽高，只认这两个属性，单位是 pt）
 */
export function imageHtml(src: string, alt: string, ctx: RenderContext): string {
  const resolved = resolveImageSrc(src.trim())
  const size = resolved.startsWith("file://") ? readImageSize(resolved.slice("file://".length)) : null
  let dims = ""
  if (size && size.width > 0 && size.height > 0) {
    const scale = Math.min(ctx.imageMaxWidthPt / size.width, ctx.imageMaxHeightPt / size.height, 1)
    if (scale < 1) {
      dims = ` width="${Math.round(size.width * scale)}" height="${Math.round(size.height * scale)}"`
    }
  }
  return `<img src="${resolved}" alt="${escapeHtml(alt || "")}"${dims}/>`
}

/** 白名单内的原始 HTML 标签原样保留（爬取的题目里有 <table> / <div> 等） */
const RAW_TAG_RE =
  /<\/?(?:table|thead|tbody|tfoot|tr|td|th|caption|colgroup|col|div|p|ul|ol|li|b|i|strong|em|span|center|a|img|hr|sup|sub|br|small|big|font|figure|figcaption|blockquote|pre|code|s|del|ins|u)(?:\s[^<>]*)?\/?>/gi

/** 语义容器（题库私有标签），成对出现 */
const INLINE_CONTAINERS: Array<{ tag: string; cls: string }> = [
  { tag: "Dot", cls: "dot" },
  { tag: "U", cls: "underline" },
  { tag: "u", cls: "underline" },
  { tag: "Superscript", cls: "superscript" },
  { tag: "RightAlign", cls: "right-align" },
  { tag: "Center", cls: "center" },
]

/** 把白名单标签整理成可输出的 HTML：图片按像素算尺寸、去掉无用属性 */
function sanitizeRawTag(tag: string, ctx: RenderContext): string {
  let out = tag
  if (/^<img/i.test(out)) {
    const srcMatch = /\ssrc\s*=\s*(['"])([^'"]+)\1/i.exec(out)
    const altMatch = /\salt\s*=\s*(['"])([^'"]*)\1/i.exec(out)
    if (srcMatch) return imageHtml(srcMatch[2], altMatch ? altMatch[2] : "", ctx)
  }
  // 去掉 height/width 之类会破坏排版的属性（保留 src/colspan/rowspan/href）
  out = out.replace(/\s(?:height|width)\s*=\s*(['"])[^'"]*\1/gi, "")
  return out
}

/**
 * 图片版题目组件 <QImg src px> → <img>
 * 与前端一致：按 300dpi 原始像素的 96/300 比例显示，再换算成 pt（CSS px × 0.75）。
 */
function qimgHtml(src: string, px: number, alt: string, ctx: RenderContext): string {
  const resolved = resolveImageSrc(src)
  const size = resolved.startsWith("file://") ? readImageSize(resolved.slice("file://".length)) : null
  let widthPt = px > 0 ? px * (96 / 300) * 0.75 : 0
  if (widthPt <= 0 && size) widthPt = Math.min(ctx.imageMaxWidthPt, size.width)
  if (widthPt > 0) {
    const capped = Math.min(widthPt, ctx.imageMaxWidthPt)
    const heightPt = size && size.width > 0 ? Math.round((capped * size.height) / size.width) : 0
    const dims = heightPt > 0 ? ` width="${Math.round(capped)}" height="${heightPt}"` : ` width="${Math.round(capped)}"`
    return `<img src="${resolved}" alt="${escapeHtml(alt)}"${dims}/>`
  }
  return imageHtml(src, alt, ctx)
}

/** 打印用表格外壳：LibreOffice 只认 HTML 属性里的边框/宽度，CSS 的 border/width 一律无效 */
const TABLE_OPEN = '<table border="1" cellpadding="6" cellspacing="0" width="100%">'

/** 行内渲染 */
export function inline(text: string, ctx: RenderContext = createContext()): string {
  const protect = (html: string): string => {
    ctx.tokens.push(html)
    return `\u0000${ctx.tokens.length - 1}\u0000`
  }

  let rest = text

  // 1. 公式先抽出，避免后续转义破坏 LaTeX
  rest = rest.replace(/\$\$([^$]+)\$\$/g, (_m, tex: string) => protect(renderMath(tex, true)))
  rest = rest.replace(/\$([^$]+)\$/g, (_m, tex: string) => protect(renderMath(tex, false)))

  // 2. 行内图片：![](/exam-images/...) → <img>（题目里图片常夹在句子中间）
  rest = rest.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, src: string) =>
    protect(imageHtml(src, alt, ctx))
  )

  // 2.1 图片版题目组件 <QImg src="…" px="1983" />：按 300dpi 原始像素等比缩到版心宽
  rest = rest.replace(/<QImg\b([^>]*?)\/?>/gi, (_m, attrs: string) => {
    const src = /\bsrc\s*=\s*(['"])([^'"]+)\1/i.exec(attrs)?.[2] ?? ""
    const px = Number(/\bpx\s*=\s*(['"])([^'"]+)\1/i.exec(attrs)?.[2] ?? 0)
    const alt = /\balt\s*=\s*(['"])([^'"]*)\1/i.exec(attrs)?.[2] ?? ""
    return protect(qimgHtml(src, px, alt, ctx))
  })

  // 3. 私有填空标签 → 横线（先匹配成对写法，再匹配自闭合/空标签写法）
  for (const tag of ["Input2", "ClozeBlank", "Blank", "Input"]) {
    const re = new RegExp(`<${tag}\\s*>[\\s\\S]*?<\\/${tag}\\s*>|<${tag}\\s*\\/?>`, "gi")
    rest = rest.replace(re, () => protect(blankHtml(ctx)))
  }
  // 兜底：清掉残留的孤立闭合标签（脏数据里出现过）
  rest = rest.replace(/<\/(?:Input2|ClozeBlank|Blank|Input)\s*>/gi, "")

  // 3. 语义容器（可嵌套：内层交给递归的 inline 处理）
  for (const { tag, cls } of INLINE_CONTAINERS) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi")
    rest = rest.replace(re, (_m, inner: string) => protect(`<span class="${cls}">${inline(inner, ctx)}</span>`))
  }

  // 4. 白名单原始 HTML 原样保留
  rest = rest.replace(RAW_TAG_RE, (tag) => protect(sanitizeRawTag(tag, ctx)))

  // 5. 其余内容转义后再做行内 Markdown
  rest = escapeHtml(rest)
  rest = rest.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  rest = rest.replace(/~~([^~]+)~~/g, "<del>$1</del>")
  rest = rest.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
  // 题库材料里英文常用 _word_ 表示斜体（如 _Journal of Science_）；两侧必须是词边界，
  // 避免把 snake_case / __init__ 这类标识符误伤
  rest = rest.replace(/(^|[^A-Za-z0-9_])_([^_\s](?:[^_]*?[^_\s])?)_(?![A-Za-z0-9_])/g, "$1<em>$2</em>")
  rest = rest.replace(/`([^`]+)`/g, "<code>$1</code>")

  // 6. 还原受保护片段
  let out = rest
  for (let guard = 0; guard < 8 && out.indexOf("\u0000") >= 0; guard++) {
    out = out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => ctx.tokens[Number(i)] ?? "")
  }
  return out
}

/** 行内 Markdown → HTML（独立于块级解析，用于选项等短文本） */
export function inlineToHtml(text: string, options: MarkdownOptions = {}): string {
  return inline(text ?? "", createContext(options))
}

/** 独立成行的块级私有标签 */
function blockTagOf(line: string): { html?: string; cls?: string } | null {
  const t = line.trim()
  const open = /^<(Center|RightAlign)(?:\s[^>]*)?>$/i.exec(t)
  if (open) return { cls: open[1].toLowerCase() === "center" ? "center" : "right-align" }
  if (/^<\/(Center|RightAlign)>$/i.test(t)) return { html: "</div>" }
  return null
}

/** 块级渲染 */
export function markdownToHtml(md: string, options: MarkdownOptions = {}): string {
  const ctx = createContext(options)
  const lines = (md || "").replace(/\r\n/g, "\n").split("\n")
  const out: string[] = []
  let i = 0

  const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
  // 只有「表头 + 分隔行」才算表格；题库里有不少只有竖线的脏行，不能当表格吃
  const isTableStart = (idx: number) =>
    idx + 1 < lines.length && isTableRow(lines[idx]) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[idx + 1])

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    // 块级私有标签：<Center> / <RightAlign>
    const block = blockTagOf(line)
    if (block) {
      if (block.cls) out.push(`<div class="${block.cls}">`)
      else if (block.html) out.push(block.html)
      i++
      continue
    }

    // 表格（标准写法：表头 + 分隔行）
    if (isTableStart(i)) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
      const header = cells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(cells(lines[i]))
        i++
      }
      out.push(
        `${TABLE_OPEN}<thead><tr>${header.map((h) => `<th>${inline(h, ctx)}</th>`).join("")}</tr></thead>` +
          `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, ctx)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      )
      continue
    }

    // 脏数据里的「无分隔行」表格：连续成行的 | … | 也按表格排版，别把竖线印出来
    if (isTableRow(line)) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(cells(lines[i]))
        i++
      }
      const maxCols = Math.max(...rows.map((r) => r.length))
      const pad = (r: string[]) => [...r, ...Array(maxCols - r.length).fill("")]
      if (rows.length >= 2) {
        const [head, ...body] = rows.map(pad)
        out.push(
          `${TABLE_OPEN}<thead><tr>${head.map((h) => `<th>${inline(h, ctx)}</th>`).join("")}</tr></thead>` +
            `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c, ctx)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
        )
      } else {
        out.push(...rows.map((r) => `<p>${r.map((c) => inline(c, ctx)).join("　")}</p>`))
      }
      continue
    }

    // 标题
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      out.push(`<h${level}>${inline(h[2], ctx)}</h${level}>`)
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
        items.push(`<li>${inline(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ""), ctx)}</li>`)
        i++
      }
      out.push(`<${tag}>${items.join("")}</${tag}>`)
      continue
    }

    // 独立图片
    const img = /^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line)
    if (img) {
      out.push(`<p class="figure">${imageHtml(img[2], img[1] || "", ctx)}</p>`)
      i++
      continue
    }

    // 独立原始 HTML 块（如 <div class="joplin-table-wrapper">…</div>）
    if (/^\s*<(?:div|table|figure|blockquote)\b/i.test(line)) {
      out.push(inline(line, ctx))
      i++
      continue
    }

    // 段落（连续非空行合并，行内图片单独成行会保留 <br/>）
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !isTableStart(i) &&
      !isTableRow(lines[i]) &&
      !blockTagOf(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    // 兜底：本行没有被上面任何分支吃掉时，按普通段落消费掉，避免死循环
    if (!para.length) { out.push(`<p>${inline(line, ctx)}</p>`); i++; continue }
    const paraHtml = para
      .map((l) => {
        const m = /^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(l)
        if (m) return imageHtml(m[2], m[1] || "", ctx)
        return inline(l, ctx)
      })
      .join("<br/>")
    out.push(`<p>${paraHtml}</p>`)
  }

  return out.join("\n")
}
