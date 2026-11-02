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

/** 渲染前的统一归一（目前只有公式合并；后续可在此追加其它修补） */
export function normalizeQuestionMdx(text: string): string {
  if (!text) return text
  return mergeAdjacentInlineMath(text)
}
