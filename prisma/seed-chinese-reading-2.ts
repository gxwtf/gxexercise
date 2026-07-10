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

const classicalChineseArticle = `#### （一）

季孙欲以田赋[^1]，使冉有访诸仲尼。仲尼曰："丘不识也。"三发，卒曰："子为国老，待子而行，若之何子之不言也？"仲尼不对，而私于冉有曰："君子之行也，度于礼，施取其厚，敛从其薄。若不度于礼，而贪冒无厌，则虽以田赋，将又不足。且子季孙若欲行而法，则周公之典在；若欲苟而行，又何访焉？"弗听。

<RightAlign>（取材于《左传·哀公十一年》）</RightAlign>

#### （二）

君子者，正天下之疑者也。疑于善与，殆犹其未善与，则进而访于君子，得一言以折中[^2]其从违，而即毅然以必为而必去。君子所乐以其正待天下之疑问，唯此之为无吝矣。若夫知其必见可于君子也，勿待问也，而犹问焉，则是欲暴其是于君子，而邀君子之赞誉也；夫挟一得之詹詹[^3]，而取必于君子以为之誉，君子固不为其所邀矣。夫知其必不见可于君子也，勿庸问也，而抑问焉，是其欲屈君子以从己也，不则欲引君子之辩而以利口穷之也；夫君子固不为之屈，而亦恶屑为无益之辩，以滋匪人[^4]之利口哉！斯二者，皆自绝于君子，而君子固弗答焉。

季氏之欲用田赋，此不问而知夫子之必不见可者也。冉有不审，贸贸然而亟为之访，三发而不置。自恒情言之，此鲁之所由以兴替，民之所由以死生，圣人知不可为者也，则何爱一言而不以救垂堂之坠乎？即勿听也，民死于季氏之政，而生于夫子之言，亦讵不可以自尽与？然而夫子必勿之答，非圣人之仅不欲为小人辱也，夫圣人亦如天而己矣，天无绝物，而物有绝天；物绝天，而天又奚劳邪！

且使夫子而正告以不可也，季其悛乎？季之弗能悛也，非处心积虑之久而以取必者乎？弗能悛而必访，访而不可，则比匪之党利口蜂起，而与夫子竞其短长。夫小人之词岂足以穷君子哉？然而操一相穷之心，则苟可以逞而犹为之一掉[^5]也。如是，则言愈长而是非愈紊。故曰：圣人犹天也，天不能竞虺蜴之毒，争虎狼之暴，而亦姑听其自已。

<RightAlign>（取材于王夫之《续春秋左氏传博议》）</RightAlign>

[^1]: 以田赋：按田亩征税，指季孙采取的赋制改革。
[^2]: 折中：取正，作为判断事物的准则。
[^3]: 詹詹：喋喋不休的样子。
[^4]: 匪人：行为不端，不怀好意的人。
[^5]: 掉：鼓动、逞口舌之能。`;

async function main() {
  console.log("清理旧文言文阅读数据...");

  const classicalChineseGroups = await prisma.questionGroup.findMany({
    where: { questionType: "chinese-reading", category: "文言文" },
    select: { id: true },
  });
  const classicalChineseGroupIds = classicalChineseGroups.map((g) => g.id);

  const existingClassicalChineseQuestions = await prisma.question.findMany({
    where: { category: "文言文" },
    select: { id: true },
  });
  const existingClassicalChineseQuestionIds = existingClassicalChineseQuestions.map((q) => q.id);

  if (classicalChineseGroupIds.length > 0) {
    await prisma.groupItem.deleteMany({ where: { groupId: { in: classicalChineseGroupIds } } });
    await prisma.questionGroupSubmission.deleteMany({ where: { questionGroupId: { in: classicalChineseGroupIds } } });
    await prisma.questionGroup.deleteMany({ where: { id: { in: classicalChineseGroupIds } } });
    console.log(`删除了 ${classicalChineseGroupIds.length} 个文言文阅读题组`);
  }

  if (existingClassicalChineseQuestionIds.length > 0) {
    await prisma.questionSubmission.deleteMany({ where: { questionId: { in: existingClassicalChineseQuestionIds } } });
    await prisma.question.deleteMany({ where: { id: { in: existingClassicalChineseQuestionIds } } });
    console.log(`删除了 ${existingClassicalChineseQuestionIds.length} 个文言文阅读题`);
  }

  console.log("开始创建文言文阅读题组数据...");

  const classicalChineseGroup = await prisma.questionGroup.create({
    data: {
      title: "文言文阅读练习 - 季孙欲以田赋",
      content: classicalChineseArticle,
      questionType: "chinese-reading",
      score: 18,
      subject: "语文",
      source: "练习题",
      category: "文言文",
      grade: "高三",
      tags: ["文言文阅读", "语文", "高三", "练习", "左传", "王夫之"],
    },
  });

  console.log(`创建了文言文阅读题组: ${classicalChineseGroup.title}`);

  const classicalChineseQuestions = [
    {
      content: `下列对语句中加点词的解释，不正确的一项是`,
      questionType: "single",
      options: [
        { id: "A", label: `则周公之典在    典：典故` },
        { id: "B", label: `则是欲暴其是于君子    暴：显露` },
        { id: "C", label: `三发而不置    置：放弃` },
        { id: "D", label: `季其悛乎    悛：悔改` },
      ],
      answer: "A",
      analysis: `"典"在此处应解释为"典章、制度、法令"，而非"典故"。孔子说"周公之典在"，意思是周公制定的典章制度尚在，季孙若想行事合乎法度，便应遵循周公之制。B项"暴"为显露；C项"置"为放弃、停止；D项"悛"为悔改，三项解释均正确。`,
      score: 3,
      correctRate: 0.72,
    },
    {
      content: `下列各组语句中，加点词的意义和用法都相同的一组是`,
      questionType: "single",
      options: [
        { id: "A", label: `①待子而行    ②而即毅然以必为而必去` },
        { id: "B", label: `①君子之行也    ②夫圣人亦如天而己矣` },
        { id: "C", label: `①而私于冉有曰    ②亦恶屑为无益之辩，以滋匪人之利口哉` },
        { id: "D", label: `①而君子固弗答焉    ②天无绝物，而物有绝天` },
      ],
      answer: "D",
      analysis: `D项中两个"而"均为连词，表转折关系，可译为"但、却"。A项①"而"表顺承，②"而"表并列；B项①"也"为句末语气词表陈述，②"矣"表已然或肯定；C项①"于"为介词"对、向"，②"以"为连词表目的。`,
      score: 3,
      correctRate: 0.65,
    },
    {
      content: `下列对文中语句的理解，不正确的一项是`,
      questionType: "single",
      options: [
        { id: "A", label: `施取其厚，敛从其薄——给予好处要力求多，收取租税要尽量少` },
        { id: "B", label: `而即毅然以必为而必去——就果断地决定是一定做还是一定不做` },
        { id: "C", label: `圣人知不可为者也——圣人知道这是他不可能做到的` },
        { id: "D", label: `亦讵不可以自尽与——（孔子）又怎么能不尽一下自己的力量呢` },
      ],
      answer: "C",
      analysis: `"圣人知不可为者也"应理解为"圣人知道（季氏田赋改革）是不可行的事"，而非"圣人知道这是他不可能做到的"。此处"不可为"是评价事情本身不可实行，不是说圣人做不到。A、B、D三项理解均正确。`,
      score: 3,
      correctRate: 0.6,
    },
    {
      content: `根据文意，下列理解与推断，不正确的一项是`,
      questionType: "single",
      options: [
        { id: "A", label: `孔子认为季氏如因贪图财利而进行赋制改革，那么这样的改革仍将无法满足他。` },
        { id: "B", label: `王夫之认为知道自己所做的事是正确的，却要问君子，不过想得到君子称赞罢了。` },
        { id: "C", label: `王夫之认为，季氏想要进行的赋制改革是关系到百姓生死、国家兴衰存亡的大事。` },
        { id: "D", label: `王夫之批评了季氏等人企图以巧言为难君子的行为，赞扬了君子讷言敏行的品格。` },
      ],
      answer: "D",
      analysis: `D项"赞扬了君子讷言敏行的品格"在原文中没有依据。王夫之的论述主要围绕孔子"弗答"的深层原因展开，强调圣人不与小人进行无益之辩，而非一般地谈"讷言敏行"。A项对应孔子"贪冒无厌，则虽以田赋，将又不足"；B项对应王夫之"欲暴其是于君子，而邀君子之赞誉也"；C项对应"此鲁之所由以兴替，民之所由以死生"。`,
      score: 3,
      correctRate: 0.55,
    },
    {
      content: `季氏想进行赋制改革，派冉有征询孔子的意见，孔子并没有公开回应，王夫之是如何理解孔子这种态度的？请简要分析。`,
      questionType: "text",
      options: [],
      answer: `答案要点：
①孔子认为季氏的赋制改革是不合礼法的，而季氏也知道孔子不会同意。
②季氏派冉有征求意见，无非企图强迫孔子顺从自己的意见，这是对孔子的侮辱。
③即使孔子明确表示不同意赋制改革，季氏也不会悔改，只会通过利口与之辩论，从而混淆是非，助长气焰。或：即使孔子明确表示不同意赋制改革，季氏也不会悔改，对于背离天道之人，与之辩论，只会混淆是非，助长气焰。
【评分参考】每点2分。意思对即可。`,
      analysis: `本题要求分析王夫之对孔子"弗答"态度的理解。应从三层意思入手：一是孔子与季氏在礼的问题上的根本分歧；二是季氏派人问孔子的真实目的并非真心求教，而是欲"屈君子以从己"；三是王夫之认为孔子不与小人争辩，是因为与之辩论反而会使是非愈紊，这体现了圣人"如天"的胸怀。`,
      score: 6,
      correctRate: 0.5,
    },
  ];

  for (let i = 0; i < classicalChineseQuestions.length; i++) {
    const q = classicalChineseQuestions[i];
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
        category: "文言文",
        grade: "高三",
        tags: ["文言文阅读", "语文", "高三", "练习", "左传", "王夫之"],
      },
    });

    await prisma.groupItem.create({
      data: {
        groupId: classicalChineseGroup.id,
        questionId: question.id,
        orderIndex: i,
      },
    });

    console.log(`创建了文言文阅读第${i + 1}题`);
  }

  console.log("文言文阅读题组数据创建完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });