import "dotenv/config"

/**
 * 阅读表达（reading-expression）判分口径的离线样例验证。
 *
 * 目的：证明「模型只输出结构化判断 + src/lib/reading-expression-score.ts 确定性算分」这套口径
 * 符合预期算例，并且可重复跑（线上重判后直接回归）。
 *
 * 跑法（cwd 必须是项目根，因为 grading-prompts 用 process.cwd() 读 prompt 文件）：
 *   cd /home/gxwtf/gxexercise && npx tsx scripts/check-reading-expression.mts
 *
 * 规则用例（A/B/C 组）按精确分值硬判 PASS/FAIL；D 组（43 三维度作文）按宽松区间判，
 * 并把三维度实际取值打印出来。有 FAIL 时以非 0 退出码结束。
 *
 * 注意：只读 src/**，不碰数据库、不重启服务、不跑 build。
 */

import { gradeWithConfig, type GradeResult } from "../src/lib/ai-service"
import { getGradingPrompt, type GradingPromptConfig } from "../src/lib/grading-prompts"

/** 单条用例的模型调用超时（模型 127.0.0.1:8080 / deepseek-v4.1-flash 一般几十秒） */
const TIMEOUT_MS = Number.parseInt(process.env.READ_EXPR_TIMEOUT_MS ?? "240000", 10)

const EPS = 1e-9
/** 0.5 粒度浮点比较 */
const approx = (a: number, b: number) => Math.abs(a - b) < EPS || Math.abs(a - b) < 1e-6

const fmt = (n: unknown) => (typeof n === "number" ? String(Math.round(n * 100) / 100) : String(n))

interface VerifyResult {
  pass: boolean
  /** 判定细节（为什么 PASS/为什么 FAIL） */
  note?: string
}

interface Case {
  /** 用例名，如 "A1" */
  name: string
  /** 题组里的 orderIndex：0/1 → info-points，2 → underline-fix，3 → essay-weights */
  idx: number
  maxScore: number
  stem: string
  correctAnswer: string
  userAnswer: string
  /** 人读的期望 */
  expect: string
  /** 判定函数 */
  verify: (r: GradeResult) => VerifyResult
}

/** 精确分值判定（A/B/C 组硬规则） */
function expectScore(expected: number): (r: GradeResult) => VerifyResult {
  return (r) => ({
    pass: approx(r.score, expected),
    note: approx(r.score, expected) ? "" : `实际 ${fmt(r.score)} ≠ 期望 ${fmt(expected)}`,
  })
}

/** 取某个维度的分值 */
const dim = (r: GradeResult, key: string): number | undefined => {
  const v = r.subScores?.[key]
  return typeof v === "number" && Number.isFinite(v) ? v : undefined
}

/** 43 组：要求 subScores 存在且三维度都是数字 */
function requireDims(r: GradeResult): Record<string, number> | string {
  if (!r.subScores || typeof r.subScores !== "object") return "模型没给 subScores（三维度缺失，无法按维度判定）"
  const keys = ["内容", "语言", "结构"]
  const out: Record<string, number> = {}
  for (const k of keys) {
    const v = dim(r, k)
    if (v === undefined) return `subScores 缺维度「${k}」（实际 ${JSON.stringify(r.subScores)}）`
    out[k] = v
  }
  return out
}

// ─────────────────────────────── 合成语料 ───────────────────────────────

/** A/B 组共用：40/41 信息点制（idx=0） */
const STEM_A = "What are the two reasons the author gives for choosing chemistry?"
const ANSWER_A = "He liked organic chemistry reactions and he wanted different career options."

const STEM_B = "Why did the author want the kids to turn to her for help?"
const ANSWER_B = "Because it meant that she had earned a kid's trust."

/** C 组：42 划线 + 修改（idx=2，满分 3） */
const STEM_C =
  "Please decide which part is false in the following statement, then underline it and explain why.\n\n" +
  "Tracking your health excessively has turned everyday movement into pure enjoyment."
const ANSWER_C =
  "pure enjoyment.\n\n" +
  "Tracking your health excessively has turned everyday movement into something that needs to be continuously monitored and improved."
const FIX_C =
  "Tracking your health excessively has turned everyday movement into something that needs to be continuously monitored and improved."

/** D 组：43 作文（idx=3，满分 5） */
const STEM_D =
  "Do you agree with the writer that hobbies should be a means of pure enjoyment? Why or why not? (In about 40 words)"
const ANSWER_D =
  "Yes. Hobbies should be a means of pure enjoyment because they allow us to relax and reduce stress, " +
  "which benefits our wellbeing and even our productivity at work."

/** D1：库里那条真实作答（约 80 词，完整段落） */
const D1_BODY =
  "Yes, I agree. Because seeing hobbies as pure enjoyment can contribute to our wellbeing. " +
  "Hobbies are activities we enjoy in our leisure time, so it is important for hobbies to truly make ourselves relax, " +
  "which can reduce our stress at work and refresh our mind. Also, by enjoying ourselves in hobbies, " +
  "we can help our brain release dopamine and endorphins, contributing to a passion for hobby and later productivity at work."

/** D1 去掉开头的 "Yes, I agree. "，方便 D4 拼接 */
const D1_REST = D1_BODY.replace(/^Yes, I agree\.\s*/, "")

/** D1 去掉开头两句（"Yes, I agree." 与首句论点句），只剩后面两句完整长句，供 D2 拼接 */
const D1_TAIL = D1_REST.replace(
  /^Because seeing hobbies as pure enjoyment can contribute to our wellbeing\.\s*/,
  "",
)

/** D2：首句写到一半断掉（"contribute to our."），后面接完整句（不重复残句内容，只测「首句不完整」） */
const D2_ANSWER = "Yes, I agree. Because seeing hobbies as pure enjoyment can contribute to our. " + D1_TAIL

/** D3：分条碎片 */
const D3_ANSWER = "Yes. Because hobbies are fun. Pure enjoyment. So yes."

/** D4：极端超额 —— 把 D1 正文重复 3 遍（约 240 词，内容本身通顺） */
const D4_ANSWER = "Yes, I agree. " + Array.from({ length: 3 }, () => D1_REST).join(" ")

// ─────────────────────────────── 用例表 ───────────────────────────────

const CASES: Case[] = [
  {
    name: "A1",
    idx: 0,
    maxScore: 2,
    stem: STEM_A,
    correctAnswer: ANSWER_A,
    userAnswer: "He liked organic chemistry reactions, and he chose it because chemistry pays well.",
    expect: "0.5 = 2 − 1（缺 1 个信息点）− 0.5（说错 1 处冗余）",
    verify: expectScore(0.5),
  },
  {
    name: "A2",
    idx: 0,
    maxScore: 2,
    stem: STEM_A,
    correctAnswer: ANSWER_A,
    userAnswer: "He liked organic chemistry reactions.",
    expect: "1 = 2 − 1（只答对 1 个信息点）",
    verify: expectScore(1),
  },
  {
    name: "A3",
    idx: 0,
    maxScore: 2,
    stem: STEM_A,
    correctAnswer: ANSWER_A,
    userAnswer:
      "He liked organic chemistry reactions and he wanted different career options. He also enjoyed his teachers a lot.",
    expect: "1.5 = 2 − 0.5（多 1 处冗余）",
    verify: expectScore(1.5),
  },
  {
    name: "B1",
    idx: 0,
    maxScore: 2,
    stem: STEM_B,
    correctAnswer: ANSWER_B,
    userAnswer: "Because she wanted to earn the kids' trust and she also needed more money from the school.",
    expect: "1.5 = 2 − 0.5（1 个信息点答对 + 1 处冗余）",
    verify: expectScore(1.5),
  },
  {
    name: "C1",
    idx: 2,
    maxScore: 3,
    stem: STEM_C,
    correctAnswer: ANSWER_C,
    userAnswer: "pure enjoyment.\n" + FIX_C,
    expect: "3 = 划线 1 + 修改 2",
    verify: expectScore(3),
  },
  {
    name: "C2",
    idx: 2,
    maxScore: 3,
    stem: STEM_C,
    correctAnswer: ANSWER_C,
    // 只划 chunk 里的一个词 → 不完整
    userAnswer: "enjoyment\n" + FIX_C,
    expect: "2 = 划线 0（不完整 chunk）+ 修改 2",
    verify: expectScore(2),
  },
  {
    name: "C3",
    idx: 2,
    maxScore: 3,
    stem: STEM_C,
    correctAnswer: ANSWER_C,
    // 划线位置错，但海淀标准：照样判修改
    userAnswer: "Tracking your health\n" + FIX_C,
    expect: "2 = 划线 0（位置错）+ 修改 2",
    verify: expectScore(2),
  },
  {
    name: "C4",
    idx: 2,
    maxScore: 3,
    stem: STEM_C,
    correctAnswer: ANSWER_C,
    userAnswer: "pure enjoyment.",
    expect: "1 = 划线 1 + 修改 0（没给修改）",
    verify: expectScore(1),
  },
  {
    name: "D1",
    idx: 3,
    maxScore: 5,
    stem: STEM_D,
    correctAnswer: ANSWER_D,
    userAnswer: D1_BODY,
    expect: "总分 ≥4；内容>0、语言>0、结构=1（完整段落）",
    verify: (r) => {
      const d = requireDims(r)
      if (typeof d === "string") return { pass: false, note: d }
      const pass = r.score >= 4 - EPS && d["内容"] > 0 && d["语言"] > 0 && approx(d["结构"], 1)
      return {
        pass,
        note: `总分 ${fmt(r.score)}（需 ≥4）；内容 ${fmt(d["内容"])}、语言 ${fmt(d["语言"])}（需 >0）、结构 ${fmt(d["结构"])}（需 =1）`,
      }
    },
  },
  {
    name: "D2",
    idx: 3,
    maxScore: 5,
    stem: STEM_D,
    correctAnswer: ANSWER_D,
    userAnswer: D2_ANSWER,
    expect: "结构 ≤0.5（首句写到一半断掉）",
    verify: (r) => {
      const d = requireDims(r)
      if (typeof d === "string") return { pass: false, note: d }
      const pass = d["结构"] <= 0.5 + EPS
      return { pass, note: `结构 ${fmt(d["结构"])}（需 ≤0.5）；总分 ${fmt(r.score)}` }
    },
  },
  {
    name: "D3",
    idx: 3,
    maxScore: 5,
    stem: STEM_D,
    correctAnswer: ANSWER_D,
    userAnswer: D3_ANSWER,
    expect: "结构 = 0 或 0.5，且总分 ≤2（分条碎片）",
    verify: (r) => {
      const d = requireDims(r)
      if (typeof d === "string") return { pass: false, note: d }
      const structOk = approx(d["结构"], 0) || approx(d["结构"], 0.5)
      const totalOk = r.score <= 2 + EPS
      return {
        pass: structOk && totalOk,
        note: `结构 ${fmt(d["结构"])}（需 0 或 0.5）、总分 ${fmt(r.score)}（需 ≤2）；内容 ${fmt(d["内容"])}、语言 ${fmt(d["语言"])}`,
      }
    },
  },
  {
    name: "D4",
    idx: 3,
    maxScore: 5,
    stem: STEM_D,
    correctAnswer: ANSWER_D,
    userAnswer: D4_ANSWER,
    expect: "总分 ≥3，内容/语言不被字数惩罚（超字数不扣分）",
    verify: (r) => {
      const d = requireDims(r)
      if (typeof d === "string") return { pass: false, note: d }
      const totalOk = r.score >= 3 - EPS
      // 字数惩罚的软检查：内容/语言若被压到 ≤1 分，说明可能按字数扣了分
      const noLengthPenalty = d["内容"] >= 1.5 - EPS && d["语言"] >= 1.5 - EPS
      return {
        pass: totalOk,
        note:
          `总分 ${fmt(r.score)}（需 ≥3）；内容 ${fmt(d["内容"])}、语言 ${fmt(d["语言"])}、结构 ${fmt(d["结构"])}` +
          (noLengthPenalty ? "（内容/语言未被字数压低 ✓）" : "（⚠ 内容或语言 ≤1，疑似被字数/重复惩罚）"),
      }
    },
  },
]

// ─────────────────────────────── 执行 ───────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`调用超时（${ms}ms）：${label}`)), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

function configFor(c: Case): GradingPromptConfig {
  const config = getGradingPrompt("reading-expression", c.idx)
  if (!config) throw new Error(`getGradingPrompt("reading-expression", ${c.idx}) 返回 null`)
  if (!config.scoring) throw new Error(`idx=${c.idx} 的配置缺 scoring 字段（确定性算分未启用）`)
  return config
}

interface Outcome {
  c: Case
  pass: boolean
  score: number | null
  subScores?: Record<string, number>
  raw?: unknown
  feedback?: string
  note?: string
  error?: string
  ms: number
}

function printOutcome(o: Outcome) {
  const status = o.error ? "ERROR" : o.pass ? "PASS" : "FAIL"
  console.log("")
  console.log(`── ${o.c.name} [${status}]  idx=${o.c.idx} 满分=${o.c.maxScore}  (${o.ms}ms)`)
  console.log(`   期望: ${o.c.expect}`)
  console.log(`   实际: ${o.error ? `调用失败：${o.error}` : `score=${fmt(o.score)}${o.subScores ? `  subScores=${JSON.stringify(o.subScores)}` : ""}`}`)
  if (o.note) console.log(`   判定: ${o.note}`)
  console.log(`   学生作答: ${JSON.stringify(o.c.userAnswer)}`)
  console.log(`   模型结构化判断(raw): ${o.raw === undefined ? "(无)" : JSON.stringify(o.raw)}`)
  console.log(`   feedback: ${o.feedback ? JSON.stringify(o.feedback) : "(空)"}`)
}

async function runCase(c: Case): Promise<Outcome> {
  const started = Date.now()
  try {
    const config = configFor(c)
    const r = await withTimeout(
      gradeWithConfig(config, c.stem, c.userAnswer, c.correctAnswer, c.maxScore),
      TIMEOUT_MS,
      c.name,
    )
    const v = c.verify(r)
    return {
      c,
      pass: v.pass,
      score: r.score,
      subScores: r.subScores,
      raw: r.raw,
      feedback: r.feedback,
      note: v.note,
      ms: Date.now() - started,
    }
  } catch (err) {
    return {
      c,
      pass: false,
      score: null,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - started,
    }
  }
}

async function main() {
  console.log("=".repeat(100))
  console.log("阅读表达判分口径 · 离线样例验证")
  console.log(`模型: ${process.env.OPENAI_MODEL} @ ${process.env.OPENAI_BASE_URL}`)
  console.log(`用例数: ${CASES.length}（A/B/C 组硬规则精确判分，D 组宽松区间）  cwd=${process.cwd()}`)
  console.log(`单条超时: ${TIMEOUT_MS}ms（可用 READ_EXPR_TIMEOUT_MS 覆盖）`)
  console.log("=".repeat(100))

  // 预检：四段配置都在（0/1 → info-points，2 → underline-fix，3 → essay-weights）
  const preflight = [0, 1, 2, 3].map((idx) => {
    const config = getGradingPrompt("reading-expression", idx)
    return `  idx=${idx} → ${config?.scoring ?? "(无配置)"}`
  })
  console.log("【配置预检】")
  preflight.forEach((l) => console.log(l))
  console.log("")

  const outcomes: Outcome[] = []
  // 串行跑，避免并发打爆网关
  for (const c of CASES) {
    const o = await runCase(c)
    outcomes.push(o)
    printOutcome(o)
  }

  const passed = outcomes.filter((o) => o.pass)
  const failed = outcomes.filter((o) => !o.pass)

  console.log("")
  console.log("=".repeat(100))
  console.log("【汇总】")
  console.log(`  PASS ${passed.length} / ${outcomes.length}：${passed.map((o) => o.c.name).join(", ") || "(无)"}`)
  console.log(`  FAIL ${failed.length} / ${outcomes.length}：${failed.map((o) => o.c.name).join(", ") || "(无)"}`)
  for (const o of failed) {
    const why = o.error ? `ERROR(${o.error})` : `实际 ${fmt(o.score)}${o.note ? `｜${o.note}` : ""}`
    console.log(`   ✗ ${o.c.name}: 期望 ${o.c.expect}；${why}`)
  }
  console.log(`\n  结论: ${failed.length === 0 ? "全部用例通过 ✅" : `${failed.length} 条未通过 ❌`}`)
  console.log(`  耗时: ${(outcomes.reduce((a, o) => a + o.ms, 0) / 1000).toFixed(1)}s`)
  console.log("=".repeat(100))

  if (failed.length > 0) process.exitCode = 1
}

await main()
