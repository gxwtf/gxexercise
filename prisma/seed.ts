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

// 完形填空文章内容
const clozeArticle = `I'm not a professional <ClozeBlank />. My husband and I had suddenly decided on a wild holiday after watching several videos on rock climbing. Our first climb was <ClozeBlank /> than I had imagined, as it required much arm strength. I'm pretty active and fit, but my arm muscles aren't the strongest. Yet we managed to <ClozeBlank /> the route and it was quite fun.

Soon we tried the next climb. I stood at the bottom of a cliff, wondering whether I should climb or not. I was <ClozeBlank /> — half of me wanted to back out, while the other half felt like I should go for it. My husband was above me, just a little farther up the cliff face. He was <ClozeBlank />— or appeared to be at least— and was willing me on.

I carried on until there seemed to be fewer pegs (攀岩的岩点). I had to stretch my leg to <ClozeBlank /> the next peg, which was hard to land on, because it was so skinny. I hesitated. I knew if I <ClozeBlank /> myself, I could miss it and fall. As fear was beginning to <ClozeBlank />, my legs started to shake. I knew if I allowed this panic to flood me, I might fall. So I <ClozeBlank /> my head, visualized where my foot would land on the peg, managed to stop my legs from <ClozeBlank /> and went for it. Phew! I <ClozeBlank /> it. I was on the peg. It was smaller than the last. I could only fit one foot on, the other balanced on top. I felt <ClozeBlank /> for a moment— we were halfway through and had passed the trickiest part.

Thirty meters high— we were near the top. By this point, the rock was sticking outward, which was dangerous. But I couldn't afford to panic now. I managed to blank my mind and drag myself around the rock, transforming my fear into the <ClozeBlank /> I needed. I grabbed the handhold and swung my foot around onto the rock. For the first time, I experienced fear as being separate from myself. I realized that I actually had the power to notice myself feeling fear and I knew exactly what I needed to do: to breathe, and take the leap (跳跃) with <ClozeBlank />.

Finally, I reached the top and felt excited. Something had <ClozeBlank />. Fear is unbelievably powerful, but now I know, so am I.`;

// 完形填空的题目和答案
const clozeQuestions = [
  {
    id: '1',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'walker' },
      { id: 'b', label: 'climber' },
      { id: 'c', label: 'coach' },
      { id: 'd', label: 'rescuer' }
    ],
    answer: 'b',
    correctRate: 0.75,
    score: 5
  },
  {
    id: '2',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'safer' },
      { id: 'b', label: 'faster' },
      { id: 'c', label: 'harder' },
      { id: 'd', label: 'smoother' }
    ],
    answer: 'c',
    correctRate: 0.65,
    score: 5
  },
  {
    id: '3',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'plan' },
      { id: 'b', label: 'track' },
      { id: 'c', label: 'accept' },
      { id: 'd', label: 'complete' }
    ],
    answer: 'd',
    correctRate: 0.7,
    score: 5
  },
  {
    id: '4',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'torn' },
      { id: 'b', label: 'hurt' },
      { id: 'c', label: 'serious' },
      { id: 'd', label: 'excited' }
    ],
    answer: 'a',
    correctRate: 0.6,
    score: 5
  },
  {
    id: '5',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'sad' },
      { id: 'b', label: 'calm' },
      { id: 'c', label: 'scared' },
      { id: 'd', label: 'lucky' }
    ],
    answer: 'c',
    correctRate: 0.8,
    score: 5
  },
  {
    id: '6',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'fix' },
      { id: 'b', label: 'kick' },
      { id: 'c', label: 'break' },
      { id: 'd', label: 'reach' }
    ],
    answer: 'd',
    correctRate: 0.72,
    score: 5
  },
  {
    id: '7',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'doubted' },
      { id: 'b', label: 'comforted' },
      { id: 'c', label: 'satisfied' },
      { id: 'd', label: 'disappointed' }
    ],
    answer: 'a',
    correctRate: 0.68,
    score: 5
  },
  {
    id: '8',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'run out' },
      { id: 'b', label: 'give in' },
      { id: 'c', label: 'take hold' },
      { id: 'd', label: 'break down' }
    ],
    answer: 'c',
    correctRate: 0.75,
    score: 5
  },
  {
    id: '9',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'nodded' },
      { id: 'b', label: 'cleared' },
      { id: 'c', label: 'raised' },
      { id: 'd', label: 'clouded' }
    ],
    answer: 'b',
    correctRate: 0.65,
    score: 5
  },
  {
    id: '10',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'aching' },
      { id: 'b', label: 'moving' },
      { id: 'c', label: 'shaking' },
      { id: 'd', label: 'twisting' }
    ],
    answer: 'c',
    correctRate: 0.78,
    score: 5
  },
  {
    id: '11',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'left' },
      { id: 'b', label: 'made' },
      { id: 'c', label: 'missed' },
      { id: 'd', label: 'changed' }
    ],
    answer: 'b',
    correctRate: 0.71,
    score: 5
  },
  {
    id: '12',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'relieved' },
      { id: 'b', label: 'nervous' },
      { id: 'c', label: 'hesitant' },
      { id: 'd', label: 'regretful' }
    ],
    answer: 'a',
    correctRate: 0.69,
    score: 5
  },
  {
    id: '13',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'joy' },
      { id: 'b', label: 'honesty' },
      { id: 'c', label: 'pride' },
      { id: 'd', label: 'strength' }
    ],
    answer: 'd',
    correctRate: 0.73,
    score: 5
  },
  {
    id: '14',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'surprise' },
      { id: 'b', label: 'gratitude' },
      { id: 'c', label: 'curiosity' },
      { id: 'd', label: 'confidence' }
    ],
    answer: 'd',
    correctRate: 0.67,
    score: 5
  },
  {
    id: '15',
    questionType: 'choice',
    options: [
      { id: 'a', label: 'mixed' },
      { id: 'b', label: 'dropped' },
      { id: 'c', label: 'shifted' },
      { id: 'd', label: 'darkened' }
    ],
    answer: 'c',
    correctRate: 0.74,
    score: 5
  }
];

async function main() {
  console.log("开始创建完形填空题目数据...");

  // 删除已有的相关数据
  await prisma.groupItem.deleteMany();
  await prisma.questionGroup.deleteMany();
  await prisma.question.deleteMany();

  // 创建完形填空的题目组
  const questionGroup = await prisma.questionGroup.create({
    data: {
      title: "完形填空练习 - 勇敢面对恐惧",
      content: clozeArticle,
      questionType: "cloze",
      score: 75, // 总分是15道题×5分
      subject: "英语",
      source: "练习题",
      category: "完形填空",
      grade: "高三",
      tags: ["完形填空", "英语", "高三", "练习"],
      imageUrl: "https://picsum.photos/seed/cloze-exercise/400/300",
    },
  });

  console.log(`创建了完形填空题目组: ${questionGroup.title}`);

  // 创建15个选择题
  for (const q of clozeQuestions) {
    const question = await prisma.question.create({
      data: {
        content: "", // 完形填空的选择题不需要题干
        questionType: q.questionType,
        options: q.options,
        answer: q.answer,
        analysis: `第${q.id}题解析: 根据上下文语境选择最合适的词汇。`,
        score: q.score,
        correctRate: q.correctRate,
        subject: "英语",
        source: "练习题",
        category: "完形填空",
        grade: "高三",
        tags: ["完形填空", "选择题", "英语", `第${q.id}题`],
      },
    });

    // 将题目关联到题目组
    await prisma.groupItem.create({
      data: {
        groupId: questionGroup.id,
        questionId: question.id,
        orderIndex: parseInt(q.id) - 1, // 从0开始排序
      },
    });

    console.log(`创建了第${q.id}题`);
  }

  console.log("完形填空题目数据创建完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });