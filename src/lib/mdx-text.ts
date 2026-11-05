/**
 * 题库 MDX 文本预处理（渲染前统一调用）
 *
 * 背景：解析器有时把同一个化学式拆成两段行内公式，例如
 *   `$\mathrm{H_{2}}$$\mathrm{O_{2}}$`、`$\mathrm{^{14}}$$\mathrm{NH_{4}}$Cl`
 * 两段相邻会把 `$` 拼成 `$$`，remark-math 会当成「块级公式」的起止符，
 * 结果整段变成红色原文（KaTeX 解析失败）。
 *
 * 这里把相邻的行内公式合并成一段：`$A$$B$` → `$AB$`（可连续多段）。
 * 只处理「紧邻（中间允许空白）」的情形，不动真正的 `$$ ... $$` 块级公式。
 */
export function mergeAdjacentInlineMath(text: string): string {
  if (!text || (!text.includes("$") && !text.includes("\\$"))) return text
  let out = text
  // 反复合并，直到不再变化（支持 $A$$B$$C$ 这种多段）
  for (let i = 0; i < 8; i += 1) {
    // 用函数式替换拼 "$A$"+"$B$" → "$AB$"（字符串模板里的 $$ 会被当成转义，必须避免）
    const next = out.replace(/\$([^$\n]+?)\$\s*\$\s*([^$\n]+?)\$/g, (_m, a: string, b: string) => `$${a}${b}$`)
    if (next === out) break
    out = next
  }
  return out
}

/**
 * 私有填空标签的「数值表达式属性」→ 字符串属性：
 *   `<InputLong rows={4}></InputLong>` → `<InputLong rows="4"></InputLong>`
 *
 * 背景：next-mdx-remote 的 `serialize()` 默认 `blockJS: true`，它内置的
 * `removeJavaScriptExpressions` 插件会把 **所有 `{...}` 表达式属性静默删掉**（不是报错）：
 * `<InputLong rows={4}>` 编出来是 `_jsxDEV(InputLong, {})`，`rows` 整个丢掉 →
 * 组件退回默认 `rows=2`，长答框按分值给高度就白做了（实测 MDX 3.1.1 + next-mdx-remote 6.0.0）。
 * 数值属性改成字符串写法既能过这道安全闸，又不用放开任意 JS。
 *
 * 只命中题库私有的填空标签 + 纯数字取值，正文里其它花括号（公式、示例）不动。
 */
const NUMERIC_TAG_ATTR_RE =
  /<(InputLong|Input2|ClozeBlank|Blank|Input)(\b[^<>]*?)\b([A-Za-z][A-Za-z0-9-]*)=\{\s*(\d+(?:\.\d+)?)\s*\}/gi

export function stringifyNumericTagAttrs(text: string): string {
  if (!text || !text.includes("={")) return text
  let out = text
  // 反复替换，直到不再变化（一个标签上可能有多个数值属性）
  for (let i = 0; i < 8; i += 1) {
    const next = out.replace(NUMERIC_TAG_ATTR_RE, (_m, tag: string, before: string, name: string, value: string) =>
      `<${tag}${before} ${name}="${value}"`)
    if (next === out) break
    out = next
  }
  return out
}

/**
 * `<br>` → `<br />`：MDX 把裸 `<br>` 当成未闭合的 JSX 标签直接编译报错
 * （`Expected a closing tag for <br>`），GFM 表格单元格里的 `<br><br>` 是最常见来源，
 * 题组材料（QuestionGroup.content）走的是本函数而不是 escapeLatexBraces，所以必须在这里兜住。
 */
export function selfCloseBr(text: string): string {
  if (!text || !/<br/i.test(text)) return text
  return text.replace(/<br\s*\/?>/gi, '<br />')
}

/** 渲染前的统一归一（公式合并 + 填空标签数值属性改字符串写法 + br 自闭合；后续可在此追加其它修补） */
export function normalizeQuestionMdx(text: string): string {
  if (!text) return text
  return stringifyNumericTagAttrs(mergeAdjacentInlineMath(selfCloseBr(text)))
}
