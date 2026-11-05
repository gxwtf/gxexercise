/**
 * 「同材料选择题」的显示去重。
 *
 * 背景：地理（以及部分历史/政治）的选择题常成对出现——「读图，回答第 3、4 题」这类，
 * 一道材料/一张图管两道题。解析器为了让**每道题单独也能看**，把材料复制进了每道题的 content
 * （数据库里是完整的、自洽的，回顾页/组卷/纸质卷都要靠它）。
 * 但「整套选择题练习」时，同组里第 2 道题会把刚看过的材料再显示一遍，很啰嗦。
 *
 * 所以这里做**显示层**的去重：只在前端渲染时，把「与上一题完全相同的材料前缀」从后一题裁掉，
 * 数据一个字都不改。判断方式是公共前缀 + 段落边界，规则很保守：
 *
 *   1. 只跟**上一题的原始内容**比（不连锁比较，避免一串题被裁坏）；
 *   2. 公共前缀 ≥ MIN_PREFIX（40 字）才认为是「同一段材料」；
 *   3. 裁剪点必须落在段落边界：公共前缀正好以空行结尾（`…\n\n`）就整段裁，
 *      否则退到该前缀里**最后一个空行之后**，且累计长度仍要 ≥ MIN_PREFIX；
 *   4. 裁完不能把整道题裁空（`cut < len` 才生效）。
 *
 * 这样「材料 A + 题干甲」「材料 A + 题干乙」会裁成「材料 A + 题干甲」「题干乙」；
 * 而两道材料不同的题（公共前缀很短）完全不受影响。
 */

const MIN_PREFIX = 40

function commonPrefixLen(a: string, b: string): number {
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a.charCodeAt(i) === b.charCodeAt(i)) i += 1
  return i
}

/** 在该前缀里找「可以安全裁到」的位置；找不到返回 0 */
function cutPoint(prefix: string): number {
  if (prefix.length < MIN_PREFIX) return 0
  // 整段材料正好在空行处结束（最常见：材料以 \n\n 收尾）
  if (/\n\s*\n\s*$/.test(prefix)) return prefix.length
  const idx = prefix.lastIndexOf("\n\n")
  if (idx >= MIN_PREFIX) return idx + 2
  return 0
}

/**
 * 返回「用于显示」的题干数组（顺序、长度与入参一致）。
 * 只有成对/连续共享材料的选择题才会被裁掉重复前缀。
 */
export function trimSharedMaterialContents(contents: Array<string | null | undefined>): string[] {
  const raws = contents.map((c) => c ?? "")
  const out: string[] = []
  for (let i = 0; i < raws.length; i += 1) {
    const cur = raws[i]
    if (i === 0) {
      out.push(cur)
      continue
    }
    const prev = raws[i - 1]
    let display = cur
    if (prev && cur) {
      const lcp = commonPrefixLen(prev, cur)
      const cut = lcp >= MIN_PREFIX ? cutPoint(prev.slice(0, lcp)) : 0
      if (cut > 0 && cut < cur.length) display = cur.slice(cut).replace(/^\s+/, "")
    }
    out.push(display)
  }
  return out
}

/** 该题组类型要不要做这种显示去重（只对整卷学科的「选择题」组启用） */
export function usesSharedMaterial(questionType: string | null | undefined): boolean {
  return (
    questionType === "geography-choice" ||
    questionType === "history-choice" ||
    questionType === "politics-choice" ||
    questionType === "biology-choice"
  )
}
