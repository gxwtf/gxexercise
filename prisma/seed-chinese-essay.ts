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

const essayArticle = `
从下面两个题目中任选一题，按要求作答。不少于700字。不透露所在学校及个人信息。

（1）新常态，是原有的正常状态被突破后，在新形势下出现的新的正常状态。如打破传统课堂界限，注重在更广阔的社会中学习，是教育发展的新常态；与互联网、AI等技术深度融合，是经济发展的新常态；学业难度提升、压力增加，是高三学生成长的新常态……

面对新常态，有人能积极应对；也有人因适应不了它的"新"，理解不了它的"常"而无可奈何。

请以"新常态"为题目，写一篇议论文。

要求：论点明确，论据充分，论证合理；语言流畅，书写清晰。

（2）备注，是老师在学生信息表里补充的学生特殊技能或个性需求，是实验员在实验报告中附加的操作细节或异常数据，是子女在产品说明书旁给父母增加的特别提示……生活中有很多备注值得去关注，也有很多内容值得去备注。

请以"备注"为题目，写一篇记叙文。

要求：思想健康；内容充实、合理，有细节描写；语言流畅，书写清晰。`;

async function main() {
  console.log("清理旧作文数据...");

  const essayGroups = await prisma.questionGroup.findMany({
    where: { questionType: "chinese-essay" },
    select: { id: true },
  });
  const essayGroupIds = essayGroups.map((g) => g.id);

  const existingEssayQuestions = await prisma.question.findMany({
    where: { category: "作文" },
    select: { id: true },
  });
  const existingEssayQuestionIds = existingEssayQuestions.map((q) => q.id);

  if (essayGroupIds.length > 0) {
    await prisma.groupItem.deleteMany({ where: { groupId: { in: essayGroupIds } } });
    await prisma.questionGroupSubmission.deleteMany({ where: { questionGroupId: { in: essayGroupIds } } });
    await prisma.questionGroup.deleteMany({ where: { id: { in: essayGroupIds } } });
    console.log(`删除了 ${essayGroupIds.length} 个作文题组`);
  }

  if (existingEssayQuestionIds.length > 0) {
    await prisma.questionSubmission.deleteMany({ where: { questionId: { in: existingEssayQuestionIds } } });
    await prisma.question.deleteMany({ where: { id: { in: existingEssayQuestionIds } } });
    console.log(`删除了 ${existingEssayQuestionIds.length} 个作文题`);
  }

  console.log("开始创建作文题组数据...");

  const essayGroup = await prisma.questionGroup.create({
    data: {
      title: "大作文练习",
      content: essayArticle,
      questionType: "chinese-essay",
      score: 50,
      subject: "语文",
      source: "练习题",
      category: "作文",
      grade: "高三",
      tags: ["作文", "语文", "高三", "练习"],
    },
  });

  console.log(`创建了作文题组: ${essayGroup.title}`);

  const question = await prisma.question.create({
    data: {
      content: "",
      questionType: "text",
      options: [],
      answer: `答案示例（以"新常态"为例）：
新常态，是时代发展的必然产物。面对新常态，我们应当以积极的心态拥抱变化，以理性的思考理解规律，以扎实的行动应对挑战。

首先，新常态之"新"要求我们打破思维定式。正如教育领域突破传统课堂界限，将学习延伸到更广阔的社会实践中，我们也需要跳出舒适区，主动适应新环境。其次，新常态之"常"蕴含规律。无论是互联网与AI技术的深度融合，还是高三学业压力的增加，其背后都有着不以人的意志为转移的客观规律。理解规律，方能顺势而为。最后，积极应对新常态需要行动力。空谈误国，实干兴邦，唯有脚踏实地，才能在新常态中站稳脚跟。

总之，新常态既是挑战也是机遇。以开放的心态迎接"新"，以理性的视角理解"常"，以坚定的行动应对"常态"，我们便能在时代的浪潮中乘风破浪。`,
      analysis: `作文评分标准：
1. 论点明确，立意深刻（15分）
2. 论据充分，论证合理（15分）
3. 语言流畅，结构完整（10分）
4. 书写清晰，字数达标（10分）`,
      score: 50,
      correctRate: 0.7,
      subject: "语文",
      source: "练习题",
      category: "作文",
      grade: "高三",
      tags: ["作文", "语文", "高三", "练习"],
    },
  });

  await prisma.groupItem.create({
    data: {
      groupId: essayGroup.id,
      questionId: question.id,
      orderIndex: 0,
    },
  });

  console.log("创建了作文题目");
  console.log("作文题组数据创建完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });