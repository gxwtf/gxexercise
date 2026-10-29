/**
 * 判题大小写语义自检（独立验收脚本，只读、不连数据库）
 *
 * 口径（来自题库约定）：
 *   1. 选择题（choice / single / multiple，含 cloze / en-reading / seven-choose-five /
 *      math-choice / physics-choice / chinese-reading / chemistry-image）的答案是**选项字母**，
 *      大小写、分隔符（B,D / B D / BD / b、d）、全角字符一律忽略；
 *   2. 语法填空 grammar、选词填空 word-choice 的答案是**单词/短语**，大小写有意义：
 *      「with」与「With」必须判错；但行尾空格、全角字符仍应忽略；
 *   3. 正确答案里的 "##" 表示多个可接受写法，任一命中即算对；
 *   4. 空答案一律判错。
 *
 * 用法（在 gxexercise 仓库根目录）：
 *   npx tsx scripts/check-answer-case.mjs
 *
 * 退出码：0 = 全部通过；1 = 有 FAIL（回归）或有 GUARD（口径守卫被破坏）。
 */

import {
  isAnswerCorrect,
  isCaseSensitiveAnswer,
  normalizeAnswer,
  normalizeChoiceAnswer,
  splitCorrectAnswers,
} from "../src/lib/answer-check.ts"

const CS = { caseSensitive: true }
const CI = { caseSensitive: false }

let pass = 0
const failures = []
const guards = []
const limitations = []

function check(name, actual, expected) {
  const ok = Object.is(actual, expected)
  if (ok) {
    pass++
    console.log(`  ok   ${name}`)
  } else {
    failures.push({ name, actual, expected })
    console.log(`  FAIL ${name}  期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`)
  }
}

/**
 * 口径守卫：这条语义「曾经漏改过 / 很容易被改回去」，单独记录，
 * 一旦它被破坏就说明有人把已经讨论清楚的口径改回去了（与普通 FAIL 区分开看）。
 */
function guard(name, actual, expectedDesired) {
  const ok = Object.is(actual, expectedDesired)
  if (ok) {
    pass++
    console.log(`  ok   ${name}`)
  } else {
    guards.push({ name, actual, expected: expectedDesired })
    console.log(`  GUARD ${name}  期望 ${JSON.stringify(expectedDesired)}，实际 ${JSON.stringify(actual)}`)
  }
}

/** 与本次大小写口径无关、但验收时发现的既有语义限制（只提示，不计入失败） */
function limitation(name, actual, desired) {
  const ok = Object.is(actual, desired)
  if (ok) {
    pass++
    console.log(`  ok   ${name}`)
  } else {
    limitations.push({ name, actual, desired })
    console.log(`  WARN ${name}  当前 ${JSON.stringify(actual)}，期望 ${JSON.stringify(desired)}`)
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`)
}

/* ------------------------------------------------------------------ *
 * 1. 选择题：字母大小写 / 分隔符 / 全角 / 尾随空格 一律忽略
 * ------------------------------------------------------------------ */
section("1. 选择题字母大小写与分隔符不敏感")
check("B vs b", isAnswerCorrect("B", "b"), true)
check("b vs B", isAnswerCorrect("b", "B"), true)
check("B,D vs bd", isAnswerCorrect("B,D", "bd"), true)
check("B D vs B,D（空格分隔）", isAnswerCorrect("B D", "B,D"), true)
check("BD vs B,D（无分隔符）", isAnswerCorrect("BD", "B,D"), true)
check("b、d vs B,D（中文顿号）", isAnswerCorrect("b、d", "B,D"), true)
check("Ｂ，Ｄ vs B,D（全角字母+全角逗号）", isAnswerCorrect("Ｂ，Ｄ", "B,D"), true)
check("' B ' vs B（首尾空格）", isAnswerCorrect("  B  ", "B"), true)
check("C vs A,B（选错）", isAnswerCorrect("C", "A,B"), false)
check("null 作答", isAnswerCorrect(null, "B"), false)
check("undefined 作答", isAnswerCorrect(undefined, "B"), false)

/* ------------------------------------------------------------------ *
 * 2. ## 备选 / 空答案
 * ------------------------------------------------------------------ */
section("2. ## 备选答案与空答案")
check("## 备选：命中第一种", isAnswerCorrect("replaced", "replaced##had replaced"), true)
check("## 备选：命中第二种", isAnswerCorrect("had replaced", "replaced##had replaced"), true)
check("## 备选：都不命中", isAnswerCorrect("replacing", "replaced##had replaced"), false)
check("## 备选：大小写不敏感（默认）", isAnswerCorrect("Had Replaced", "replaced##had replaced"), true)
check("## 备选 + 选择题字母", isAnswerCorrect("d", "B##D"), true)
check("空答案不通过（空串）", isAnswerCorrect("", "B"), false)
check("空答案不通过（纯空格）", isAnswerCorrect("   ", "B"), false)
check("空答案不通过（正确答案为空）", isAnswerCorrect("B", ""), false)
check("空答案不通过（全角空格）", isAnswerCorrect("\u3000\u3000", "B"), false)
check("splitCorrectAnswers 过滤空段", splitCorrectAnswers("A##  ##B").join("|"), "A|B")

/* ------------------------------------------------------------------ *
 * 3. 语法填空 grammar：必须区分大小写，但忽略空格/全角
 * ------------------------------------------------------------------ */
section("3. 语法填空 grammar 严格区分大小写")
check("题型判定：grammar 单词答案", isCaseSensitiveAnswer("input", "grammar", "with"), true)
check("题型判定：grammar 复合备选", isCaseSensitiveAnswer("input", "grammar", "That##which"), true)
check("with == with", isAnswerCorrect("with", "with", CS), true)
check("With != with（首字母大写必须判错）", isAnswerCorrect("With", "with", CS), false)
check("with != With", isAnswerCorrect("with", "With", CS), false)
check("WITH != with（全大写必须判错）", isAnswerCorrect("WITH", "with", CS), false)
check("'With ' == 'With'（行尾空格仍忽略）", isAnswerCorrect("With  ", "With", CS), true)
check("'Ｗｉｔｈ' == 'With'（全角字母归一）", isAnswerCorrect("Ｗｉｔｈ", "With", CS), true)
check("'ｗｉｔｈ' == 'with'（全角小写归一）", isAnswerCorrect("ｗｉｔｈ", "with", CS), true)
check("'Ｗｉｔｈ' != 'with'（全角大写仍需判错）", isAnswerCorrect("Ｗｉｔｈ", "with", CS), false)
check("grammar ## 备选大小写敏感", isAnswerCorrect("that", "That##which", CS), false)
check("grammar ## 备选命中", isAnswerCorrect("which", "That##which", CS), true)
check("grammar 默认（不传选项）忽略大小写——说明必须显式传开关", isAnswerCorrect("With", "with"), true)

/* ------------------------------------------------------------------ *
 * 4. 选词填空 word-choice：单词严格、选项字母不敏感
 * ------------------------------------------------------------------ */
section("4. 选词填空 word-choice")
check("题型判定：word-choice 单词答案", isCaseSensitiveAnswer("input2", "word-choice", "motivation"), true)
check("题型判定：word-choice 语料框字母 a–g 不敏感", isCaseSensitiveAnswer("input2", "word-choice", "a"), false)
// H–K 未享受同一豁免，见第 7 节
check("word-choice 单词大小写敏感", isAnswerCorrect("Motivation", "motivation", CS), false)
check("word-choice 单词命中", isAnswerCorrect("motivation", "motivation", CS), true)
check("word-choice 字母答案大小写不敏感", isAnswerCorrect("h", "H", CI), true)
check("word-choice 字母答案 + 尾随空格", isAnswerCorrect("H ", "H", CI), true)
check("word-choice ## 备选（单词）大小写敏感", isAnswerCorrect("Benefits", "benefits##benefit", CS), false)

/* ------------------------------------------------------------------ *
 * 5. 数学 / 物理 / 语文 / 化学 选择题不受影响
 * ------------------------------------------------------------------ */
section("5. 数学 / 物理 / 语文 / 化学选择题不受影响（字母大小写不敏感）")
for (const [qt, gt] of [
  ["single", "math-choice"],
  ["single", "physics-choice"],
  ["single", "chinese-reading"],
  ["single", "chemistry-image"],
  ["multiple", "math-choice"],
  ["choice", "seven-choose-five"],
  ["choice", "cloze"],
  ["choice", "en-reading"],
]) {
  check(`${gt}：isCaseSensitiveAnswer=false`, isCaseSensitiveAnswer(qt, gt, "D"), false)
}
check("数学选择题 D vs d", isAnswerCorrect("d", "D", CI), true)
check("物理选择题 B vs b", isAnswerCorrect("B", "b", CI), true)
check("语文选择题 A vs a", isAnswerCorrect("a", "A", CI), true)
check("化学图片题（选项字母）C vs c", isAnswerCorrect("c", "C", CI), true)
check("七选五 A vs a", isAnswerCorrect("A", "a", CI), true)
check("七选五 多选 AB vs a,b", isAnswerCorrect("AB", "a,b", CI), true)
check("完形填空 B vs b", isAnswerCorrect("B", "b", CI), true)

/* ------------------------------------------------------------------ *
 * 6. 规范化函数本身
 * ------------------------------------------------------------------ */
section("6. 规范化函数")
check("normalizeAnswer 折叠空白（不敏感）", normalizeAnswer("a   b "), "a b")
check("normalizeAnswer 保留大小写（敏感）", normalizeAnswer("a   B ", CS), "a B")
check("normalizeChoiceAnswer 去分隔符", normalizeChoiceAnswer("B, D、d"), "bdd")
check("normalizeChoiceAnswer 全角", normalizeChoiceAnswer("Ｂ，Ｄ"), "bd")

/* ------------------------------------------------------------------ *
 * 7. 口径守卫：语料框字母（含 A–K 之外的 H/I/J/K）一律按"选项字母"豁免大小写
 *    历史：OPTION_LETTER_ONLY 曾是 /^[A-Ga-g]$/，导致同一份选词填空里
 *    a–g 大小写不敏感、H–K 却严格（学生把 "H" 写成 "h" 被判错）。
 *    现已放宽为 /^[A-Za-z]$/；本节防止有人再把它改窄。
 * ------------------------------------------------------------------ */
section("7. 口径守卫：选词填空语料框字母 H–K 也必须豁免大小写")
guard("题型判定：word-choice 语料框字母 H 不敏感", isCaseSensitiveAnswer("input2", "word-choice", "H"), false)
guard("题型判定：word-choice 语料框字母 K 不敏感", isCaseSensitiveAnswer("input2", "word-choice", "K"), false)
guard(
  "word-choice 答案 H：学生写 'h' 应判对",
  isAnswerCorrect("h", "H", { caseSensitive: isCaseSensitiveAnswer("input2", "word-choice", "H") }),
  true,
)
guard(
  "grammar 的字母答案（单项填空，如 'B'）同样豁免",
  isCaseSensitiveAnswer("input", "grammar", "B"),
  false,
)
// 对照组：同一题组里的 a–g 已经是不敏感的，修的时候不能一起改坏
check("对照：word-choice 字母 a–g 仍不敏感", isCaseSensitiveAnswer("input2", "word-choice", "c"), false)

/* ------------------------------------------------------------------ *
 * 8. 既有语义限制（与大小写无关，仅提示，不计入失败）
 * ------------------------------------------------------------------ */
section("8. 口径取舍与既有语义限制（提示项，不计入失败）")
// grammar 题组里同时存在两种小题：真·语法填空（答案是单词）和「单项填空」（答案是选项字母，
// 库里共 97 题单字母答案，其中 33 题是冠词 "a"、其余是 "故选B" 之类的选项字母）。
// 单看形状分不出二者，因此单字母答案一律按"选项字母"豁免大小写：
// 好处是 97 道字母题的判分不受影响；代价是冠词 "a" 写成 "A" 也会被判对（放宽方向，不会误判错）。
limitation("grammar 单字母答案（唯一真正的冠词 a 类）放宽了大小写",
  isCaseSensitiveAnswer("input", "grammar", "a"), true)
// 判题不排序：学生按 B→A 顺序勾选会提交 "BA"，正确答案 "AB" 会判错；
// 而 ChoiceReview 展示时是排序比较的 → 判题与展示口径不一致（库里 multiple 题仅 2 道，影响面小）
limitation("多选字母顺序不敏感（AB vs BA）", isAnswerCorrect("AB", "BA"), true)

/* ------------------------------------------------------------------ */
const total = pass + failures.length + guards.length
console.log(`\n=== 汇总 ===`)
console.log(`用例总数 ${total}：通过 ${pass}，回归 FAIL ${failures.length}，口径守卫被破坏 GUARD ${guards.length}`)
if (failures.length) {
  console.log("\n[FAIL] 大小写语义回归：")
  for (const f of failures) console.log(`  - ${f.name}（期望 ${JSON.stringify(f.expected)}，实际 ${JSON.stringify(f.actual)}）`)
}
if (guards.length) {
  console.log("\n[GUARD] 已定口径被改回去了（见 src/lib/answer-check.ts 的 OPTION_LETTER_ONLY）：")
  for (const d of guards) console.log(`  - ${d.name}（期望 ${JSON.stringify(d.expected)}，实际 ${JSON.stringify(d.actual)}）`)
}
if (limitations.length) {
  console.log("\n[WARN] 既有语义限制（与大小写无关，建议另行排期）：")
  for (const l of limitations) console.log(`  - ${l.name}（当前 ${JSON.stringify(l.actual)}，期望 ${JSON.stringify(l.desired)}）`)
}
if (!failures.length && !guards.length) {
  console.log("\n结论：PASS —— 判题大小写语义符合口径。")
  process.exit(0)
}
console.log("\n结论：未通过（见上方 FAIL / GUARD 明细）。")
process.exit(1)
