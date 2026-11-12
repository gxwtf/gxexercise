import "dotenv/config"

/**
 * 语文大作文（chinese-essay）判分口径验证 —— **两段**：
 *
 * A. 纯算分自测（不调模型）：把 `src/lib/essay-score.ts` 的 §4 公式逐条钉死。
 *    覆盖 §14 完整走查（应得 38）、A 级三档上限（39/35/32）、A1 无关 / A2 贯穿（≤32）、
 *    A7′ 四档（0/2/4/6，all 另带上限 39）、字数条款（<600 → A10；<400 → ≤25；600–699 → C7）、
 *    D 级最多计 3 条、L 合计封顶 +9、.5 向上取整、非 50 分制等比换算、
 *    以及「模型乱写编号 / 缺字段 → 抛错」「记叙文 → 跳过」。
 *    这一段的期望值全部来自 SPEC 原文，**改规格才许改这里**。
 *
 * B. 两个校准锚（调真实模型，走 getGradingPrompt → gradeWithConfig → essay-score.ts 全链路）：
 *    SPEC §13 说这两个锚是「刻度的定义」，必须得到 43 和 50；
 *    它同时验证了提示词与算分能不能对上，所以这一段才是进口径的准入门槛。
 *
 * 跑法（cwd 必须是项目根：grading-prompts 用 process.cwd() 读 prompt 文件）：
 *   cd /home/gxwtf/gxexercise && pnpm check:essay
 *
 * 末行打印 PASS / FAIL；FAIL 时以非 0 退出码结束。
 * 注意：只读 src/**、只调模型，不碰数据库、不重启服务、不跑 build。
 */

import { gradeWithConfig } from "../src/lib/ai-service"
import { getGradingPrompt } from "../src/lib/grading-prompts"
import { computeEssayScore } from "../src/lib/essay-score"
import { countEssayWords } from "../src/lib/essay-review"

/** 单篇作文的模型调用超时（单篇 7–12s，留足余量；可用 ESSAY_GRADING_TIMEOUT_MS 覆盖） */
const TIMEOUT_MS = Number.parseInt(process.env.ESSAY_GRADING_TIMEOUT_MS ?? "180000", 10)

/**
 * 锚文的题干。SPEC §13 只给了两篇作文与期望分数，没给题干 —— 两篇都是「兼听」，
 * 所以这里用一句最贴近的题目。锚一/锚二都应当零 A 级命中（不是离题、不是架空），
 * 题干措辞不影响 43 / 50 的结论；但**同一批人跑口径时请用同一个题干**（可用
 * ESSAY_ANCHOR_STEM 覆盖），否则 A1/A2 的判断没有可比性。
 */
const ANCHOR_STEM =
  process.env.ESSAY_ANCHOR_STEM?.trim() ||
  "请以“说‘兼听’”为题，写一篇议论文。要求：观点明确，论据充分，论证合理；不少于700字。"

/** SPEC §13 锚一《兼听则明》（原文照抄；非空白字符口径约 900 字） */
const ANCHOR_BASELINE = `兼听，是多方听取不同声音，主动吸纳与自身观点相左的意见，用于矫正自身认知偏颇。古人常说"兼听则明"，而大数据时代"兼听"又容易让人困惑迷失——这两种看法看似矛盾，实则指向同一个问题：兼听的效果取决于我们听到的是不是真正"不同"的声音。在大数据时代，这个问题尤为迫切。我认为，越是信息繁杂的时代，越需要回归兼听的本义——主动听取不同声音，矫正认知偏颇。

兼听之所以能让人明辨是非，原因在于每个人的经验、视角和信息来源都是有限的。我们看待事物，总是站在自己的位置上，用自己已有的经验和观念去判断。这个判断过程天然存在盲区——你不知道自己看不到什么。不同声音的价值，正在于此：它暴露了你视角的盲区，让你看到自己看不到的那一面。盲区被看见之后，原有判断才有可能得到修正，修正后的判断更接近事实全貌。这就是"兼听"导向"明"的机制。

兼听的意义，在于它能帮助决策者突破自身视角的局限，做出更周全的判断。唐太宗李世民深谙此理。唐代名臣魏征的谏言常常与太宗本意相左，有时甚至当面驳斥太宗的主张，令太宗难堪。但太宗之所以仍然听取，正是因为他知道自己的判断可能有盲区——身居宫墙之内，对民间疾苦和施政弊端未必看得全。魏征的直谏提供了太宗看不到的视角，太宗据此修正了多项决策。如果太宗只听顺耳之言，这些盲区就会一直存在，最终导致判断失误。可见，"不同意见""主动吸纳""矫正偏颇"同时具备，兼听的价值才真正体现。

然而，兼听的价值在当代面临着新的挑战。大数据时代，算法推荐机制根据用户的浏览偏好，持续推送与用户立场一致的信息，屏蔽外界的反对声音。人们看似每天接收大量信息，实则只听到同质化的回声——这根本不是兼听，而是一种新型的闭目塞听。更值得警惕的是，身处信息茧房中的人往往意识不到自己的封闭，因为推送的内容足够丰富、足够多，让人误以为自己已经"兼听"了。信息茧房之害，正在于以"多"的表象遮蔽了"不同"的缺失却毫无警惕。

因此，在大数据时代践行兼听，需要我们主动打破算法编织的信息茧房，有意识地去接触与自己立场不同的声音。兼听不是全盘接收，而是在听取之后仍需独立判断。但判断的前提是先听到不同的声音——如果连"不同"都接触不到，判断力再强也无从施展。当代人拥有比历史上任何时代都更充分的信息获取条件，关键在于我们是否愿意主动走出同质信息的舒适区，去听那些让自己不那么舒服的声音。

愿我们都能做到真正的兼听，在多元声音中走向明辨。`

/** SPEC §13 锚二《兼听之难》（原文照抄；约 1050 字） */
const ANCHOR_FULL = `"兼听则明"是古人的处世智慧，其道理看似浅显：多方听取不同声音，自然能矫正偏颇、通达事理。然而在大数据时代，每天都有各种各样的"声音"向我们涌来，兼听似乎没有让人更明辨，反而让人更困惑。这是否意味着兼听失灵了？并非如此。兼听的价值依然成立，只是在当代，践行兼听所面临的障碍远比古代复杂；而越是在这种条件下，兼听越值得作为品格来涵养。

兼听的意义，在于它能打破个人视角的局限。每个人的经验、立场和信息渠道都是有限的，我们看待事物时，总带着自己的盲区。苏轼有诗云："横看成岭侧成峰，远近高低各不同。"同一座山，因观察位置不同而呈现迥异的样貌；同一件事，也因立场不同而各有各的道理。唐太宗兼听魏征，并非因为魏征说得对，而是因为魏征说的与太宗本意相左——正是这种相左，补全了太宗身居高位时看不到的视角。兼听让我们接触到不同的视角，发现自己看不到的盲区，从而修正判断、走向明辨。

然而在当代，兼听所面临的障碍远非古人所能想象。当今时代信息不是太少，而是太多且同质化。算法推荐机制根据用户的浏览偏好持续推送立场一致的内容，将人关在信息茧房中。人们每天接触大量信息，却只听到同一种声音的反复回响。柏拉图"洞穴喻"中的囚徒，只看到墙上的影子，便以为那就是全部真实；信息茧房中的人同样如此——以为自己接收了大量信息就是"兼听"了，实则连一种不同的声音都没有听到。更隐蔽的障碍在于，茧房中的信息足够丰富、足够多，让人毫无觉察地陷入认知封闭。偏信之暗，暗在不知其暗；茧房之困，困在不知其困。

更令人迷茫的是，即便我们能主动走出茧房，面对的信息环境也并不理想——不同观点之间常常不是互补关系，而是冲突关系；有些声音理性中肯，有些偏激情绪化，还有些刻意挑拨……在这样嘈杂的声音场域中，兼听容易滑向两个极端：要么全盘接收，失去主见，在不同立场之间左右摇摆；要么因不堪其烦而退回茧房，重新拥抱同质信息的舒适。前者是盲从，后者是偏信，两者都不是兼听。

正因如此，当代的兼听比古代更可贵。唐太宗兼听，面对的不过是朝堂之上大臣们的谏言，声音有限，立场清晰。当代人面对的却是整个互联网的声音场域——数量庞大、立场繁杂、真假混杂。在这样条件下仍能做到兼听，对人的判断力、定力和认知谦逊都提出了更高的要求。但这也正是兼听在当代的特殊意义：它不再只是听取意见的手段，更是对一个人能否在嘈杂中保持清醒、在多元中坚持思考的考验。当代人拥有比唐太宗更充分的信息获取条件，也面临比唐太宗更复杂的听取环境。条件更好，挑战也更大。

因此，在当代践行兼听，需要我们主动走出算法茧房，有意识地去接触不同立场的声音；在听到不同声音后，不盲从、不排斥，而是以独立判断为前提进行甄别和吸纳——在反复的听取与判断中，磨炼出坚定的自我认知、判断能力、取舍智慧。

兼听之明，不仅来自听到不同声音，更来自在纷繁声音中仍能保持清醒和判断力这一品格本身。`

// ─────────────────────────────── 工具 ───────────────────────────────

const fmt = (n: number) => String(Math.round(n * 100) / 100)
const approx = (a: number, b: number) => Math.abs(a - b) < 1e-6

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

/** 造一份「合法但全空」的模型输出，用例只覆盖要测的字段 */
function essayRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    propositionType: "T1",
    genre: "议论",
    coreConcept: "测试概念",
    mainBodyCount: 4,
    aHits: [],
    a1Unrelated: false,
    a2Pervasive: false,
    a7Band: "none",
    lHits: [],
    bHits: [],
    cHits: [],
    dHits: [],
    evidence: {},
    verdict: "论点清楚，但例子没有讲到机制，所以停在二类。",
    suggestions: ["第③段的例子后面补一句『为什么』，说明它怎样支持你的判断。"],
    direction: "第③段补齐因果链。",
    ...overrides,
  }
}

/** 造一段指定字数的作文（字数口径 = countEssayWords = 字符数，含标点与换行） */
const essayOfLength = (n: number) => "字".repeat(n)

// ─────────────────────────── A. 纯算分自测（不调模型） ───────────────────────────

type Expect = number | "throw" | "skip"

interface LogicCase {
  name: string
  raw: () => Record<string, unknown>
  maxScore: number
  answer: string
  expect: Expect
  why: string
}

const LOGIC_CASES: LogicCase[] = [
  {
    name: "A1 §14 完整走查（降噪卷：L1+L6+L7，B12/C1/C11，D1/D3）",
    raw: () =>
      essayRaw({
        lHits: ["L1", "L6", "L7"],
        bHits: ["B12"],
        cHits: ["C1", "C11"],
        dHits: ["D1", "D3"],
      }),
    maxScore: 50,
    answer: essayOfLength(874),
    expect: 38,
    why: "SPEC §14：L=5 → 43+5=48 → 48−4−2−2−2 = 38",
  },
  {
    name: "A2 锚一的命中集合（零错误零亮点）",
    raw: () => essayRaw(),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 43,
    why: "SPEC §13 锚一：无 L、无 B/C/D/A7′ → 43",
  },
  {
    name: "A3 锚二的命中集合（L1–L5 合计 +7）",
    raw: () => essayRaw({ lHits: ["L1", "L2", "L3", "L4", "L5"] }),
    maxScore: 50,
    answer: essayOfLength(1050),
    expect: 50,
    why: "SPEC §13 锚二：L=7 → 43+7=50",
  },
  {
    name: "A4 L 合计封顶 +9（8 条命中合计 11.5 分）",
    raw: () => essayRaw({ lHits: ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L9"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 50,
    why: "43+9=52 → 封顶 50",
  },
  {
    name: "A5 先封顶再扣分（满亮点 + 一条 B）",
    raw: () =>
      essayRaw({
        lHits: ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L9"],
        bHits: ["B1"],
      }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 46,
    why: "43+9=52 → 封顶 50 → −4 = 46（顺序不可交换）",
  },
  {
    name: "A6 .5 向上取整（L2 = +1.5）",
    raw: () => essayRaw({ lHits: ["L2"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 45,
    why: "43+1.5=44.5 → 向上取整 45",
  },
  {
    name: "A7 A 级 1 条 → 上限 39",
    raw: () => essayRaw({ aHits: ["A4"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 39,
    why: "43 → 套 A 级上限 39",
  },
  {
    name: "A8 A 级 2 条 → 上限 35",
    raw: () => essayRaw({ aHits: ["A3", "A4"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 35,
    why: "43 → 套 A 级上限 35",
  },
  {
    name: "A9 A 级 3 条 → 上限 32",
    raw: () => essayRaw({ aHits: ["A3", "A4", "A5"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 32,
    why: "43 → 套 A 级上限 32",
  },
  {
    name: "A10 A1 且与题干毫无关系 → ≤32",
    raw: () => essayRaw({ aHits: ["A1"], a1Unrelated: true }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 32,
    why: "SPEC §6 A1：Y 与题干毫无关系 → 上限 32",
  },
  {
    name: "A11 A2 且贯穿全文 → ≤32",
    raw: () => essayRaw({ aHits: ["A2"], a2Pervasive: true }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 32,
    why: "SPEC §6 A2：贯穿全文 → 上限 32",
  },
  {
    name: "A12 A7′ mid（1/2–2/3）→ −2",
    raw: () => essayRaw({ a7Band: "mid" }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 41,
    why: "43−2 = 41",
  },
  {
    name: "A13 A7′ high（≥2/3）→ −4",
    raw: () => essayRaw({ a7Band: "high" }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 39,
    why: "43−4 = 39",
  },
  {
    name: "A14 A7′ all（全篇皆例）→ −6 且上限 39",
    raw: () => essayRaw({ a7Band: "all" }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 37,
    why: "43−6 = 37（上限 39 不更严）",
  },
  {
    name: "A15 a7Band 别名 lt-half 视为不扣",
    raw: () => essayRaw({ a7Band: "lt-half" }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 43,
    why: "lt-half 与 none 同为 0 分",
  },
  {
    name: "A16 D 级最多计 3 条（命中 5 条 → −3）",
    raw: () => essayRaw({ dHits: ["D1", "D2", "D3", "D4", "D5"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 40,
    why: "43−1×3 = 40",
  },
  {
    name: "A17 字数 550 → 程序追加 A10（上限 39）",
    raw: () => essayRaw(),
    maxScore: 50,
    answer: essayOfLength(550),
    expect: 39,
    why: "SPEC §6 A10：<600 字 → A 级 1 条 → 39",
  },
  {
    name: "A18 字数 350 → <400 再套上限 25",
    raw: () => essayRaw(),
    maxScore: 50,
    answer: essayOfLength(350),
    expect: 25,
    why: "SPEC §6 A10：<400 字 → 上限 25",
  },
  {
    name: "A19 字数 650 → 程序追加 C7（−2）",
    raw: () => essayRaw(),
    maxScore: 50,
    answer: essayOfLength(650),
    expect: 41,
    why: "SPEC §9 C7：600–699 字 → −2",
  },
  {
    name: "A20 模型自报 A10 被丢弃（字数够，不该扣）",
    raw: () => essayRaw({ aHits: ["A10"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 43,
    why: "A10 只认程序数出来的字数",
  },
  {
    name: "A21 模型自报 C7 被丢弃（字数够，不该扣）",
    raw: () => essayRaw({ cHits: ["C7"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 43,
    why: "C7 只认程序数出来的字数",
  },
  {
    // 回归用例：parseCodeEntry 的字符类曾经写成 [ABDL]（漏了 C），于是任何 C 级命中都会被判成
    // 「非法编号」→ 抛错重试 → 命中任一 C 级的作文永远出不了分。这条同时钉住多位数编号（C10/C11）
    // 与带注释的编号写法。
    name: "A21b C 级编号解析（C2 / C10 / C11 三条命中 → −6）",
    raw: () => essayRaw({ cHits: ["C2", "C10（事实错误）", "C11"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 37,
    why: "43 − 2×3 = 37",
  },
  {
    name: "A22 非 50 分制（60 分题）等比换算、不套字数条款",
    raw: () => essayRaw(),
    maxScore: 60,
    answer: essayOfLength(500),
    expect: 51.5,
    why: "43/50 × 60 = 51.6 → 取 0.5 粒度 51.5；500 字不套 A10",
  },
  {
    name: "A23 非 50 分制（40 分题）等比换算",
    raw: () => essayRaw(),
    maxScore: 40,
    answer: essayOfLength(900),
    expect: 34.5,
    why: "43/50 × 40 = 34.4 → 34.5",
  },
  {
    name: "A24 记叙文（genre=记叙）→ 跳过，不出分",
    raw: () => essayRaw({ genre: "记叙" }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: "skip",
    why: "v1.5 只量议论文，记叙文不评分（避免误伤到二类下/三类）",
  },
  {
    name: "A25 非法编号（B3 不存在）→ 抛错，不写假分数",
    raw: () => essayRaw({ bHits: ["B3"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: "throw",
    why: "SPEC 的 B 级没有 B3；模型胡写编号必须当失败重试",
  },
  {
    name: "A26 缺字段（没有 verdict）→ 抛错",
    raw: () => {
      const raw = essayRaw()
      delete raw.verdict
      return raw
    },
    maxScore: 50,
    answer: essayOfLength(900),
    expect: "throw",
    why: "缺字段一律当模型输出不合格",
  },
  {
    name: "A27 缺 genre → 抛错（体裁闸门必须有结论）",
    raw: () => {
      const raw = essayRaw()
      delete raw.genre
      return raw
    },
    maxScore: 50,
    answer: essayOfLength(900),
    expect: "throw",
    why: "拿不准体裁就不该出分",
  },
  {
    name: "A28 模型完全没给 JSON → 抛错",
    raw: () => undefined as unknown as Record<string, unknown>,
    maxScore: 50,
    answer: essayOfLength(900),
    expect: "throw",
    why: "raw 缺失（解析失败）时必须抛错而不是给 0 分",
  },
  // ── 编号解析：C 级（曾有 bug：parseCodeEntry 的字符类漏了 C，导致任何 C 级命中都抛「非法编号」，
  //    两个校准锚的 cHits 恰好是空数组，所以全链路 PASS 也照样漏过 —— 这类用例必须常态覆盖）
  {
    name: "A29 C1 单命中 → −2",
    raw: () => essayRaw({ cHits: ["C1"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 41,
    why: "43−2 = 41",
  },
  {
    name: "A30 C2 单命中 → −2",
    raw: () => essayRaw({ cHits: ["C2"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 41,
    why: "43−2 = 41",
  },
  {
    name: "A31 C10 单命中（两位数编号）→ −2",
    raw: () => essayRaw({ cHits: ["C10"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 41,
    why: "43−2 = 41；顺带钉住 C10 不会被截成 C1",
  },
  {
    name: "A32 C11 单命中 → −2",
    raw: () => essayRaw({ cHits: ["C11"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 41,
    why: "43−2 = 41",
  },
  {
    name: "A33 C1 + C11 双命中 → −4（数量口径）",
    raw: () => essayRaw({ cHits: ["C1", "C11"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 39,
    why: "43−2×2 = 39",
  },
  {
    name: "A34 小写编号 c1 归一为 C1",
    raw: () => essayRaw({ cHits: ["c1"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 41,
    why: "模型偶尔写小写；归一后按 C1 计 −2",
  },
  {
    name: "A35 全角编号 Ｃ１ 归一为 C1",
    raw: () => essayRaw({ cHits: ["Ｃ１"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 41,
    why: "NFKC 归一后按 C1 计 −2",
  },
  {
    name: "A36 多位数编号 A11 / B12 / D10 都能解析",
    raw: () => essayRaw({ aHits: ["A11"], bHits: ["B12"], dHits: ["D10"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 38,
    why: "43−4(B12)−1(D10) = 38；A11 只给它那条上限 39（不更严）",
  },
  {
    name: "A37 A1 的说明写在编号里（「A1（与题干无关）」）也能识别为无关",
    raw: () => essayRaw({ aHits: ["A1（与题干无关）"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 32,
    why: "SPEC §6 A1：与题干毫无关系 → 上限 32",
  },
  {
    name: "A38 A7′ all 且亮点多 → 扣 6 后套上限 39",
    raw: () => essayRaw({ lHits: ["L1", "L6", "L7"], a7Band: "all" }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 39,
    why: "43+5=48 → −6 = 42 → 全篇皆例上限 39",
  },
  {
    name: "A39 字数 599（A10 边界内侧）→ 上限 39",
    raw: () => essayRaw(),
    maxScore: 50,
    answer: essayOfLength(599),
    expect: 39,
    why: "599 < 600 → A10 → 39",
  },
  {
    name: "A40 字数 699（C7 边界内侧）→ −2",
    raw: () => essayRaw(),
    maxScore: 50,
    answer: essayOfLength(699),
    expect: 41,
    why: "600–699 → C7 −2",
  },
  {
    name: "A41 字数 700（不扣）",
    raw: () => essayRaw(),
    maxScore: 50,
    answer: essayOfLength(700),
    expect: 43,
    why: "700 不再触发 C7 / A10",
  },
  {
    name: "A42 D 级 4 条只计 3（−3）",
    raw: () => essayRaw({ dHits: ["D1", "D2", "D3", "D4"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 40,
    why: "43−1×min(4,3) = 40",
  },
  {
    name: "A43 未启用的 L8/L10/L11 被忽略（不抛错、不加分）",
    raw: () => essayRaw({ lHits: ["L8", "L10", "L11"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 43,
    why: "SPEC §16：本版未启用，命中也不计",
  },
  {
    name: "A44 aHits 里的 A7 被丢弃（以例代议只走 a7Band）",
    raw: () => essayRaw({ aHits: ["A7"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 43,
    why: "A7 不在 A 级；a7Band=none 故不扣",
  },
  // ── C8（错别字）：SPEC §9 是**唯一分两档**的条款（≥3 处 −1 / ≥6 处 −2）。
  //    编号带不了档位，所以改由 counts.c8ErrorCount 判；缺计数时退回旧行为（写 C8 就 −2）。
  {
    name: "A45 C8 计数 0 → 不扣",
    raw: () => essayRaw({ counts: { c8ErrorCount: 0 } }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 43,
    why: "<3 处不计",
  },
  {
    name: "A46 C8 计数 2 → 不扣（未到 3 处阈值）",
    raw: () => essayRaw({ counts: { c8ErrorCount: 2 } }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 43,
    why: "<3 处不计",
  },
  {
    name: "A47 C8 计数 3 → −1（≥3 档下界）",
    raw: () => essayRaw({ counts: { c8ErrorCount: 3 } }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 42,
    why: "43−1 = 42",
  },
  {
    name: "A48 C8 计数 5 → −1（≥3 档上界）",
    raw: () => essayRaw({ counts: { c8ErrorCount: 5 } }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 42,
    why: "43−1 = 42",
  },
  {
    name: "A49 C8 计数 6 → −2（≥6 档下界）",
    raw: () => essayRaw({ counts: { c8ErrorCount: 6 } }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 41,
    why: "43−2 = 41",
  },
  {
    name: "A50 C8 计数 10 → −2",
    raw: () => essayRaw({ counts: { c8ErrorCount: 10 } }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 41,
    why: "43−2 = 41",
  },
  {
    name: "A51 兼容路径：cHits 含 C8 且缺 counts → −2",
    raw: () => essayRaw({ cHits: ["C8"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 41,
    why: "老提示词/老数据不炸：C8 按 ≥6 档执行 −2",
  },
  {
    name: "A52 cHits 含 C8 但 counts.c8ErrorCount=4 → 以 counts 为准 −1",
    raw: () => essayRaw({ cHits: ["C8"], counts: { c8ErrorCount: 4 } }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 42,
    why: "43−1 = 42（计数优先，模型自报的 C8 忽略）",
  },
  {
    name: "A53 C8 与其它 C 级同时命中按条累加（C1 + C8×4 处）",
    raw: () => essayRaw({ cHits: ["C1"], counts: { c8ErrorCount: 4 } }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 40,
    why: "43−2(C1)−1(C8) = 40",
  },
  {
    name: "A54 counts 在但缺 c8ErrorCount、也没写 C8 → 不扣",
    raw: () => essayRaw({ counts: { bodyParagraphs: 4 } }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 43,
    why: "无计数、无自报 → 不计",
  },
  {
    name: "A55 counts.c8ErrorCount 非法（\"abc\"）+ cHits 含 C8 → 忽略计数、退回 −2",
    raw: () => essayRaw({ counts: { c8ErrorCount: "abc" }, cHits: ["C8"] }),
    maxScore: 50,
    answer: essayOfLength(900),
    expect: 41,
    why: "非法计数只告警不抛错；C8 按兼容路径 −2",
  },
]

interface LogicOutcome {
  c: LogicCase
  pass: boolean
  note: string
}

function runLogicCase(c: LogicCase): LogicOutcome {
  const raw = c.raw()
  try {
    const out = computeEssayScore({ raw, userAnswer: c.answer, maxScore: c.maxScore, model: "self-test" })
    if (c.expect === "throw") {
      return { c, pass: false, note: `期望抛错，实际返回 status=${out.status}` }
    }
    if (c.expect === "skip") {
      return out.status === "skipped"
        ? { c, pass: true, note: `已跳过（reason=${out.reason}）` }
        : { c, pass: false, note: `期望跳过，实际 status=${out.status} score=${fmt(out.score)}` }
    }
    if (out.status !== "scored") {
      return { c, pass: false, note: `期望 ${fmt(c.expect)} 分，实际被跳过（reason=${out.reason}）` }
    }
    const pass = approx(out.score, c.expect)
    return {
      c,
      pass,
      note: out.status === "scored"
        ? `${pass ? "✓" : "✗"} 实际 ${fmt(out.score)}（50 分制 ${out.scoreFifty}），档位 ${out.essayReview.band} ${out.essayReview.range}，字数 ${out.essayReview.wordCount}`
        : "",
    }
  } catch (err) {
    if (c.expect === "throw") {
      return { c, pass: true, note: `✓ 已抛错：${err instanceof Error ? err.message : String(err)}` }
    }
    return { c, pass: false, note: `✗ 意外抛错：${err instanceof Error ? err.message : String(err)}` }
  }
}

// ─────────────────────────── B. 两个校准锚（调真实模型） ───────────────────────────

interface AnchorCase {
  name: string
  essay: string
  expect: number
}

const ANCHORS: AnchorCase[] = [
  { name: "锚一 ·《兼听则明》（零错误零亮点）", essay: ANCHOR_BASELINE, expect: 43 },
  { name: "锚二 ·《兼听之难》（零错误 + 7 分亮点）", essay: ANCHOR_FULL, expect: 50 },
]

async function main() {
  console.log("=".repeat(100))
  console.log("语文大作文（chinese-essay）判分口径验证 · 北京卷议论文 v1.5")
  console.log(`模型: ${process.env.OPENAI_MODEL} @ ${process.env.OPENAI_BASE_URL}`)
  console.log(`cwd=${process.cwd()}`)
  console.log(`单篇超时: ${TIMEOUT_MS}ms（可用 ESSAY_GRADING_TIMEOUT_MS 覆盖）`)
  console.log("=".repeat(100))

  const config = getGradingPrompt("chinese-essay", 0)
  console.log("【配置预检】")
  console.log(`  getGradingPrompt("chinese-essay", 0) → ${config ? `scoring=${config.scoring} enableExactMatch=${config.enableExactMatch} prompt=${config.promptTemplate.length} 字 / system=${config.systemPrompt.length} 字` : "(null)"}`)
  if (!config || config.scoring !== "essay-v15") {
    console.log("")
    console.log("FAIL")
    process.exitCode = 1
    return
  }
  console.log(`  锚文题干: ${JSON.stringify(ANCHOR_STEM)}`)
  console.log("")

  // ── A 段
  console.log("-".repeat(100))
  console.log(`【A · 纯算分自测】${LOGIC_CASES.length} 条（不调模型，只验 essay-score.ts 的 §4 公式）`)
  console.log("-".repeat(100))
  const logicOutcomes: LogicOutcome[] = []
  for (const c of LOGIC_CASES) {
    const o = runLogicCase(c)
    logicOutcomes.push(o)
    console.log(`  ${o.pass ? "PASS" : "FAIL"}  ${c.name}`)
    console.log(`        期望 ${c.expect === "throw" ? "抛错" : c.expect === "skip" ? "跳过" : fmt(c.expect)}｜${o.note}`)
  }
  const logicFailed = logicOutcomes.filter((o) => !o.pass)

  // ── B 段
  console.log("")
  console.log("-".repeat(100))
  console.log(`【B · 校准锚】${ANCHORS.length} 篇（getGradingPrompt → gradeWithConfig → essay-score.ts 全链路）`)
  console.log("-".repeat(100))
  const anchorFailed: string[] = []
  for (const a of ANCHORS) {
    const started = Date.now()
    const wordCount = countEssayWords(a.essay)
    console.log("")
    console.log(`── ${a.name}｜期望 ${a.expect}｜字数 ${wordCount}`)
    try {
      const r = await withTimeout(
        gradeWithConfig(config, ANCHOR_STEM, a.essay, "", 50),
        TIMEOUT_MS,
        a.name,
      )
      const ms = Date.now() - started
      if (r.skip) {
        anchorFailed.push(`${a.name}: 被判成需要跳过（reason=${r.skip.reason}），锚文必须是议论文`)
        console.log(`   FAIL  被判成跳过（reason=${r.skip.reason}）(${ms}ms)`)
        continue
      }
      if (!r.essayReview) {
        anchorFailed.push(`${a.name}: 没有生成 essayReview`)
        console.log(`   FAIL  gradeWithConfig 没带回 essayReview (${ms}ms)`)
        continue
      }
      const ok = r.score === a.expect
      if (!ok) anchorFailed.push(`${a.name}: 实际 ${fmt(r.score)} ≠ 期望 ${a.expect}`)
      const internal = r.essayReview.internal
      console.log(`   ${ok ? "PASS" : "FAIL"}  实际 ${fmt(r.score)}／50（档位 ${r.essayReview.band} ${r.essayReview.range}）(${ms}ms)`)
      console.log(`   命中: A=[${internal?.aHits.join(" ") ?? ""}] L=[${internal?.lHits.join(" ") ?? ""}] B=[${internal?.bHits.join(" ") ?? ""}] C=[${internal?.cHits.join(" ") ?? ""}] D=[${internal?.dHits.join(" ") ?? ""}] A7′=${internal?.a7Band}`)
      console.log(`   算式: ${internal?.formula ?? "(无)"}`)
      console.log(`   上限: ${internal?.caps.length ? internal.caps.join("；") : "(未套上限)"}`)
      console.log(`   判词: ${r.essayReview.verdict}`)
      console.log(`   建议 ${r.essayReview.suggestions.length} 条: ${JSON.stringify(r.essayReview.suggestions)}`)
      console.log(`   最该改: ${r.essayReview.direction}`)
      // 学生可见文本里不该出现条款编号（提示词禁止；这里只提示，不判失败）
      const leak = /\b[ABCDL]\s?\d{1,2}\b/.exec(`${r.essayReview.verdict} ${r.essayReview.suggestions.join(" ")}`)
      if (leak) console.log(`   ⚠ 学生可见文本里出现疑似条款编号「${leak[0]}」——提示词约束失效，请检查`)
    } catch (err) {
      anchorFailed.push(`${a.name}: 调用失败 ${err instanceof Error ? err.message : String(err)}`)
      console.log(`   FAIL  调用失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── 汇总
  const logicPass = logicOutcomes.length - logicFailed.length
  const anchorPass = ANCHORS.length - anchorFailed.length
  const allPass = logicFailed.length === 0 && anchorFailed.length === 0
  console.log("")
  console.log("=".repeat(100))
  console.log("【汇总】")
  console.log(`  A 纯算分: ${logicPass}/${logicOutcomes.length} 通过`)
  for (const o of logicFailed) console.log(`    ✗ ${o.c.name}：期望 ${o.c.expect}；${o.note}`)
  console.log(`  B 校准锚: ${anchorPass}/${ANCHORS.length} 通过（SPEC §13：必须 43 / 50）`)
  for (const m of anchorFailed) console.log(`    ✗ ${m}`)
  console.log("=".repeat(100))
  console.log(allPass ? "PASS" : "FAIL")
  if (!allPass) process.exitCode = 1
}

await main()
