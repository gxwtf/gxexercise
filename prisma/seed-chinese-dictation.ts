import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const dictationArticle = `在横线处填写作品原句。要求：字迹清晰。

(1) 历史兴亡，引人感慨。杜牧用"<Input2/>，<Input2/>，谁得而族灭也"表达对秦朝覆亡的遗憾；苏洵用"有如此之势，<Input2/>，<Input2/>，以趋于亡"表达对六国迁灭的叹惋。

(2) 诗歌常抒写爱情。《静女》中"爱而不见，<Input2/>"描写出恋人相会的美好；《涉江采芙蓉》中"<Input2/>？所思在远道"则表达了有情人无法相见的感伤。

(3) 李华游学南京，登高望远，见江白山翠，不禁想起王安石所写的诗句"<Input2/>，<Input2/>"。`;

async function main() {
  console.log("清理旧默写数据...");

  const dictationGroups = await prisma.questionGroup.findMany({
    where: { questionType: "chinese-dictation" },
    select: { id: true },
  });
  const dictationGroupIds = dictationGroups.map((g) => g.id);

  const existingDictationQuestions = await prisma.question.findMany({
    where: { category: "默写" },
    select: { id: true },
  });
  const existingDictationQuestionIds = existingDictationQuestions.map((q) => q.id);

  if (dictationGroupIds.length > 0) {
    await prisma.groupItem.deleteMany({ where: { groupId: { in: dictationGroupIds } } });
    await prisma.questionGroupSubmission.deleteMany({ where: { questionGroupId: { in: dictationGroupIds } } });
    await prisma.questionGroup.deleteMany({ where: { id: { in: dictationGroupIds } } });
    console.log(`删除了 ${dictationGroupIds.length} 个默写题组`);
  }

  if (existingDictationQuestionIds.length > 0) {
    await prisma.questionSubmission.deleteMany({ where: { questionId: { in: existingDictationQuestionIds } } });
    await prisma.question.deleteMany({ where: { id: { in: existingDictationQuestionIds } } });
    console.log(`删除了 ${existingDictationQuestionIds.length} 个默写题`);
  }

  console.log("开始创建默写题组数据...");

  const dictationGroup = await prisma.questionGroup.create({
    data: {
      title: "默写练习 - 古诗文名句",
      content: dictationArticle,
      questionType: "chinese-dictation",
      score: 8,
      subject: "语文",
      source: "练习题",
      category: "默写",
      grade: "高三",
      tags: ["默写", "语文", "高三", "练习", "古诗文"],
    },
  });

  console.log(`创建了默写题组: ${dictationGroup.title}`);

  const dictationQuestions = [
    { id: '1', answer: '使天下之人', correctRate: 0.8, score: 1 },
    { id: '2', answer: '不敢言而敢怒', correctRate: 0.78, score: 1 },
    { id: '3', answer: '而为秦人积威之所劫', correctRate: 0.65, score: 1 },
    { id: '4', answer: '日削月割', correctRate: 0.7, score: 1 },
    { id: '5', answer: '搔首踟蹰', correctRate: 0.75, score: 1 },
    { id: '6', answer: '采之欲遗谁', correctRate: 0.72, score: 1 },
    { id: '7', answer: '千里澄江似练', correctRate: 0.68, score: 1 },
    { id: '8', answer: '翠峰如簇', correctRate: 0.66, score: 1 },
  ];

  for (const q of dictationQuestions) {
    const question = await prisma.question.create({
      data: {
        content: "",
        questionType: "input",
        options: [],
        answer: q.answer,
        analysis: `第${q.id}空出自课内必背篇目。`,
        score: q.score,
        correctRate: q.correctRate,
        subject: "语文",
        source: "练习题",
        category: "默写",
        grade: "高三",
        tags: ["默写", "语文", "高三", "练习", "古诗文"],
      },
    });

    await prisma.groupItem.create({
      data: {
        groupId: dictationGroup.id,
        questionId: question.id,
        orderIndex: parseInt(q.id) - 1,
      },
    });

    console.log(`创建了默写第${q.id}空`);
  }

  console.log("默写题组数据创建完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });