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
  },
  {
    titleTemplate: "化简下列各式：{param1}",
    param1: ["(a+b)²", "(a-b)(a+b)", "√{param1}", "log₂(8)", "3⁴"],
  },
  {
    titleTemplate: "求解方程：{param1}",
    param1: ["2x + 5 = 10", "x² - 4 = 0", "3x - 7 = 14", "x² + x - 6 = 0"],
  },
  {
    titleTemplate: "证明：{param1}",
    param1: [
      "等腰三角形两底角相等",
      "平行四边形的对角线互相平分",
      "直角三角形的勾股定理",
    ],
  },
  {
    titleTemplate: "阅读下面的文言文，完成后面的题目：{param1}",
    param1: [
      "《劝学》节选",
      "《师说》节选",
      "《阿房宫赋》节选",
      "《赤壁赋》节选",
    ],
  },
  {
    titleTemplate: "The weather forecast says it _____ rain tomorrow.",
    param1: ["will", "is going to", "shall", "would"],
  },
  {
    titleTemplate: "如图所示，在光滑水平面上，质量为 m 的物块在水平恒力 F 作用下运动，求物体的加速度。",
    param1: [],
  },
  {
    titleTemplate: "写出下列化学方程式：{param1}",
    param1: [
      "碳酸钙与盐酸反应",
      "铁在氧气中燃烧",
      "水的电解",
      "氢氧化钠与硫酸反应",
    ],
  },
  {
    titleTemplate: "完形填空：阅读下面的短文，从每小题的四个选项中选出最佳答案。",
    param1: [],
  },
  {
    titleTemplate: "七选五题：阅读下面的短文，根据短文内容从每小题的七个选项中选出五个最佳选项。",
    param1: [],
  },
];

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomYear(): number {
  return Math.floor(Math.random() * (2025 - 2018 + 1)) + 2018;
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
  console.log("开始创建题目...");

  await prisma.question.deleteMany();

  let questionCount = 0;

  for (const subject of subjects) {
    const subjectCategories = categoriesBySubject[subject] || [];
    for (const category of subjectCategories) {
      const countPerCategory = Math.floor(Math.random() * 8) + 3;
      for (let i = 0; i < countPerCategory; i++) {
        const template = randomPick(questionTemplates);
        let title = template.titleTemplate;

        if (template.param1.length > 0) {
          const param = randomPick(template.param1);
          title = title.replace("{param1}", param);
        }

        const questionType = randomPick(questionTypes);
        const year = randomYear();
        const sources = ["高考真题", "模拟试卷", "期中考试", "期末考试", "竞赛题", "练习题"];
        const source = randomPick(sources);

        await prisma.question.create({
          data: {
            title,
            subject,
            questionType,
            category,
            year,
            source,
            tags: randomTags(subject, category),
            imageUrl: `https://picsum.photos/seed/${questionCount}/400/300`,
          },
        });
        questionCount++;
      }
    }
  }

  console.log(`成功创建 ${questionCount} 道题目！`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });