import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { subjects, categoriesBySubject } from "../src/constants/subjects";
import { questionTypes } from "../src/constants/questionTypes";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const questionTemplates = [
  {
    titleTemplate: "已知函数 f(x) = {param1}，求该函数的导数",
    param1: ["x² + 2x + 1", "sin(x)", "eˣ", "ln(x)", "x³ - 3x"],
    options: [{"A": "2x + 2"}, {"B": "cos(x)"}, {"C": "eˣ"}, {"D": "1/x"}],
    answer: "A",
  },
  {
    titleTemplate: "化简下列各式：{param1}",
    param1: ["(a+b)²", "(a-b)(a+b)", "√{param1}", "log₂(8)", "3⁴"],
    options: [{"A": "a² + 2ab + b²"}, {"B": "a² - b²"}, {"C": "3"}, {"D": "81"}],
    answer: "A",
  },
  {
    titleTemplate: "求解方程：{param1}",
    param1: ["2x + 5 = 10", "x² - 4 = 0", "3x - 7 = 14", "x² + x - 6 = 0"],
    options: [{"A": "x = 2.5"}, {"B": "x = ±2"}, {"C": "x = 7"}, {"D": "x = 2 或 x = -3"}],
    answer: "A",
  },
  {
    titleTemplate: "证明：{param1}",
    param1: [
      "等腰三角形两底角相等",
      "平行四边形的对角线互相平分",
      "直角三角形的勾股定理",
    ],
    answer: "证明过程...",
  },
  {
    titleTemplate: "阅读下面的文言文，完成后面的题目：{param1}",
    param1: [
      "《劝学》节选",
      "《师说》节选",
      "《阿房宫赋》节选",
      "《赤壁赋》节选",
    ],
    options: [{"A": "选项A"}, {"B": "选项B"}, {"C": "选项C"}, {"D": "选项D"}],
    answer: "B",
  },
  {
    titleTemplate: "The weather forecast says it _____ rain tomorrow.",
    param1: ["will", "is going to", "shall", "would"],
    options: [{"A": "will"}, {"B": "is going to"}, {"C": "shall"}, {"D": "would"}],
    answer: "B",
  },
  {
    titleTemplate: "如图所示，在光滑水平面上，质量为 m 的物块在水平恒力 F 作用下运动，求物体的加速度。",
    param1: [],
    options: [{"A": "a = F/m"}, {"B": "a = m/F"}, {"C": "a = Fm"}, {"D": "a = F - m"}],
    answer: "A",
  },
  {
    titleTemplate: "写出下列化学方程式：{param1}",
    param1: [
      "碳酸钙与盐酸反应",
      "铁在氧气中燃烧",
      "水的电解",
      "氢氧化钠与硫酸反应",
    ],
    answer: "CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑",
  },
  {
    titleTemplate: "完形填空：阅读下面的短文，从每小题的四个选项中选出最佳答案。",
    param1: [],
    options: [{"A": "选项A"}, {"B": "选项B"}, {"C": "选项C"}, {"D": "选项D"}],
    answer: "C",
  },
  {
    titleTemplate: "七选五题：阅读下面的短文，根据短文内容从每小题的七个选项中选出五个最佳选项。",
    param1: [],
    answer: "A, C, E, F, G",
  },
];

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomYear(): number {
  return Math.floor(Math.random() * (2026 - 2020 + 1)) + 2020;
}

function randomScore(): number {
  const scores = [2, 3, 4, 5, 6, 8, 10, 12, 15];
  return randomPick(scores);
}

function randomShowOnHomepage(): boolean {
  return Math.random() > 0.2;
}

function randomCorrectRate(): number | null {
  if (Math.random() > 0.3) {
    return parseFloat((Math.random() * 0.6 + 0.3).toFixed(2));
  }
  return null;
}

function randomGrade(): string | null {
  const grades = ["高一", "高二", "高三"];
  // 有70%的概率分配年级，30%的概率不分配
  return Math.random() > 0.3 ? randomPick(grades) : null;
}

function randomTags(subject: string, category: string): string[] {
  const commonTags = ["基础", "提高", "拓展", "高考真题", "模拟题", "竞赛题"];
  const subjectTags: Record<string, string[]> = {
    "数学": ["导数", "积分", "几何", "代数", "概率"],
    "语文": ["阅读", "写作", "文言文", "诗词", "现代文"],
    "英语": ["语法", "词汇", "阅读", "写作", "完形"],
    "物理": ["力学", "电磁学", "光学", "热学", "实验"],
    "化学": ["反应", "方程式", "有机", "无机", "元素"],
  };
  const tags = [...(subjectTags[subject] || []), ...commonTags];
  const count = Math.floor(Math.random() * 3) + 1;
  const selected: string[] = [];
  for (let i = 0; i < count && tags.length > 0; i++) {
    const idx = Math.floor(Math.random() * tags.length);
    selected.push(tags[idx]);
    tags.splice(idx, 1);
  }
  return selected;
}

async function main() {
  console.log("开始创建题目数据...");

  await prisma.paperItem.deleteMany();
  await prisma.groupItem.deleteMany();
  await prisma.testPaper.deleteMany();
  await prisma.questionGroup.deleteMany();
  await prisma.question.deleteMany();

  let questionCount = 0;
  let groupCount = 0;
  let paperCount = 0;

  for (const subject of subjects) {
    const subjectCategories = categoriesBySubject[subject] || [];
    for (const category of subjectCategories) {
      if (category === "套卷") continue;

      const countPerCategory = Math.floor(Math.random() * 8) + 3;
      for (let i = 0; i < countPerCategory; i++) {
        const template = randomPick(questionTemplates);
        let content = template.titleTemplate;

        if (template.param1 && template.param1.length > 0) {
          const param = randomPick(template.param1);
          content = content.replace("{param1}", param);
        }

        const questionType = randomPick(questionTypes);
        const year = randomYear();
        const sources = ["高考真题", "高考模拟", "各区期末", "广学模拟", "竞赛题", "练习题"];
        const source = randomPick(sources);

        const optionsData = template.options ? JSON.parse(JSON.stringify(template.options)) : undefined;
        
        await prisma.question.create({
          data: {
            content,
            questionType,
            options: optionsData,
            answer: template.answer,
            analysis: "本题考查..." + content.substring(0, 50),
            score: randomScore(),
            showOnHomepage: randomShowOnHomepage(),
            correctRate: randomCorrectRate(),
            subject,
            source,
            category,
            year,
            tags: randomTags(subject, category),
            imageUrl: `https://picsum.photos/seed/${questionCount}/400/300`,
          },
        });
        questionCount++;
      }
    }
  }

  console.log(`成功创建 ${questionCount} 道题目！`);

  for (const subject of subjects) {
    const groupsPerSubject = Math.floor(Math.random() * 3) + 2;
    for (let g = 0; g < groupsPerSubject; g++) {
      const categories = categoriesBySubject[subject] || [];
      const category = randomPick(categories.filter(c => c !== "套卷"));
      const sources = ["高考真题", "模拟试卷", "阅读理解专项"];
      const source = randomPick(sources);

      const groupQuestions = await prisma.question.findMany({
        where: { subject, category, showOnHomepage: true },
        take: Math.floor(Math.random() * 3) + 2,
      });

      if (groupQuestions.length < 2) continue;

      const group = await prisma.questionGroup.create({
        data: {
          title: `${subject} ${category} 组题 ${g + 1}`,
          content: `## 阅读材料\n\n这是一篇关于${category}的阅读材料，阅读后回答下列问题。\n\n文章内容...`,
          subject,
          source,
          category,
          tags: ["组题", category],
        },
      });

      groupQuestions.forEach((q, index) => {
        prisma.groupItem.create({
          data: {
            groupId: group.id,
            questionId: q.id,
            orderIndex: index,
          },
        });
      });

      groupCount++;
    }
  }

  console.log(`成功创建 ${groupCount} 个组题！`);

  for (const subject of subjects) {
    const papersPerSubject = Math.floor(Math.random() * 2) + 1;
    for (let p = 0; p < papersPerSubject; p++) {
      const sources = ["高考真题", "模拟试卷", "期中测试", "期末测试"];
      const source = randomPick(sources);

      const paper = await prisma.testPaper.create({
        data: {
          title: `${subject} ${source} ${p + 1}`,
          description: `## 考试说明\n\n本试卷共包含若干题目，满分100分，考试时间120分钟。\n\n### 注意事项\n\n1. 答题前请将姓名、准考证号填写在答题卡上。\n2. 选择题用2B铅笔填涂，非选择题用黑色签字笔作答。`,
          subject,
          source,
          grade: randomGrade(),
          year: randomYear(),
          totalScore: 100,
          duration: 120,
          tags: ["套卷", source],
        },
      });

      const questions = await prisma.question.findMany({
        where: { subject, showOnHomepage: true },
        take: Math.floor(Math.random() * 8) + 5,
      });

      questions.forEach((q, index) => {
        prisma.paperItem.create({
          data: {
            paperId: paper.id,
            itemId: q.id,
            itemType: "Question",
            orderIndex: index,
          },
        });
      });

      paperCount++;
    }
  }

  console.log(`成功创建 ${paperCount} 套试卷！`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });