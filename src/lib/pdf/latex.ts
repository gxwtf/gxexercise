/**
 * LaTeX → 打印用 HTML（LibreOffice 可渲染）
 *
 * 为什么不用 KaTeX：服务端 PDF 走 LibreOffice 的「HTML → PDF」，它的 HTML 导入只认
 * 极少 CSS（字体/字号/对齐这类），KaTeX 依赖的 CSS 布局全部丢失，公式会塌成
 * 「a2+b2≥21」这种乱码。实测可用的是 **<sup>/<sub> + Unicode 符号**：
 *
 *   x^2 + a_1 ≤ 5  →  x<sup>2</sup> + a<sub>1</sub> ≤ 5   （实测渲染正常）
 *
 * 因此这里把题库里常见的 LaTeX 子集翻译成「sup/sub + Unicode」的 HTML：
 * 上下标、分数、根号、希腊字母、集合/不等式/运算符号、常用函数名、\text 等。
 * 目标不是像素级还原，而是打印出来「读得懂、不塌行」。
 */

const SYMBOLS: Record<string, string> = {
  // 关系
  le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", approx: "≈", equiv: "≡",
  sim: "∼", propto: "∝", lt: "<", gt: ">", ll: "≪", gg: "≫",
  // 运算
  pm: "±", mp: "∓", times: "×", div: "÷", cdot: "·", ast: "∗", circ: "∘",
  // 集合 / 逻辑
  in: "∈", notin: "∉", ni: "∋", subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇",
  cup: "∪", cap: "∩", emptyset: "∅", varnothing: "∅", forall: "∀", exists: "∃", neg: "¬",
  land: "∧", lor: "∨", implies: "⇒", iff: "⇔",
  // 几何 / 箭头
  angle: "∠", triangle: "△", perp: "⊥", parallel: "∥", degree: "°", circ_deg: "°",
  to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐", leftrightarrow: "↔",
  because: "∵", therefore: "∴", cdots: "⋯", ldots: "…", dots: "…", vdots: "⋮", ddots: "⋱",
  // 大运算符
  sum: "∑", prod: "∏", int: "∫", iint: "∬", oint: "∮", lim: "lim", infty: "∞", partial: "∂", nabla: "∇",
  // 括号
  langle: "⟨", rangle: "⟩", lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉",
  lbrace: "{", rbrace: "}", vert: "|", Vert: "‖",
  // 希腊
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ",
  eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ",
  pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ",
  psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ",
  Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  // 装饰 / 间距（直接丢掉）
  quad: " ", qquad: "　", ",": " ", ";": " ", ":": " ", "!": "", " ": " ",
  left: "", right: "", big: "", Big: "", bigl: "", bigr: "", displaystyle: "", textstyle: "",
  limits: "", nolimits: "", mathstrut: "", phantom: "",
}

/** 直接当文本渲染的函数名（\ln x、\sin 30° …） */
const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan",
  "ln", "log", "lg", "exp", "max", "min", "sup", "inf", "det", "gcd", "deg", "arg",
])

const ESC = { "<": "&lt;", ">": "&gt;", "&": "&amp;" } as const
const escapeText = (s: string) => s.replace(/[<>&]/g, (m) => ESC[m as keyof typeof ESC] as string)

/** 找到配对的花括号内容（start 指向 "{"），返回 [内容, 结束位置(闭括号之后)] */
function grabBrace(src: string, start: number): [string, number] | null {
  if (src[start] !== "{") return null
  let depth = 0
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (ch === "\\") {
      i++ // 跳过转义字符（\{ \}）
      continue
    }
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return [src.slice(start + 1, i), i + 1]
    }
  }
  return null
}

/** 读一个「参数」：{...} 或单个字符 / 命令 */
function grabArg(src: string, start: number): [string, number] {
  let i = start
  while (src[i] === " ") i++
  const braced = grabBrace(src, i)
  if (braced) return braced
  const cmd = /^\\[A-Za-z]+/.exec(src.slice(i))
  if (cmd) return [cmd[0], i + cmd[0].length]
  if (src[i] === "\\") return [src.slice(i, i + 2), i + 2]
  return [src[i] ?? "", i + 1]
}

/** 分数：简单项写 a/b，复杂项用括号包起来 */
function fraction(num: string, den: string): string {
  const wrap = (s: string) => (s.length > 1 && !/^[A-Za-z0-9<>/√π∠△]+$/.test(s) ? `(${s})` : s)
  return `${wrap(num)}/${wrap(den)}`
}

/**
 * LaTeX → HTML 主体
 * @param tex 公式源码（不含首尾 $）
 * @param display 是否独立公式（只影响外层换行处理）
 */
export function latexToHtml(tex: string, display = false): string {
  let src = String(tex ?? "")

  // 归一化常见写法
  src = src.replace(/\\{2}/g, display ? "\n" : " ")
  src = src.replace(/\\[dt]frac\b/g, "\\frac")
  src = src.replace(/\\over\b/g, "\\frac") // a \over b 这种极少见，粗略处理
  src = src.replace(/\\degrees?\b/g, "^\\circ")

  let out = ""
  let i = 0

  while (i < src.length) {
    const ch = src[i]

    // 换行（显示公式里的 \\）
    if (ch === "\n") {
      out += "<br/>"
      i++
      continue
    }

    // 上下标
    if (ch === "^" || ch === "_") {
      const [arg, next] = grabArg(src, i + 1)
      const inner = latexToHtml(arg, false)
      out += ch === "^" ? `<sup>${inner}</sup>` : `<sub>${inner}</sub>`
      i = next
      continue
    }

    if (ch === "\\") {
      const cmdMatch = /^\\([A-Za-z]+)/.exec(src.slice(i))
      const name = cmdMatch ? cmdMatch[1] : src[i + 1] ?? ""
      const after = i + 1 + name.length

      // 分式
      if (name === "frac") {
        const [num, p1] = grabArg(src, after)
        const [den, p2] = grabArg(src, p1)
        out += fraction(latexToHtml(num, false), latexToHtml(den, false))
        i = p2
        continue
      }

      // 根号 \sqrt{x} / \sqrt[n]{x}
      if (name === "sqrt") {
        let p = after
        let index = ""
        if (src[p] === "[") {
          const close = src.indexOf("]", p)
          if (close > 0) {
            index = latexToHtml(src.slice(p + 1, close), false)
            p = close + 1
          }
        }
        const [arg, next] = grabArg(src, p)
        const inner = latexToHtml(arg, false)
        const needsParen = /[+\-·/ ]/.test(inner) && inner.length > 1
        out += `${index ? `<sup>${index}</sup>` : ""}√${needsParen ? `(${inner})` : inner}`
        i = next
        continue
      }

      // 纯文本类：\text{} \mathrm{} \mathbf{} \operatorname{} \mbox{}
      if (["text", "textrm", "mathrm", "mathbf", "mathit", "operatorname", "mbox", "textbf", "mathbb"].includes(name)) {
        const [arg, next] = grabArg(src, after)
        const cleaned = arg.replace(/[{}]/g, "")
        // \mathbb{Z} → Z（黑体字在打印里用普通字母即可）
        out += escapeText(cleaned)
        i = next
        continue
      }

      // 左侧装饰 \left( \right) 等：直接丢命令，保留括号字符
      if (name === "left" || name === "right") {
        i = after
        continue
      }

      // 上划线 / 下划线 / 帽子等装饰：只保留内容
      if (["overline", "underline", "hat", "bar", "vec", "widehat", "widetilde", "dot", "ddot"].includes(name)) {
        const [arg, next] = grabArg(src, after)
        out += latexToHtml(arg, false)
        i = next
        continue
      }

      // 函数名
      if (FUNCTIONS.has(name)) {
        out += escapeText(name)
        i = after
        continue
      }

      // 符号表
      if (Object.prototype.hasOwnProperty.call(SYMBOLS, name)) {
        out += SYMBOLS[name]
        i = after
        continue
      }

      // 转义字符 \{ \} \% \$ \& \# \_
      if (name.length === 1) {
        const literal: Record<string, string> = { "{": "{", "}": "}", "%": "%", "$": "$", "&": "&amp;", "#": "#", "_": "_", "|": "‖" }
        out += literal[name] ?? escapeText(name)
        i = after
        continue
      }

      // 未知命令：保留名字，避免整段丢字
      out += escapeText(name)
      i = after
      continue
    }

    // 普通字符
    if (ch === "{") {
      const braced = grabBrace(src, i)
      if (braced) {
        out += latexToHtml(braced[0], false)
        i = braced[1]
        continue
      }
    }
    if (ch === "}") {
      i++
      continue
    }
    if ("<>&".includes(ch)) {
      out += ESC[ch as keyof typeof ESC]
      i++
      continue
    }

    out += ch
    i++
  }

  return out.replace(/\s+/g, (m) => (m.includes("\n") ? m : " ")).trim()
}
