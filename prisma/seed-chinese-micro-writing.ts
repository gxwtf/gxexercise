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

const microWritingArticle = `
从下面三个题目中任选一题，按要求作答。不超过150字。不透露所在学校及个人信息。

（1）高三复习时，有同学认真回归教材，有同学偶尔使用教材，有同学从不使用教材……你认为高三复习应如何使用教材？要求：观点明确，理由充分。

（2）为方便居民交换、转让闲置物品，社区创建了一个微信群。请你围绕"厉行勤俭节约，共建和谐社区"这一宗旨，写一则群公告。要求：语言简练，有号召力。

（3）请以"咔嚓，咔嚓"为开头，写一首小诗或一段抒情文字。题目自拟。要求：感情真挚，语言生动，有感染力。`;

async function main() {
  console.log("清理旧微写作数据...");

  const microWritingGroups = await prisma.questionGroup.findMany({
    where: { questionType: "chinese-micro-writing" },
    select: { id: true },
  });
  const microWritingGroupIds = microWritingGroups.map((g) => g.id);

  const existingMicroWritingQuestions = await prisma.question.findMany({
    where: { category: "微写作" },
    select: { id: true },
  });
  const existingMicroWritingQuestionIds = existingMicroWritingQuestions.map((q) => q.id);

  if (microWritingGroupIds.length > 0) {
    await prisma.groupItem.deleteMany({ where: { groupId: { in: microWritingGroupIds } } });
    await prisma.questionGroupSubmission.deleteMany({ where: { questionGroupId: { in: microWritingGroupIds } } });
    await prisma.questionGroup.deleteMany({ where: { id: { in: microWritingGroupIds } } });
    console.log(`删除了 ${microWritingGroupIds.length} 个微写作题组`);
  }

  if (existingMicroWritingQuestionIds.length > 0) {
    await prisma.questionSubmission.deleteMany({ where: { questionId: { in: existingMicroWritingQuestionIds } } });
    await prisma.question.deleteMany({ where: { id: { in: existingMicroWritingQuestionIds } } });
    console.log(`删除了 ${existingMicroWritingQuestionIds.length} 个微写作题`);
  }

  console.log("开始创建微写作题组数据...");

  const microWritingGroup = await prisma.questionGroup.create({
    data: {
      title: "微写作练习",
      content: microWritingArticle,
      questionType: "chinese-micro-writing",
      score: 10,
      subject: "语文",
      source: "练习题",
      category: "微写作",
      grade: "高三",
      tags: ["微写作", "语文", "高三", "练习"],
    },
  });

  console.log(`创建了微写作题组: ${microWritingGroup.title}`);

  const question = await prisma.question.create({
    data: {
      content: "",
      questionType: "text",
      options: [],
      answer: `答案示例（以第1题为例）：
我认为高三复习应坚持以教材为本。首先，教材是高考命题的根本依据，回归教材可以确保复习方向不偏离。其次，教材中的例题和习题涵盖了核心知识点和典型方法，吃透教材能够夯实基础。最后，在回归教材的基础上适当拓展，才能做到举一反三、触类旁通。因此，高三复习应以教材为主线，辅以适当的练习和总结。`,
      analysis: `微写作评分标准：
1. 观点明确，理由充分（4分）
2. 语言流畅，表达清晰（3分）
3. 结构完整，字数符合要求（3分）`,
      score: 10,
      correctRate: 0.7,
      subject: "语文",
      source: "练习题",
      category: "微写作",
      grade: "高三",
      tags: ["微写作", "语文", "高三", "练习"],
    },
  });

  await prisma.groupItem.create({
    data: {
      groupId: microWritingGroup.id,
      questionId: question.id,
      orderIndex: 0,
    },
  });

  console.log("创建了微写作题目");
  console.log("微写作题组数据创建完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });