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

const poetryArticle = `#### 早发诸暨[^1]

<Center>
骆宾王

征夫怀远路，夙驾上危峦。

薄烟横绝𪩘，轻冻涩回湍。

野雾连空暗，山风入曙寒。

帝城[^2]临灞涘，禹穴[^3]枕江干。

橘性[^4]行应化，蓬心去不安。

独掩穷途泪，长歌行路难。
</Center>

[^1]: 诸暨：位于今绍兴市西南部。唐高宗末年，诗人于长安主簿任上被贬，途经于此。
[^2]: 帝城：指长安。
[^3]: 禹穴：大禹在绍兴的埋葬地。
[^4]: 橘性：《淮南子·原道训》："……橘树之江北，则化而为枳。"`;

async function main() {
  console.log("清理旧诗词鉴赏数据...");

  const poetryGroups = await prisma.questionGroup.findMany({
    where: { questionType: "chinese-reading", category: "诗词鉴赏" },
    select: { id: true },
  });
  const poetryGroupIds = poetryGroups.map((g) => g.id);

  const existingPoetryQuestions = await prisma.question.findMany({
    where: { category: "诗词鉴赏" },
    select: { id: true },
  });
  const existingPoetryQuestionIds = existingPoetryQuestions.map((q) => q.id);

  if (poetryGroupIds.length > 0) {
    await prisma.groupItem.deleteMany({ where: { groupId: { in: poetryGroupIds } } });
    await prisma.questionGroupSubmission.deleteMany({ where: { questionGroupId: { in: poetryGroupIds } } });
    await prisma.questionGroup.deleteMany({ where: { id: { in: poetryGroupIds } } });
    console.log(`删除了 ${poetryGroupIds.length} 个诗词鉴赏题组`);
  }

  if (existingPoetryQuestionIds.length > 0) {
    await prisma.questionSubmission.deleteMany({ where: { questionId: { in: existingPoetryQuestionIds } } });
    await prisma.question.deleteMany({ where: { id: { in: existingPoetryQuestionIds } } });
    console.log(`删除了 ${existingPoetryQuestionIds.length} 个诗词鉴赏题`);
  }

  console.log("开始创建诗词鉴赏题组数据...");

  const poetryGroup = await prisma.questionGroup.create({
    data: {
      title: "诗词鉴赏练习 - 早发诸暨",
      content: poetryArticle,
      questionType: "chinese-reading",
      score: 12,
      subject: "语文",
      source: "练习题",
      category: "诗词鉴赏",
      grade: "高三",
      tags: ["诗词鉴赏", "语文", "高三", "练习", "骆宾王"],
    },
  });

  console.log(`创建了诗词鉴赏题组: ${poetryGroup.title}`);

  const poetryQuestions = [
    {
      content: `下列对诗歌的理解，不正确的一项是`,
      questionType: "single",
      options: [
        { id: "A", label: `"征夫"两句，写诗人心中惦记着遥远的路程，于是就早早起来，驾车出行。` },
        { id: "B", label: `"薄烟"两句，诗人描绘了山中人家炊烟袅袅，山谷里河水凝滞不动的景象。` },
        { id: "C", label: `"橘性"句，诗人借橘树到江北就发生变化的特点，表达自己对人生的思考。` },
        { id: "D", label: `"蓬心"句，既写出了诗人当下的处境，又写出了诗人面对未来的复杂心情。` },
      ],
      answer: "B",
      analysis: `B项"山中人家炊烟袅袅"理解有误。"薄烟横绝𪩘"中的"薄烟"指山间的薄雾，而非炊烟；"轻冻涩回湍"写的是水面结了一层薄冰使得回旋的急流变得滞涩，形容的是天寒水冻的景象，并非"山谷里河水凝滞不动"。A项"征夫"指远行之人，"怀远路"即惦记着远方的路程，"夙驾"指早起驾车出行，理解正确。C项化用《淮南子》"橘逾淮为枳"的典故，理解正确。D项"蓬心"比喻心绪纷乱如飞蓬，"去不安"写出面对未来的不安，理解正确。`,
      score: 3,
      correctRate: 0.7,
    },
    {
      content: `下列对诗歌的理解与赏析，正确的一项是`,
      questionType: "single",
      options: [
        { id: "A", label: `诗歌中"夙驾""危峦""长歌"等词，表达出一种积极向上的进取精神。` },
        { id: "B", label: `"野雾"两句，运用"连"和"入"状写景物特点，以动衬静，生动形象。` },
        { id: "C", label: `"帝城"两句，上句写想象之景，下句写现实之景，虚实结合，意蕴丰富。` },
        { id: "D", label: `诗歌多用典故却毫无堆砌之感，语言风格质朴清新，情感表达直接而真挚。` },
      ],
      answer: "D",
      analysis: `D项正确。诗中"橘性"化用《淮南子》典故，"蓬心"化用《庄子》典故，"帝城""禹穴"亦用典，但用典自然不着痕迹；语言"薄烟""野雾""山风"等质朴清新；情感上"独掩穷途泪，长歌行路难"直接抒发了失意悲凉之情。A项错误，"夙驾""危峦"写的是旅途艰辛，"长歌"后接"行路难"，表达的是困顿失意，并非积极进取。B项"以动衬静"错误，"连"和"入"是描摹景物状态，并非以动衬静。C项"上句写想象之景，下句写现实之景"错误，帝城和禹穴都是诗人途经之地所见或所想的实景，并非虚实结合。`,
      score: 3,
      correctRate: 0.65,
    },
    {
      content: `如何理解诗人的"行路难"？请结合诗歌内容简要分析。`,
      questionType: "text",
      options: [],
      answer: `答案要点：
①"行路难"表面指旅途艰辛：诗人早起驾车攀登险峻山峦（"夙驾上危峦"），途中薄雾弥漫、河水结冰（"薄烟""轻冻"），野雾蔽空、山风寒峭（"野雾""山风"），路途艰难。
②"行路难"深层指人生仕途坎坷：诗人被贬途经诸暨（注释），借用"橘性行应化"暗示自己身处逆境、身不由己，"蓬心去不安"表达内心的漂泊不定与茫然。
③"行路难"还指理想难酬的悲愤：诗人"独掩穷途泪"，化用阮籍穷途之哭的典故，表达怀才不遇、走投无路的悲愤，只能"长歌"以抒怀。
【评分参考】每点2分，共6分。意思对即可。`,
      analysis: `本题要求从三个层面理解"行路难"的丰富意蕴：表层是旅途艰辛，深层是仕途坎坷，最深层是理想难酬的悲愤。答题时需结合诗句具体分析，不可脱离文本空谈。`,
      score: 6,
      correctRate: 0.55,
    },
  ];

  for (let i = 0; i < poetryQuestions.length; i++) {
    const q = poetryQuestions[i];
    const question = await prisma.question.create({
      data: {
        content: q.content,
        questionType: q.questionType,
        options: q.options,
        answer: q.answer,
        analysis: q.analysis,
        score: q.score,
        correctRate: q.correctRate,
        subject: "语文",
        source: "练习题",
        category: "诗词鉴赏",
        grade: "高三",
        tags: ["诗词鉴赏", "语文", "高三", "练习", "骆宾王"],
      },
    });

    await prisma.groupItem.create({
      data: {
        groupId: poetryGroup.id,
        questionId: question.id,
        orderIndex: i,
      },
    });

    console.log(`创建了诗词鉴赏第${i + 1}题`);
  }

  console.log("诗词鉴赏题组数据创建完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });