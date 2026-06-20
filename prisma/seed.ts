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

// 语法填空文章内容
const grammarArticle = `## A

Tributes have poured onto Chinese social media following the death of British conservationist Jane Goodall, aged 91, <Input/> story featured in school textbooks and who visited China 17 times. Goodall, best known <Input/> her detailed observations of chimpanzee behavior in Tanzania, dedicated her life to wildlife conservation and environmental protection. Her research revealed that chimpanzees are capable of rational thought and experience emotions such as joy and sorrow — traits once considered unique to humans. She also <Input/> (confirm) that they use tools.

## B

The Tangshan China ceramic Expo, rooted in "China's Northern Porcelain Capital", <Input/> (hold) since 1998 and grown into a national premium ceramic event. Organized annually at Tangshan International Convention and Exhibition Center, it spans over 20,000 square meters with more than 300 exhibitors. It showcases diverse wares such as Tangshan bone china, celadon and purple clay, plus masterpieces by national ceramic artists. <Input/> (highlight) of the expo include on-site master demonstrations, hands-on pottery experiences, and post-expo "porcelain fairs" for affordable purchases, <Input/> (blend) art, trade and public engagement.

## C

Sixteen years ago, Jason was a professor with <Input/> fortune of two million dollars. Today he lives in a small dormitory room. There are certainly no signs <Input/> he is a rich and successful man. But Jason appreciates this change. He is pleased to give up the lifestyle of a rich man. He was tired of <Input/> (regard) as a person who had everything <Input/> many people had nothing. He made the choice to give all his money away. And this, he said, brought him happiness and a sense of success in life.`;

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

  // 删除已有的相关数据（按外键依赖顺序）
  await prisma.questionSubmission.deleteMany();
  await prisma.questionGroupSubmission.deleteMany();
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

  // 创建语法填空的题目组
  const grammarQuestionGroup = await prisma.questionGroup.create({
    data: {
      title: "语法填空练习 - 综合训练",
      content: grammarArticle,
      questionType: "grammar",
      score: 50, // 总分是10道题×5分
      subject: "英语",
      source: "练习题",
      category: "语法填空",
      grade: "高三",
      tags: ["语法填空", "英语", "高三", "练习"],
      imageUrl: "https://picsum.photos/seed/grammar-exercise/400/300",
    },
  });

  console.log(`创建了语法填空题目组: ${grammarQuestionGroup.title}`);

  // 创建10个填空题（语法填空）
  const grammarQuestions = [
    { id: '1', answer: 'whose', correctRate: 0.65, score: 5 },
    { id: '2', answer: 'for', correctRate: 0.72, score: 5 },
    { id: '3', answer: 'confirmed', correctRate: 0.68, score: 5 },
    { id: '4', answer: 'has been held', correctRate: 0.6, score: 5 },
    { id: '5', answer: 'Highlights', correctRate: 0.75, score: 5 },
    { id: '6', answer: 'blending', correctRate: 0.7, score: 5 },
    { id: '7', answer: 'a', correctRate: 0.8, score: 5 },
    { id: '8', answer: 'that', correctRate: 0.78, score: 5 },
    { id: '9', answer: 'being regarded', correctRate: 0.55, score: 5 },
    { id: '10', answer: 'while', correctRate: 0.62, score: 5 },
  ];

  for (const q of grammarQuestions) {
    const question = await prisma.question.create({
      data: {
        content: "", // 语法填空不需要题干
        questionType: "input",
        options: [], // 填空题没有选项
        answer: q.answer,
        analysis: `第${q.id}题解析: 根据上下文和语法规则填写正确答案。`,
        score: q.score,
        correctRate: q.correctRate,
        subject: "英语",
        source: "练习题",
        category: "语法填空",
        grade: "高三",
        tags: ["语法填空", "填空题", "英语", `第${q.id}题`],
      },
    });

    // 将题目关联到题目组
    await prisma.groupItem.create({
      data: {
        groupId: grammarQuestionGroup.id,
        questionId: question.id,
        orderIndex: parseInt(q.id) - 1, // 从0开始排序
      },
    });

    console.log(`创建了语法填空第${q.id}题`);
  }

  console.log("语法填空题目数据创建完成！");

  // 英语阅读文章内容
  const readingArticle = `# D

A pair of papers, published in the scientific journal Nature, touts (标榜) the potential of new AI weather forecasting approaches — systems that could produce faster and more accurate results than traditional models. They are part of a new wave of AI models sweeping the meteorology (气象学) community worldwide.

Conventional forecasts rely on a system known as numerical weather prediction. It's a kind of mathematical model that uses complex equations (方程式) to predict the way weather systems change over time and space. These equations describe the actual physics behind the movement of air and water in the atmosphere and the oceans. Because there's so much math and physics involved, numerical weather models require extremely high levels of computational power. That makes them expensive and time-consuming to run. It also limits the fine-scale processes that these models can accurately capture.

Scientists have come up with various ways to get around these difficulties in traditional models. One strategy is a method known as parameterization — that's when scientists replace the actual physical equations in a model with a simplified program that generally captures the process without forcing the model to represent the actual physics.

But artificial intelligence could replace **these workarounds**, enthusiasts argue, with potentially faster and more accurate results.

AI models don't have to represent actual physics in the form of mathematical equations. Instead, they take in large amounts of historical weather data and learn to recognize patterns. They then use these patterns to make predictions when presented with new data on present-day weather conditions.

In principle, the much faster computational speed could provide immense benefits. But some experts note that the changing climate may pose a unique challenge for developing AI weather models. AI systems rely on historical weather data to teach them how to produce accurate forecasts. But certain kinds of weather events, such as heat waves and hurricanes, are growing more intense as the planet warms — and in some cases, they're becoming so extreme that there are few examples at all in the historical record. That could make it difficult for AI weather models to accurately simulate (模拟) events that are record-breaking or have never been seen before.

Accurately forecasting extreme weather events is one of the most crucial functions for weather models, enabling decision-makers to issue public safety announcements or facilitate evacuations (疏散) with enough time to protect high-risk populations. But if AI models are presented with weather conditions that are entirely foreign to them, it may be hard to predict how they'll react. The authors of the 2021 Royal Society paper point out that when it comes to capturing extremes with limited data, AI systems have produced mixed results — some have performed well while others not that satisfactorily.

Hybrid models that include both AI components and numerical model components may run into fewer difficulties with record-breaking events, Russ Schumacher, Colorado's state climatologist, suggested. He noted that numerical models and AI models may end up with different strengths, and human experience will remain valuable for communicating information about the weather.`;

  // 创建英语阅读的题目组
  const readingQuestionGroup = await prisma.questionGroup.create({
    data: {
      title: "AI天气预报",
      content: readingArticle,
      questionType: "en-reading",
      score: 20, // 总分是4道题×5分
      subject: "英语",
      source: "练习题",
      category: "阅读",
      grade: "高三",
      tags: ["阅读", "英语", "高三", "练习", "AI", "天气"],
      imageUrl: "https://picsum.photos/seed/reading-exercise/400/300",
    },
  });

  console.log(`创建了英语阅读题目组: ${readingQuestionGroup.title}`);

  // 创建4个阅读选择题
  const readingQuestions = [
    {
      id: '27',
      questionType: 'choice',
      content: 'What does the underlined expression "these workarounds" in Paragraph 4 refer to?',
      options: [
        { id: 'a', label: 'High costs.' },
        { id: 'b', label: 'Various methods.' },
        { id: 'c', label: 'Weather systems.' },
        { id: 'd', label: 'Inaccurate results.' }
      ],
      answer: 'b',
      correctRate: 0.65,
      score: 5
    },
    {
      id: '28',
      questionType: 'choice',
      content: 'What is Paragraph 5 mainly about?',
      options: [
        { id: 'a', label: 'The advantages of artificial intelligence.' },
        { id: 'b', label: 'The application of mathematical equations.' },
        { id: 'c', label: 'The fast collection of historical weather data.' },
        { id: 'd', label: 'The working principles of AI weather models.' }
      ],
      answer: 'd',
      correctRate: 0.7,
      score: 5
    },
    {
      id: '29',
      questionType: 'choice',
      content: 'What can we learn from the passage?',
      options: [
        { id: 'a', label: 'Decision-makers find AI forecasts more reliable.' },
        { id: 'b', label: 'AI models will eventually replace numerical ones.' },
        { id: 'c', label: 'Lack of relevant weather data challenges AI systems.' },
        { id: 'd', label: 'AI weather models help to prevent extreme climate events.' }
      ],
      answer: 'c',
      correctRate: 0.6,
      score: 5
    },
    {
      id: '30',
      questionType: 'choice',
      content: "What's the main purpose of the passage?",
      options: [
        { id: 'a', label: 'To raise global climate change awareness.' },
        { id: 'b', label: 'To stress the importance of the historical record.' },
        { id: 'c', label: 'To compare the strengths of weather prediction methods.' },
        { id: 'd', label: 'To suggest a way to improve weather prediction accuracy.' }
      ],
      answer: 'd',
      correctRate: 0.68,
      score: 5
    },
  ];

  for (const q of readingQuestions) {
    const question = await prisma.question.create({
      data: {
        content: q.content,
        questionType: q.questionType,
        options: q.options,
        answer: q.answer,
        analysis: `第${q.id}题解析: 根据文章内容选择正确答案。`,
        score: q.score,
        correctRate: q.correctRate,
        subject: "英语",
        source: "练习题",
        category: "阅读理解",
        grade: "高三",
        tags: ["阅读理解", "选择题", "英语", `第${q.id}题`],
      },
    });

    // 将题目关联到题目组
    await prisma.groupItem.create({
      data: {
        groupId: readingQuestionGroup.id,
        questionId: question.id,
        orderIndex: readingQuestions.indexOf(q),
      },
    });

    console.log(`创建了英语阅读第${q.id}题`);
  }

  console.log("英语阅读题目数据创建完成！");

  // 七选五阅读文章内容
  const sevenChooseFiveArticle = `Cut your sugar, get some exercise, eat your vegetables, sleep well. Every day, we are surrounded by information about how to live longer, healthier, happier lives. <Blank /> It is to engage in the arts.

Over the past few decades, evidence has been increasing to suggest that being more creative works wonders for our health. <Blank /> And the results are astonishing, from music in surgery reducing the amount of painkillers and anti-anxiety medicines needed, to dance programs helping people with Parkinson's disease to walk.

But the arts aren't just there for us when we are sick. As a public health scientist, I spend my days looking at data from studies—massive datasets that contain thousands of individuals who have completed questionnaires, had nurse interviews, donated blood samples and undergone brain imaging every few years of their lives. <Blank /> Using complex statistical methods, we can look at the long-term relationship between everyday arts engagement and dozens of health outcomes.

The results are remarkable. Children who engage more with the arts have a reduced risk of developing problems like depression later in life. Adults who participate more frequently in the arts and visit cultural venues are happier and feel more satisfied with their lives over the years and decades that follow. 

<Blank /> Kindergarteners who engage in music activities have increased prosocial skills as they head into primary school. Teenagers who are involved in bands, dance and editing school newspapers are less likely to get involved in antisocial behaviors or crime.

I want to be clear: I am not suggesting the arts can solve all problems. <Blank /> But the evidence remains that engaging regularly in creative activities that you enjoy is an investment in your health that is worth making.`;

  // 创建七选五的题目组
  const sevenChooseFiveGroup = await prisma.questionGroup.create({
    data: {
      title: "七选五阅读练习 - 艺术与健康",
      content: sevenChooseFiveArticle,
      questionType: "seven-choose-five",
      score: 25,
      subject: "英语",
      source: "练习题",
      category: "七选五",
      grade: "高三",
      tags: ["七选五", "英语", "高三", "练习", "艺术", "健康"],
      imageUrl: "https://picsum.photos/seed/seven-choose-five/400/300",
    },
  });

  console.log(`创建了七选五题目组: ${sevenChooseFiveGroup.title}`);

  // 创建7个选项（七选五，所有题目共用）
  const sevenChooseFiveOptions = [
    { id: 'A', label: 'A. The benefits aren\'t just psychological either.' },
    { id: 'B', label: 'B. Regular arts engagement goes beyond boosting physical health.' },
    { id: 'C', label: 'C. But there is one piece of advice I bet you have never been given.' },
    { id: 'D', label: 'D. Many of these studies contain buried questions on arts engagement.' },
    { id: 'E', label: 'E. Arts can be inaccessible to people because of cost and other reasons.' },
    { id: 'F', label: 'F. Crafts, singing, theatre and writing are good for us as part of our daily lives.' },
    { id: 'G', label: 'G. Programs being developed around the world are starting to integrate the arts into healthcare.' },
  ];

  // 每个空对应的正确答案
  const sevenChooseFiveAnswers = ['C', 'G', 'D', 'A', 'E'];

  // 为每个空创建独立的题目
  const sevenChooseFiveQuestions = [];
  for (let i = 0; i < 5; i++) {
    const question = await prisma.question.create({
      data: {
        content: "根据短文内容，从短文后的七个选项中选出能填入空白处的最佳选项。选项中有两项为多余选项。",
        questionType: 'choice',
        options: sevenChooseFiveOptions,
        answer: sevenChooseFiveAnswers[i],
        analysis: `七选五解析: 第${i + 1}空根据上下文逻辑关系选择最合适的句子填入空白处。`,
        score: 5,
        correctRate: 0.55,
        subject: "英语",
        source: "练习题",
        category: "七选五",
        grade: "高三",
        tags: ["七选五", "阅读理解", "英语"],
      },
    });

    await prisma.groupItem.create({
      data: {
        groupId: sevenChooseFiveGroup.id,
        questionId: question.id,
        orderIndex: i,
      },
    });

    sevenChooseFiveQuestions.push(question);
    console.log(`创建了七选五第${i + 1}题`);
  }

  console.log("七选五题目数据创建完成！");

  // 阅读表达文章内容
  const readingExpressionArticle = `Life felt like a mountain hike with designated stops — high school, college — where I could figure out my direction. I chose chemistry as my college major because it seemed to provide different career options. Learning organic chemistry reactions wasn't frustrating or boring, but I did not "love" my subject.

After finishing my undergraduate degree, I wanted financial independence. I looked for jobs but most needed a master's degree. I got into a graduate program and chose it, though I didn't plan to continue to a Ph.D.

However, I began to question my belief that I was not suited for a Ph. D. when I started the laboratory research project. I spent a lot of time in the lab and never felt bored. Mastering my project required constant learning and discovering. I started to prefer experiments over classes.

As my master's was drawing to a close, my confusion peaked. With my scores, I was in a good position to be hired by government-funded companies — a great opportunity I didn't want to waste. And everyone I talked to advised securing a stable job instead of pursuing a Ph. D., so I continued on to the interview stage. Still, I couldn't ignore my growing interest in research. One week before my scheduled interview with my top-choice company, I backed out. I was going to pursue a Ph. D.

I've completed my doctorate and am now an independent academic researcher. I have worked with others who are far more enthusiastic and were always sure they wanted to be scientists. I wondered how I traveled so far without "love" for the subject. Over the years, though, I have realized that neither success nor failure makes me go overboard or slip into depression. There are ups and downs, but it just feels right every morning to go to the laboratory and do experiments to learn something new. Although I have started my career as a"reluctant" (不情愿的) chemist, I am now ready to proclaim my love for what I do. All the way I try to see the relevant problems and solve them for my own satisfaction. That makes me no less capable than my peers, and no less deserving of a space in science.`;

  // 创建阅读表达的题目组
  const readingExpressionGroup = await prisma.questionGroup.create({
    data: {
      title: "阅读表达练习 - 一位化学家的职业选择",
      content: readingExpressionArticle,
      questionType: "reading-expression",
      score: 40, // 总分是4道题
      subject: "英语",
      source: "练习题",
      category: "阅读表达",
      grade: "高三",
      tags: ["阅读表达", "英语", "高三", "练习", "职业选择"],
      imageUrl: "https://picsum.photos/seed/reading-expression/400/300",
    },
  });

  console.log(`创建了阅读表达题目组: ${readingExpressionGroup.title}`);

  // 创建阅读表达题目
  const readingExpressionQuestions = [
    {
      id: '53',
      questionType: 'input',
      content: 'Why did the author choose chemistry as his college major?',
      answer: 'Because it seemed to provide different career options.',
      analysis: '根据文章第一段第二句："I chose chemistry as my college major because it seemed to provide different career options."',
      score: 10,
      correctRate: 0.75,
    },
    {
      id: '54',
      questionType: 'input',
      content: 'When did the author begin to question his belief about not being suited for a Ph. D.?',
      answer: 'When he started the laboratory research project.',
      analysis: '根据文章第三段第一句："However, I began to question my belief that I was not suited for a Ph. D. when I started the laboratory research project."',
      score: 10,
      correctRate: 0.7,
    },
    {
      id: '55',
      questionType: 'input',
      content: 'Please decide which part is false in the following statement, then underline it and explain why.',
      // subContent: '➢ The author decided to pursue a Ph. D. because he failed in the job interview.',
      answer: 'The false part is "because he failed in the job interview". According to the passage, the author backed out of the interview one week before it was scheduled, not because he failed.',
      analysis: '根据文章第四段："One week before my scheduled interview with my top-choice company, I backed out." 作者是在面试前一周主动退出的，并非面试失败。',
      score: 10,
      correctRate: 0.65,
    },
    {
      id: '56',
      questionType: 'input',
      content: 'Do you think it\'s necessary for people to love what they do? Why or why not? (In about 40 words)',
      answer: 'Answers may vary. A possible answer: It\'s not absolutely necessary at first, but developing love for what you do can bring more satisfaction and motivation in the long run.',
      analysis: '这是开放性问题，答案因人而异。合理即可。',
      score: 10,
      correctRate: 0.8,
    },
  ];

  for (const q of readingExpressionQuestions) {
    const question = await prisma.question.create({
      data: {
        content: q.content,
        questionType: q.questionType,
        options: [],
        answer: q.answer,
        analysis: q.analysis,
        score: q.score,
        correctRate: q.correctRate,
        subject: "英语",
        source: "练习题",
        category: "阅读表达",
        grade: "高三",
        tags: ["阅读表达", "问答题", "英语", `第${q.id}题`],
        // 存储 subContent 用于特殊题目
        // subContent: q.subContent || '',
      },
    });

    // 将题目关联到题目组
    await prisma.groupItem.create({
      data: {
        groupId: readingExpressionGroup.id,
        questionId: question.id,
        orderIndex: readingExpressionQuestions.indexOf(q),
      },
    });

    console.log(`创建了阅读表达第${q.id}题`);
  }

  console.log("阅读表达题目数据创建完成！");

  // 英语写作题目内容
  const enWritingArticle = `假设你是红星中学高二学生李华。你的英国好友Jim来信告诉你，下个月他将作为志愿者接待一位赴英中国交换生，并向你征求建议。请你用英文给他回信，内容包括：

1. 接待建议；
2. 说明理由。

注意：

1. 词数不少于80；
2. 开头和结尾已给出，不计入总词数。`;

  // 创建英语写作的题目组
  const enWritingGroup = await prisma.questionGroup.create({
    data: {
      title: "英语写作练习 - 给英国好友的回信",
      content: enWritingArticle,
      questionType: "en-writing",
      score: 25, // 写作题分数
      subject: "英语",
      source: "练习题",
      category: "作文",
      grade: "高三",
      tags: ["作文", "书信", "建议", "英语", "高三", "练习"],
      imageUrl: "https://picsum.photos/seed/en-writing/400/300",
    },
  });

  console.log(`创建了英语写作题目组: ${enWritingGroup.title}`);

  // 创建英语写作题目
  const enWritingQuestion = await prisma.question.create({
    data: {
      content: enWritingArticle,
      questionType: 'input',
      options: [],
      answer: '', // 写作题没有固定答案
      analysis: '写作题评分标准：内容要点完整（接待建议和理由），语言表达准确流畅，结构清晰，词数符合要求。',
      score: 25,
      correctRate: 0.7,
      subject: "英语",
      source: "练习题",
      category: "英语写作",
      grade: "高三",
      tags: ["英语写作", "书信", "英语"],
    },
  });

  // 将题目关联到题目组
  await prisma.groupItem.create({
    data: {
      groupId: enWritingGroup.id,
      questionId: enWritingQuestion.id,
      orderIndex: 0,
    },
  });

  console.log("英语写作题目数据创建完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });