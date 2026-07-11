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

const languageBasicsArticle = `#### 语言基础运用

①中欧班列是翻山跨海的"钢铁驼队"，也是______。②作为"一带一路"的共建项目，飞驰的班列取代了古商道上曾行走了千年的驼队，目前已通达欧亚大约近40个国家、300多个城市。③装载的货品也从服装、化工品逐渐向新能源汽车、锂电池、光伏产品等高附加值、高科技产品转变。④班列开到哪里，发展的机会就延伸到哪里，新的商贸企业和产业园区就在班列沿线区域落地生根。⑤中欧班列将给各国人民带来实实在在的红利，为构建人类命运共同体作出更大的贡献。`;

async function main() {
  console.log("清理旧语言基础运用数据...");

  const languageBasicsGroups = await prisma.questionGroup.findMany({
    where: { questionType: "chinese-reading", category: "语言基础运用" },
    select: { id: true },
  });
  const languageBasicsGroupIds = languageBasicsGroups.map((g) => g.id);

  const existingLanguageBasicsQuestions = await prisma.question.findMany({
    where: { category: "语言基础运用" },
    select: { id: true },
  });
  const existingLanguageBasicsQuestionIds = existingLanguageBasicsQuestions.map((q) => q.id);

  if (languageBasicsGroupIds.length > 0) {
    await prisma.groupItem.deleteMany({ where: { groupId: { in: languageBasicsGroupIds } } });
    await prisma.questionGroupSubmission.deleteMany({ where: { questionGroupId: { in: languageBasicsGroupIds } } });
    await prisma.questionGroup.deleteMany({ where: { id: { in: languageBasicsGroupIds } } });
    console.log(`删除了 ${languageBasicsGroupIds.length} 个语言基础运用题组`);
  }

  if (existingLanguageBasicsQuestionIds.length > 0) {
    await prisma.questionSubmission.deleteMany({ where: { questionId: { in: existingLanguageBasicsQuestionIds } } });
    await prisma.question.deleteMany({ where: { id: { in: existingLanguageBasicsQuestionIds } } });
    console.log(`删除了 ${existingLanguageBasicsQuestionIds.length} 个语言基础运用题`);
  }

  console.log("开始创建语言基础运用题组数据...");

  const languageBasicsGroup = await prisma.questionGroup.create({
    data: {
      title: "语言基础运用练习",
      content: languageBasicsArticle,
      questionType: "chinese-reading",
      score: 6,
      subject: "语文",
      source: "练习题",
      category: "语言基础运用",
      grade: "高三",
      tags: ["语言基础运用", "语文", "高三", "练习"],
    },
  });

  console.log(`创建了语言基础运用题组: ${languageBasicsGroup.title}`);

  const question1 = await prisma.question.create({
    data: {
      content: "下列说法正确的一项是",
      questionType: "single",
      options: [
        { id: "A", label: "②句中画线的语句没有语病。" },
        { id: "B", label: '③句中的\u201C转变\u201D可以换为\u201C转化\u201D。' },
        { id: "C", label: '④句中两个\u201C就\u201D的意思相同。' },
        { id: "D", label: "⑤句中的两个画线部分可以互换位置。" },
      ],
      answer: "C",
      analysis: `A项，②句中"大约近40个国家"语义重复，"大约"与"近"都表示约数，应删去一个。
B项，③句中"转变"侧重于事物自身的变化，而"转化"侧重于事物性质的改变，此处用"转变"更恰当。
C项正确，④句中两个"就"都表示"只要……就"的条件关系，意思相同。
D项，⑤句中"给各国人民带来实实在在的红利"是具体层面的成果，"为构建人类命运共同体作出更大的贡献"是宏观层面的意义，二者有递进关系，不可互换。`,
      score: 3,
      correctRate: 0.65,
      subject: "语文",
      source: "练习题",
      category: "语言基础运用",
      grade: "高三",
      tags: ["语言基础运用", "语文", "高三", "练习"],
    },
  });

  const question2 = await prisma.question.create({
    data: {
      content: "请在第①句横线处将句子补充完整。要求：第①句概括本段的主要内容，与本句前面画横线部分结构一致，不超过15字。",
      questionType: "text",
      options: [],
      answer: '联通世界的\u201C发展之桥\u201D',
      analysis: `第①句前一分句将中欧班列比作"钢铁驼队"，后一分句应保持比喻的修辞手法和偏正结构。"翻山跨海"对应"联通世界"，"钢铁驼队"对应"发展之桥"，既概括了中欧班列促进经济发展的核心内容，又与前文形成对仗。`,
      score: 3,
      correctRate: 0.55,
      subject: "语文",
      source: "练习题",
      category: "语言基础运用",
      grade: "高三",
      tags: ["语言基础运用", "语文", "高三", "练习"],
    },
  });

  await prisma.groupItem.create({
    data: {
      groupId: languageBasicsGroup.id,
      questionId: question1.id,
      orderIndex: 0,
    },
  });

  await prisma.groupItem.create({
    data: {
      groupId: languageBasicsGroup.id,
      questionId: question2.id,
      orderIndex: 1,
    },
  });

  console.log("创建了语言基础运用题目");
  console.log("语言基础运用题组数据创建完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });