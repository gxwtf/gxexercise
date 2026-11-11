/**
 * 重评自测：断言 src/lib/regrade.ts 的每一条口径（**只跑在 gxexercise_regrade_test 测试库**）
 *
 * 跑法：
 *   DATABASE_URL="postgresql://postgres:<pwd>@localhost:5432/gxexercise_regrade_test" \
 *     npx tsx scripts/test/regrade-check.ts
 *
 * 末行输出 PASS / FAIL；FAIL 时退出码 1。
 *
 * 为什么先校验 DATABASE_URL：这个脚本会 deleteMany 整个库的业务表 + 重写分数，
 * 万一有人忘了带环境变量（.env 里是生产库），就会把线上成绩改掉 —— 所以宁可拒绝执行。
 */

// 只引用类型：编译期擦除，不会为了拿类型而提前加载 regrade.ts（那会连库）
import type { RegradeGroupResult } from "../../src/lib/regrade"

const REQUIRED_DB = "gxexercise_regrade_test"

let failed = 0

/** 断言：条件为假就记一次失败（不中断，尽量把问题一次跑全） */
function ok(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ✓ ${name}`)
    return
  }
  failed++
  console.error(`  ✗ ${name}${detail === undefined ? "" : ` —— ${JSON.stringify(detail)}`}`)
}

function section(title: string) {
  console.log(`\n${title}`)
}

async function main() {
  const url = process.env.DATABASE_URL ?? ""
  if (!url.includes(REQUIRED_DB)) {
    console.error(
      `拒绝执行：DATABASE_URL 必须指向独立测试库 ${REQUIRED_DB}，当前是 ${url ? "另一个库" : "（未设置）"}`,
    )
    process.exit(1)
  }

  // 动态 import：上面那条校验必须先跑，不能为了拿 prisma 单例而提前连库
  const { prisma } = await import("../../src/lib/prisma")
  const { runRegrade, regradeSubmissions, REGRADE_MAX_GROUPS, REGRADE_MAX_QUESTIONS } = await import(
    "../../src/lib/regrade"
  )
  const { seedFixture } = await import("./regrade-fixture")

  const fx = await seedFixture(prisma)

  const questionResult = (result: RegradeGroupResult | undefined, questionId: string) =>
    result?.questions.find((q) => q.questionId === questionId)

  // ------------------------------------------------------------------
  section("① 客观题：改答案后对错翻转 / 语法填空大小写 / 空作答（A）")
  const aRun = await runRegrade([{ groupSubmissionId: fx.groupA.groupSubmissionId }])
  ok("返回 1 份作答", aRun.groups.length === 1, aRun)
  ok("没有失败项", aRun.failed.length === 0, aRun.failed)
  const a = aRun.groups[0]
  if (a) {
    ok("组标题正确", a.groupTitle === "语法填空（答案已改）", a.groupTitle)
    ok(
      "组前快照 = 库里的旧值",
      a.before.score === 4.5 && a.before.correctNum === 3 && a.before.totalNum === 3,
      a.before,
    )
    const q1 = questionResult(a, fx.groupA.questions[0].questionId)
    ok("改答案后第 1 题判错（objective-changed）", q1?.outcome === "objective-changed", q1)
    ok(
      "第 1 题 after = 0 分 / 错 / 已批阅",
      q1?.after.score === 0 && q1.after.isCorrect === false && q1.after.gradingStatus === "graded",
      q1?.after,
    )
    ok(
      "第 1 题 before = 旧分数 1.5 / 对",
      q1?.before.score === 1.5 && q1.before.isCorrect === true,
      q1?.before,
    )
    const q2 = questionResult(a, fx.groupA.questions[1].questionId)
    ok("语法填空区分大小写（With ≠ with）→ 判错", q2?.outcome === "objective-changed" && q2.after.isCorrect === false, q2)
    const q3 = questionResult(a, fx.groupA.questions[2].questionId)
    ok("空作答客观题 0 分且与库内一致（objective-unchanged）", q3?.outcome === "objective-unchanged", q3)
    ok(
      "组后快照 = 0 分 / 0 对 / 3 题 / 不全对",
      a.after.score === 0 && a.after.correctNum === 0 && a.after.totalNum === 3,
      a.after,
    )
    const dbGroup = await prisma.questionGroupSubmission.findUnique({
      where: { id: fx.groupA.groupSubmissionId },
      select: { score: true, correctNum: true, totalNum: true, isCorrect: true },
    })
    ok(
      "库里组记录已写回（含 isCorrect=false）",
      dbGroup?.score === 0 && dbGroup.correctNum === 0 && dbGroup.totalNum === 3 && dbGroup.isCorrect === false,
      dbGroup,
    )
    const dbQ1 = await prisma.questionSubmission.findUnique({
      where: { id: fx.groupA.questions[0].submissionId },
      select: { score: true, isCorrect: true, gradingStatus: true },
    })
    ok("库里第 1 题已改成 0 分 / 错", dbQ1?.score === 0 && dbQ1.isCorrect === false && dbQ1.gradingStatus === "graded", dbQ1)
  } else {
    ok("返回了作答结果", false)
  }

  // ------------------------------------------------------------------
  section("② 有提示词的主观题重新排队 + 空作答直接 0 分 + 套卷总分回算（B / F）")
  const bRun = await runRegrade([{ groupSubmissionId: fx.groupB.groupSubmissionId }])
  const b = bRun.groups[0]
  ok("返回 1 份作答", bRun.groups.length === 1, bRun)
  if (b) {
    const bq1 = questionResult(b, fx.groupB.questions[0].questionId)
    ok("有提示词的主观题 → requeued", bq1?.outcome === "requeued", bq1)
    ok(
      "requeued 后快照 = 空分 / 空对错 / pending",
      bq1?.after.score === null && bq1.after.isCorrect === null && bq1.after.gradingStatus === "pending",
      bq1?.after,
    )
    const dbBq1 = await prisma.questionSubmission.findUnique({
      where: { id: fx.groupB.questions[0].submissionId },
      select: { score: true, isCorrect: true, gradingStatus: true, aiFeedback: true },
    })
    ok(
      "库里已清空分数与旧评语并置 pending",
      dbBq1?.score === null &&
        dbBq1.isCorrect === null &&
        dbBq1.gradingStatus === "pending" &&
        dbBq1.aiFeedback === null,
      dbBq1,
    )
    const bq2 = questionResult(b, fx.groupB.questions[1].questionId)
    ok("主观题空作答 → 0 分 / 错 / 已批阅（不再排队）", bq2?.outcome === "objective-changed" && bq2.after.score === 0 && bq2.after.isCorrect === false && bq2.after.gradingStatus === "graded", bq2)
    ok("组后快照 = 0 分 / 0 对 / 2 题", b.after.score === 0 && b.after.correctNum === 0 && b.after.totalNum === 2, b.after)

    const dbPaper = await prisma.testPaperSubmission.findUnique({
      where: { id: fx.testPaperSubmissionId },
      select: { score: true },
    })
    // 套卷总分 = B(0) + F(1) = 1（旧值 99 必须被覆盖）
    ok("套卷总分重算 = 各小节之和 1", dbPaper?.score === 1, dbPaper)
  }

  // ------------------------------------------------------------------
  section("③ 暂不批阅题型（数学解答）与图片参考答案：原地不动（C / D）")
  const cdRun = await runRegrade([
    { groupSubmissionId: fx.groupC.groupSubmissionId },
    { groupSubmissionId: fx.groupD.groupSubmissionId },
  ])
  const c = cdRun.groups.find((g) => g.groupSubmissionId === fx.groupC.groupSubmissionId)
  const d = cdRun.groups.find((g) => g.groupSubmissionId === fx.groupD.groupSubmissionId)
  ok("数学解答题 skipped", c?.questions[0]?.outcome === "skipped", c?.questions[0])
  ok("图片答案 skipped", d?.questions[0]?.outcome === "skipped", d?.questions[0])
  ok(
    "skipped 的 after 必须等于 before",
    JSON.stringify(c?.questions[0]?.after) === JSON.stringify(c?.questions[0]?.before),
    c?.questions[0],
  )
  const dbC = await prisma.questionSubmission.findUnique({
    where: { id: fx.groupC.questions[0].submissionId },
    select: { score: true, isCorrect: true, gradingStatus: true },
  })
  ok("数学解答题分数没被抹掉", dbC?.score === 6 && dbC.isCorrect === true && dbC.gradingStatus === "graded", dbC)
  const dbD = await prisma.questionSubmission.findUnique({
    where: { id: fx.groupD.questions[0].submissionId },
    select: { score: true, isCorrect: true, gradingStatus: true },
  })
  ok("图片答案记录没被改动", dbD?.score === 5 && dbD.isCorrect === true && dbD.gradingStatus === "graded", dbD)

  // ------------------------------------------------------------------
  section("④ 任选一题（pick-one）：只算作答的那一题，totalNum 恒为 1（E）")
  const eRun = await runRegrade([{ groupSubmissionId: fx.groupE.groupSubmissionId }])
  const e = eRun.groups[0]
  ok(
    "pick-one 组后快照 = 9 分 / 1 对 / 总题数 1",
    e?.after.score === 9 && e.after.correctNum === 1 && e.after.totalNum === 1,
    e?.after,
  )
  ok("pick-one 组 before 是旧错值", e?.before.score === 3 && e.before.totalNum === 2, e?.before)
  const dbE = await prisma.questionGroupSubmission.findUnique({
    where: { id: fx.groupE.groupSubmissionId },
    select: { score: true, correctNum: true, totalNum: true, isCorrect: true },
  })
  ok(
    "库里 pick-one 组已按聚合口径写回（isCorrect=true）",
    dbE?.score === 9 && dbE.correctNum === 1 && dbE.totalNum === 1 && dbE.isCorrect === true,
    dbE,
  )

  // ------------------------------------------------------------------
  section("⑤ 只重评指定小题：没指定的不能被改（H）")
  const hRun = await runRegrade([
    { groupSubmissionId: fx.groupH.groupSubmissionId, questionIds: [fx.groupH.questions[0].questionId] },
  ])
  const h = hRun.groups[0]
  ok("只返回被指定的那 1 题", h?.questions.length === 1, h?.questions.map((q) => q.questionId))
  ok("被指定的题没变化（objective-unchanged）", h?.questions[0]?.outcome === "objective-unchanged", h?.questions[0])
  ok("组聚合照旧按全部小题重算（2 分 / 2 对）", h?.after.score === 2 && h.after.correctNum === 2 && h.after.totalNum === 2, h?.after)
  const dbH2 = await prisma.questionSubmission.findUnique({
    where: { id: fx.groupH.questions[1].submissionId },
    select: { score: true, isCorrect: true },
  })
  ok("没指定的小题在库里保持原样（大小写不匹配的 1 分仍在）", dbH2?.score === 1 && dbH2.isCorrect === true, dbH2)

  // ------------------------------------------------------------------
  section("⑥ 该题没有批改提示词配置：不能抹掉已有分数（I）")
  const iRun = await runRegrade([{ groupSubmissionId: fx.groupI.groupSubmissionId }])
  const i = iRun.groups[0]
  const iq1 = questionResult(i, fx.groupI.questions[0].questionId)
  const iq2 = questionResult(i, fx.groupI.questions[1].questionId)
  ok("第 1 题（有提示词）requeued", iq1?.outcome === "requeued", iq1)
  ok("第 2 题（无提示词）skipped", iq2?.outcome === "skipped", iq2)
  const dbIq2 = await prisma.questionSubmission.findUnique({
    where: { id: fx.groupI.questions[1].submissionId },
    select: { score: true, isCorrect: true, gradingStatus: true },
  })
  ok("无提示词那题旧分数仍在（15 分）", dbIq2?.score === 15 && dbIq2.isCorrect === false && dbIq2.gradingStatus === "graded", dbIq2)

  // ------------------------------------------------------------------
  section("⑦ 单题异常不阻断其余小题（J）")
  const jRun = await runRegrade([{ groupSubmissionId: fx.groupJ.groupSubmissionId }])
  const j = jRun.groups[0]
  ok("两份小题都被处理了", j?.questions.length === 2, j?.questions)
  ok("不属于题组的小题 → error", j?.questions.some((q) => q.outcome === "error"), j?.questions)
  ok("正常小题仍然被判分（objective-unchanged）", j?.questions.some((q) => q.outcome === "objective-unchanged"), j?.questions)
  ok("error 带原因说明", Boolean(j?.questions.find((q) => q.outcome === "error")?.message), j?.questions)

  // ------------------------------------------------------------------
  section("⑧ 不存在的记录：返回失败清单而不是抛错")
  const missingRun = await runRegrade([{ groupSubmissionId: "not-exists-regrade" }])
  ok("一份都没查到", missingRun.groups.length === 0, missingRun)
  ok("失败项标了 notFound", missingRun.failed.length === 1 && missingRun.failed[0].notFound === true, missingRun.failed)
  const mixedRun = await runRegrade([
    { groupSubmissionId: fx.groupA.groupSubmissionId },
    { groupSubmissionId: "not-exists-regrade" },
  ])
  ok("混着传：正常的照样重评、坏的进失败清单", mixedRun.groups.length === 1 && mixedRun.failed.length === 1, mixedRun.failed)

  // ------------------------------------------------------------------
  section("⑨ 契约签名 regradeSubmissions() 与幂等（重复重评不再变化）")
  const again = await regradeSubmissions([{ groupSubmissionId: fx.groupA.groupSubmissionId }])
  ok("regradeSubmissions 返回 RegradeGroupResult[]", Array.isArray(again) && again.length === 1, typeof again)
  const againGroup = again[0]
  ok(
    "第二次重评全部 objective-unchanged",
    Boolean(againGroup) && againGroup.questions.every((q) => q.outcome === "objective-unchanged"),
    againGroup?.questions.map((q) => `${q.label}:${q.outcome}`),
  )
  ok("第二次重评组分数不变（0 分）", againGroup?.after.score === 0, againGroup?.after)
  const secondRequeue = await regradeSubmissions([{ groupSubmissionId: fx.groupB.groupSubmissionId }])
  ok("重新排队是幂等的（再排仍 requeued）", secondRequeue[0]?.questions[0]?.outcome === "requeued", secondRequeue[0]?.questions[0])

  // ------------------------------------------------------------------
  section("⑩ 上限常量与契约一致")
  ok("REGRADE_MAX_GROUPS = 20", REGRADE_MAX_GROUPS === 20, REGRADE_MAX_GROUPS)
  ok("REGRADE_MAX_QUESTIONS = 200", REGRADE_MAX_QUESTIONS === 200, REGRADE_MAX_QUESTIONS)

  await prisma.$disconnect()

  console.log("")
  if (failed === 0) {
    console.log("PASS")
  } else {
    console.error(`FAIL（${failed} 项断言不通过）`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
