/**
 * 重评自测数据（**只允许跑在独立测试库 gxexercise_regrade_test 上**）
 *
 * 覆盖的形态来自线上真实口径，且刻意把「库里的分数」写成**错的**（模拟答案 / 提示词
 * 已经被管理员改过、历史成绩还是旧口径的状态），这样一旦重评没生效，断言就会失败：
 *   A 客观题：改答案后对错翻转 + 语法填空大小写敏感 + 空作答（0 分）
 *   B 物理实验（有批改提示词的主观题）：重新排队 / 空作答直接 0 分；挂在一份套卷里
 *   C 数学解答题：本来就不批阅 → 必须原地不动
 *   D 参考答案是图片：无法按文字判分 → 原地不动
 *   E 任选一题（pick-one）板块：组分数取「已判分里最高的那一题」，totalNum 恒为 1
 *   F 套卷另一个小节：验证整卷总分 = 各小节之和
 *   H 只重评指定小题：没指定的那题不能被改
 *   I 英语作文第 2 题没有提示词配置：不能抹掉已有分数
 *   J 数据异常：提交里混进了不属于该题组的小题 → 单题报错但不影响其余小题
 *
 * 本文件只导出 seedFixture()，由 regrade-check.ts 传入 PrismaClient 调用（连接由它负责）。
 */

import type { PrismaClient } from "../../src/generated/prisma/client"

const USER_ID = 990001

export interface QuestionRef {
  questionId: string
  submissionId: string
}

export interface GroupRef {
  groupId: string
  groupSubmissionId: string
  questions: QuestionRef[]
}

export interface RegradeFixture {
  userA: number
  /** A 客观题：答案已改（1 对→错）、语法填空大小写、空作答 */
  groupA: GroupRef
  /** B 物理实验（有提示词）：重新排队 + 空作答 0 分，属于套卷 */
  groupB: GroupRef
  /** C 数学解答题：不批阅 */
  groupC: GroupRef
  /** D 图片答案 */
  groupD: GroupRef
  /** E 任选一题（pick-one） */
  groupE: GroupRef
  /** F 套卷小节（客观题，全对，不应变化） */
  groupF: GroupRef
  /** H 只重评指定小题 */
  groupH: GroupRef
  /** I 英语作文（第 2 题没有提示词配置） */
  groupI: GroupRef
  /** J 数据异常（多余小题） */
  groupJ: GroupRef
  /** 套卷提交 id */
  testPaperSubmissionId: string
}

/** 建一条单题（tags 无默认值，必须显式给） */
async function createQuestion(
  prisma: PrismaClient,
  data: { questionType: string; answer: string; score: number },
) {
  return prisma.question.create({
    data: {
      questionType: data.questionType,
      content: `题干（${data.questionType}）`,
      answer: data.answer,
      score: data.score,
      subject: "测试",
      source: "regrade-fixture",
      tags: [],
    },
  })
}

/** 建一个题组（content / tags / source / subject 都无默认值） */
async function createGroup(
  prisma: PrismaClient,
  data: { title: string; questionType: string; answerMode?: string; score?: number },
) {
  return prisma.questionGroup.create({
    data: {
      title: data.title,
      content: "",
      questionType: data.questionType,
      answerMode: data.answerMode ?? "all",
      score: data.score ?? 0,
      subject: "测试",
      source: "regrade-fixture",
      category: "",
      tags: [],
    },
  })
}

/** 建一条单题提交（分数/状态由调用方按「旧口径的错值」给） */
async function createSubmission(
  prisma: PrismaClient,
  data: {
    questionId: string
    groupSubmissionId: string
    answer: string
    score: number | null
    isCorrect: boolean | null
    gradingStatus: string
    aiFeedback?: { feedback: string }
  },
) {
  return prisma.questionSubmission.create({
    data: {
      userId: USER_ID,
      questionId: data.questionId,
      groupSubmissionId: data.groupSubmissionId,
      content: { answer: data.answer },
      score: data.score,
      isCorrect: data.isCorrect,
      gradingStatus: data.gradingStatus,
      aiFeedback: data.aiFeedback,
      shareAsExcellent: true,
    },
  })
}

/** 清空测试库里的业务数据（依赖顺序删，避免外键报错） */
export async function clearFixture(prisma: PrismaClient) {
  await prisma.questionSubmission.deleteMany({})
  await prisma.questionGroupSubmission.deleteMany({})
  await prisma.testPaperSubmission.deleteMany({})
  await prisma.groupItem.deleteMany({})
  await prisma.question.deleteMany({})
  await prisma.questionGroup.deleteMany({})
  await prisma.paperItem.deleteMany({})
  await prisma.testPaper.deleteMany({})
  await prisma.adminEditLog.deleteMany({})
  await prisma.questionBankReviewer.deleteMany({})
  await prisma.user.deleteMany({})
}

export async function seedFixture(prisma: PrismaClient): Promise<RegradeFixture> {
  await clearFixture(prisma)
  await prisma.user.create({ data: { id: USER_ID, userName: "重评测试同学" } })

  // ---- A 客观题：答案已经改过，库里还是旧分数 ----
  const groupA = await createGroup(prisma, { title: "语法填空（答案已改）", questionType: "grammar" })
  const aQuestions = await Promise.all([
    // 参考答案已改成 "the loneliest one"，学生答 "the loneliest" → 现在应判错
    createQuestion(prisma, { questionType: "grammar", answer: "the loneliest one", score: 1.5 }),
    // 语法填空区分大小写：With ≠ with
    createQuestion(prisma, { questionType: "grammar", answer: "With", score: 1.5 }),
    // 空作答：客观题按错处理
    createQuestion(prisma, { questionType: "grammar", answer: "however", score: 1.5 }),
  ])
  for (const [orderIndex, question] of aQuestions.entries()) {
    await prisma.groupItem.create({ data: { groupId: groupA.id, questionId: question.id, orderIndex } })
  }
  const groupSubmissionA = await prisma.questionGroupSubmission.create({
    data: { userId: USER_ID, questionGroupId: groupA.id, score: 4.5, isCorrect: true, correctNum: 3, totalNum: 3 },
  })
  const aRows = [
    await createSubmission(prisma, {
      questionId: aQuestions[0].id,
      groupSubmissionId: groupSubmissionA.id,
      answer: "the loneliest",
      score: 1.5,
      isCorrect: true,
      gradingStatus: "graded",
    }),
    await createSubmission(prisma, {
      questionId: aQuestions[1].id,
      groupSubmissionId: groupSubmissionA.id,
      answer: "with",
      score: 1.5,
      isCorrect: true,
      gradingStatus: "graded",
    }),
    await createSubmission(prisma, {
      questionId: aQuestions[2].id,
      groupSubmissionId: groupSubmissionA.id,
      answer: "",
      score: 0,
      isCorrect: false,
      gradingStatus: "graded",
    }),
  ]

  // ---- 套卷：B 与 F 两个小节挂在同一份套卷提交下 ----
  const testPaper = await prisma.testPaper.create({
    data: { title: "重评测试套卷", subject: "测试", source: "regrade-fixture", tags: [] },
  })
  const testPaperSubmission = await prisma.testPaperSubmission.create({
    data: { userId: USER_ID, testPaperId: testPaper.id, score: 99, duration: 60 },
  })

  // B 物理实验题（有批改提示词）：一空一条单题，逐空交 AI 判分
  const groupB = await createGroup(prisma, { title: "物理实验（有提示词）", questionType: "physics-fill" })
  const bQuestions = await Promise.all([
    createQuestion(prisma, { questionType: "text", answer: "偏大；因为存在摩擦阻力", score: 2 }),
    createQuestion(prisma, { questionType: "text", answer: "0.50", score: 2 }),
  ])
  for (const [orderIndex, question] of bQuestions.entries()) {
    await prisma.groupItem.create({ data: { groupId: groupB.id, questionId: question.id, orderIndex } })
  }
  const groupSubmissionB = await prisma.questionGroupSubmission.create({
    data: {
      userId: USER_ID,
      questionGroupId: groupB.id,
      testSubmissionId: testPaperSubmission.id,
      score: 4,
      isCorrect: true,
      correctNum: 2,
      totalNum: 2,
    },
  })
  const bRows = [
    // 已批过分、带旧评语 → 重评后应重新排队并清掉旧评语
    await createSubmission(prisma, {
      questionId: bQuestions[0].id,
      groupSubmissionId: groupSubmissionB.id,
      answer: "偏大",
      score: 1,
      isCorrect: false,
      gradingStatus: "graded",
      aiFeedback: { feedback: "旧评语：理由不全" },
    }),
    // 空作答 + 库里错误地给了满分 → 重评后应变成 0 分 / 已批阅
    await createSubmission(prisma, {
      questionId: bQuestions[1].id,
      groupSubmissionId: groupSubmissionB.id,
      answer: "",
      score: 2,
      isCorrect: true,
      gradingStatus: "graded",
    }),
  ]

  // F 套卷里的另一个小节：全对，重评后不应变化（用来验证整卷总分只按小节求和）
  const groupF = await createGroup(prisma, { title: "套卷小节（客观题）", questionType: "grammar" })
  const fQuestion = await createQuestion(prisma, { questionType: "grammar", answer: "B", score: 1 })
  await prisma.groupItem.create({ data: { groupId: groupF.id, questionId: fQuestion.id, orderIndex: 0 } })
  const groupSubmissionF = await prisma.questionGroupSubmission.create({
    data: {
      userId: USER_ID,
      questionGroupId: groupF.id,
      testSubmissionId: testPaperSubmission.id,
      score: 1,
      isCorrect: true,
      correctNum: 1,
      totalNum: 1,
    },
  })
  const fRow = await createSubmission(prisma, {
    questionId: fQuestion.id,
    groupSubmissionId: groupSubmissionF.id,
    answer: "b",
    score: 1,
    isCorrect: true,
    gradingStatus: "graded",
  })

  // ---- C 数学解答题：不批阅，必须原地不动 ----
  const groupC = await createGroup(prisma, { title: "数学解答题（不批阅）", questionType: "math-solve" })
  const cQuestion = await createQuestion(prisma, { questionType: "text", answer: "解：设 x=1", score: 6 })
  await prisma.groupItem.create({ data: { groupId: groupC.id, questionId: cQuestion.id, orderIndex: 0 } })
  const groupSubmissionC = await prisma.questionGroupSubmission.create({
    data: { userId: USER_ID, questionGroupId: groupC.id, score: 6, isCorrect: true, correctNum: 1, totalNum: 1 },
  })
  const cRow = await createSubmission(prisma, {
    questionId: cQuestion.id,
    groupSubmissionId: groupSubmissionC.id,
    answer: "我的解答过程",
    score: 6,
    isCorrect: true,
    gradingStatus: "graded",
  })

  // ---- D 参考答案是图片 ----
  const groupD = await createGroup(prisma, { title: "生物画图题（图片答案）", questionType: "biology-fill" })
  const dQuestion = await createQuestion(prisma, {
    questionType: "text",
    answer: "![参考答案图](/uploads/answer-demo.png)",
    score: 5,
  })
  await prisma.groupItem.create({ data: { groupId: groupD.id, questionId: dQuestion.id, orderIndex: 0 } })
  const groupSubmissionD = await prisma.questionGroupSubmission.create({
    data: { userId: USER_ID, questionGroupId: groupD.id, score: 5, isCorrect: true, correctNum: 1, totalNum: 1 },
  })
  const dRow = await createSubmission(prisma, {
    questionId: dQuestion.id,
    groupSubmissionId: groupSubmissionD.id,
    answer: "我画的图",
    score: 5,
    isCorrect: true,
    gradingStatus: "graded",
  })

  // ---- E 任选一题（微写作三选一）：只算作答的那一题 ----
  const groupE = await createGroup(prisma, {
    title: "微写作三选一（pick-one）",
    questionType: "chinese-micro-writing",
    answerMode: "pick-one",
  })
  const eQuestions = await Promise.all([
    createQuestion(prisma, { questionType: "text", answer: "参考答案一", score: 10 }),
    createQuestion(prisma, { questionType: "text", answer: "参考答案二", score: 10 }),
  ])
  for (const [orderIndex, question] of eQuestions.entries()) {
    await prisma.groupItem.create({ data: { groupId: groupE.id, questionId: question.id, orderIndex } })
  }
  const groupSubmissionE = await prisma.questionGroupSubmission.create({
    // 旧口径错值：组分数 3、正确题数 0、题数按 2 算
    data: { userId: USER_ID, questionGroupId: groupE.id, score: 3, isCorrect: false, correctNum: 0, totalNum: 2 },
  })
  // pick-one 组「没选的那一题」不写记录（与提交接口一致）
  const eRow = await createSubmission(prisma, {
    questionId: eQuestions[0].id,
    groupSubmissionId: groupSubmissionE.id,
    answer: "我写的第一题",
    score: 9,
    isCorrect: true,
    gradingStatus: "graded",
  })

  // ---- H 只重评指定小题 ----
  const groupH = await createGroup(prisma, { title: "语法填空（只重评指定小题）", questionType: "grammar" })
  const hQuestions = await Promise.all([
    createQuestion(prisma, { questionType: "grammar", answer: "apple", score: 1 }),
    createQuestion(prisma, { questionType: "grammar", answer: "Pear", score: 1 }),
  ])
  for (const [orderIndex, question] of hQuestions.entries()) {
    await prisma.groupItem.create({ data: { groupId: groupH.id, questionId: question.id, orderIndex } })
  }
  const groupSubmissionH = await prisma.questionGroupSubmission.create({
    data: { userId: USER_ID, questionGroupId: groupH.id, score: 2, isCorrect: true, correctNum: 2, totalNum: 2 },
  })
  const hRows = [
    await createSubmission(prisma, {
      questionId: hQuestions[0].id,
      groupSubmissionId: groupSubmissionH.id,
      answer: "apple",
      score: 1,
      isCorrect: true,
      gradingStatus: "graded",
    }),
    // 大小写不匹配，若被重评会改成错 —— 只重评第 1 题时它必须保持原样
    await createSubmission(prisma, {
      questionId: hQuestions[1].id,
      groupSubmissionId: groupSubmissionH.id,
      answer: "pear",
      score: 1,
      isCorrect: true,
      gradingStatus: "graded",
    }),
  ]

  // ---- I 英语作文：第 0 题有提示词、第 1 题没有 ----
  const groupI = await createGroup(prisma, { title: "英语作文（第 2 题无提示词）", questionType: "en-writing" })
  const iQuestions = await Promise.all([
    createQuestion(prisma, { questionType: "text", answer: "参考范文一", score: 20 }),
    createQuestion(prisma, { questionType: "text", answer: "参考范文二", score: 20 }),
  ])
  for (const [orderIndex, question] of iQuestions.entries()) {
    await prisma.groupItem.create({ data: { groupId: groupI.id, questionId: question.id, orderIndex } })
  }
  const groupSubmissionI = await prisma.questionGroupSubmission.create({
    data: { userId: USER_ID, questionGroupId: groupI.id, score: 30, isCorrect: false, correctNum: 1, totalNum: 2 },
  })
  const iRows = [
    await createSubmission(prisma, {
      questionId: iQuestions[0].id,
      groupSubmissionId: groupSubmissionI.id,
      answer: "My first essay",
      score: 15,
      isCorrect: false,
      gradingStatus: "graded",
    }),
    await createSubmission(prisma, {
      questionId: iQuestions[1].id,
      groupSubmissionId: groupSubmissionI.id,
      answer: "My second essay",
      score: 15,
      isCorrect: false,
      gradingStatus: "graded",
    }),
  ]

  // ---- J 数据异常：提交里混进不属于该题组的小题 ----
  const groupJ = await createGroup(prisma, { title: "数据异常（多余小题）", questionType: "grammar" })
  const jQuestion = await createQuestion(prisma, { questionType: "grammar", answer: "A", score: 1 })
  const extraQuestion = await createQuestion(prisma, { questionType: "grammar", answer: "Z", score: 1 })
  await prisma.groupItem.create({ data: { groupId: groupJ.id, questionId: jQuestion.id, orderIndex: 0 } })
  const groupSubmissionJ = await prisma.questionGroupSubmission.create({
    data: { userId: USER_ID, questionGroupId: groupJ.id, score: 1, isCorrect: true, correctNum: 1, totalNum: 1 },
  })
  const jRows = [
    await createSubmission(prisma, {
      questionId: jQuestion.id,
      groupSubmissionId: groupSubmissionJ.id,
      answer: "A",
      score: 1,
      isCorrect: true,
      gradingStatus: "graded",
    }),
    await createSubmission(prisma, {
      questionId: extraQuestion.id,
      groupSubmissionId: groupSubmissionJ.id,
      answer: "Z",
      score: null,
      isCorrect: null,
      gradingStatus: "skipped",
    }),
  ]

  const ref = (group: { id: string }, groupSubmissionId: string, questions: { id: string }[], rows: { id: string }[]): GroupRef => ({
    groupId: group.id,
    groupSubmissionId,
    questions: questions.map((q, i) => ({ questionId: q.id, submissionId: rows[i].id })),
  })

  return {
    userA: USER_ID,
    groupA: ref(groupA, groupSubmissionA.id, aQuestions, aRows),
    groupB: ref(groupB, groupSubmissionB.id, bQuestions, bRows),
    groupC: ref(groupC, groupSubmissionC.id, [cQuestion], [cRow]),
    groupD: ref(groupD, groupSubmissionD.id, [dQuestion], [dRow]),
    groupE: ref(groupE, groupSubmissionE.id, [eQuestions[0]], [eRow]),
    groupF: ref(groupF, groupSubmissionF.id, [fQuestion], [fRow]),
    groupH: ref(groupH, groupSubmissionH.id, hQuestions, hRows),
    groupI: ref(groupI, groupSubmissionI.id, iQuestions, iRows),
    groupJ: ref(groupJ, groupSubmissionJ.id, [jQuestion, extraQuestion], jRows),
    testPaperSubmissionId: testPaperSubmission.id,
  }
}
