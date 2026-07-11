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

const chineseReadingArticle = `### 麦子喊了我一声

①为了一场关于丰收的摄影展，我和几位同事已经追寻六月的热风，在豫北平原穿梭了好一阵子。

②此前，我们在太行山南麓拍摄梯田，苍翠与金黄，简单的两种颜料被大自然与人类调配出万种风情。我们在麦田抓拍呼啸而过的高铁，动与静，古老的农业与现代的工业在镜头里相逢，毫无违和之感。我们像在大地上捕捉灵感的诗人，用"麦都""祖国""天下粮仓"等大词给作品命名。我们借助无人机居高临下的视角，给身处城市的人们，描画出人间六月的壮美画卷，并从他们长久驻足与泪湿双目的反应中，一次次确认我们是美的缔造者。

③若不是那棵麦子喊了我一声，我不会从队伍里抽身而出，将镜头从宏大的叙事移开，对准万千麦子中最孤独的那一棵。

④那一棵麦子在麦田的最边缘，可能是播种时不小心从农人手中跌落的。它无法和麦田中央的伙伴形成共鸣，只好在麦浪涌动的时刻，落寞地"望洋兴叹"。但这并不影响它的成长，它同样顶起了一把麦穗，饱满而丰盈。我看见它的时候，一群麻雀正踩在上面，它的脊背不堪重负，弯成了一张弓。麻雀们却把它当成了跷跷板，边吃边晃，玩得不亦乐乎。这时候麦子才发现，它既没有毒刺可以防身，也没能长成高耸入云凛然不可犯的绝崖孤松……只能默默地承受着一切，直到认出了我。

⑤它借麻雀的嗓子喊了我一声。就是这一声，让我从无人机的高度跌下来，变回了那个黄泥巴腿子的我。我要贴着大地，再看一看我的麦子亲人。

⑥2010年高考结束，麦子也正好从地里拉了回来。那时候我家盖了新房，可以在房顶晒麦子了，我和父亲一袋一袋地往房顶扛。那么重的麦子啊，压得我两腿直打战，爬了半截楼梯就得停下来喘气。我们花了一上午时间才扛完，衣裳早就湿透了。把麦子摊开之后，父亲气喘吁吁地说："上学上到这一步，不可能后退了啊……过几天把粮食卖掉，送你去上大学。"这时我才知道，我刚才扛的不是麦子，而是自己的整个人生。

⑦我很用心地看守麦子，在房顶的阴凉处铺一张席子，一边想象大学的生活，一边驱赶偷食的麻雀。

⑧半夜下起了暴雨，我被雷声惊醒，丢魂似的冲向外面，心想麦子可不敢淋湿啊，一发芽发霉可就卖不出去了。等我到了房顶，才发现父母已经用塑料布把麦子盖得严严实实了。闪电的光芒划亮夜空，我看见雨水正肆无忌惮地抽打着父母的脸颊。

⑨天气阴晴不定，过了好多天才把麦子晒干。我们将麦子装袋，扛到车上，一袋一袋摞起来。父亲启动车子时，我爬过一袋一袋麦子，像爬楼梯那样，登上了粮食的顶峰。到了收粮站，我们把麻袋卸到地上，一袋一袋倒干净。看着我们的麦子融进麦子的海洋，我竟有了几分不舍。

⑩那么多的麦子，一粒一粒供养我性命，一袋一袋将我托举，让我摸到了大学的门槛。

⑪就是这一声，让我的目光从无人机的高度跌下来，回归到一棵麦子的高度。我窥见了麦浪的秘密，那是无数棵麦子借着热风，在不停地锻打自己。它们要把自己锻打成铜的箭镞，对着天空支棱起锋芒，最后飞向光芒万丈的太阳。

⑫"好好学习，将来去市里上班。"这句话是当时的大人们最爱说的励志名言。那时候，城市是遥不可及的梦境。大学入学后，我开始频繁地接触城市新奇的事物，却很难再吃到家里的麦子。

⑬村庄也在迅速变化着。很多村民把田地租给外来的生意人，扛起行囊去往远方的大城市。堂哥在村里做养殖业失败后，去上海的电子厂做流水线工人，每天下班后关节僵硬，躺在床上动弹不得，第二天却依然能够运指如飞。他在微信群里调侃说，劳动可以活血化瘀，简直包治百病。在他身上，我看到了麦子在烈日下努力拔节抽穗的样子。朋友辞掉小镇的临时工作，到城市做售楼员，楼市受到冲击之后，又转去送外卖，有时候十几个外卖员同抢一笔单子，收入却并不可观。他说，市中心有夸父追日的铜雕塑，每次路过那里，他都会想起同行王计兵的诗句——用双脚锤击大地，在这个人间不断地淬火。在朋友的讲述里，我找回了小时候光脚在麦茬上奔跑的痛感，一定有个十万火急的目标需要人们去追逐，以前是果腹的麦子，后来才是夸父的太阳。

⑭我家的农田是去年秋天租出去的。此后，再也没有母亲一般的麦子，一粒一粒地供养我性命；再也没有父亲一般的麦子，一袋一袋地将我用力托举。我，变成了城市里一棵孤独的麦子，扎根太浅，很容易就被生活的重量压弯脊背。

⑮但是我想说，是麦子，就会生出锋芒；是麦子，就该拥有对着太阳揭竿而起的力量。一棵麦子穷其一生，也不过是把自己的籽实，从地面抬高了一尺，但正是有了这一尺接一尺的脚踏实地的努力，方才接续与堆积起了高耸入云的希望。

<RightAlign>（取材于杜永利的同名散文）</RightAlign>`;

async function main() {
  console.log("清理旧语文阅读（散文）数据...");

  const readingGroups = await prisma.questionGroup.findMany({
    where: { questionType: "chinese-reading", category: "语文阅读" },
    select: { id: true },
  });
  const readingGroupIds = readingGroups.map((g) => g.id);

  const existingReadingQuestions = await prisma.question.findMany({
    where: { category: "语文阅读" },
    select: { id: true },
  });
  const existingReadingQuestionIds = existingReadingQuestions.map((q) => q.id);

  if (readingGroupIds.length > 0) {
    await prisma.groupItem.deleteMany({ where: { groupId: { in: readingGroupIds } } });
    await prisma.questionGroupSubmission.deleteMany({ where: { questionGroupId: { in: readingGroupIds } } });
    await prisma.questionGroup.deleteMany({ where: { id: { in: readingGroupIds } } });
    console.log(`删除了 ${readingGroupIds.length} 个语文阅读题组`);
  }

  if (existingReadingQuestionIds.length > 0) {
    await prisma.questionSubmission.deleteMany({ where: { questionId: { in: existingReadingQuestionIds } } });
    await prisma.question.deleteMany({ where: { id: { in: existingReadingQuestionIds } } });
    console.log(`删除了 ${existingReadingQuestionIds.length} 个语文阅读题`);
  }

  console.log("开始创建语文阅读（散文）题组数据...");

  const readingGroup = await prisma.questionGroup.create({
    data: {
      title: "语文阅读练习 - 麦子喊了我一声",
      content: chineseReadingArticle,
      questionType: "chinese-reading",
      score: 18,
      subject: "语文",
      source: "练习题",
      category: "语文阅读",
      grade: "高三",
      tags: ["语文阅读", "语文", "高三", "练习", "散文", "杜永利"],
    },
  });

  console.log(`创建了语文阅读题组: ${readingGroup.title}`);

  const readingQuestions = [
    {
      content: `下列对文中加点词语的解说，不正确的一项是`,
      questionType: "single",
      options: [
        { id: "A", label: `毫无违和之感　　　　　　违和：不协调` },
        { id: "B", label: `雨水正肆无忌惮地抽打着父母的脸颊　　肆无忌惮：毫无顾忌` },
        { id: "C", label: `在不停地锻打自己　　　　锻打：锤炼打磨` },
        { id: "D", label: `就该拥有对着太阳揭竿而起的力量　　揭竿而起：反抗太阳的束缚` },
      ],
      answer: "D",
      analysis: `D项"揭竿而起"本义指举起竹竿当旗帜，指人民起义。在文中运用了拟人化的手法，将麦子比作具有反抗精神的人。"对着太阳揭竿而起"是在"是麦子，就会生出锋芒"的语境下，表达麦子不屈不挠、奋力向上的精神力量，而非"反抗太阳的束缚"。A项"违和"在文中指古老农业与现代工业在镜头中相融，没有不协调感，解释正确。B项"肆无忌惮"形容雨水毫无顾忌地抽打，解释正确。C项"锻打"本义是金属锻造，这里比喻麦子在热风中磨砺自己，解释正确。`,
      score: 3,
      correctRate: 0.72,
    },
    {
      content: `下列对文章的理解与赏析，不正确的一项是`,
      questionType: "single",
      options: [
        { id: "A", label: `第②段我们用无人机航拍，确认自己是美的缔造者，内心很有些自得。` },
        { id: "B", label: `第⑧段通过半夜暴雨来临时我失魂落魄的举动，表达我对麦子的珍视。` },
        { id: "C", label: `第⑨段三次写"一袋一袋"的麦子，主要是强调我对麦子的不舍之情。` },
        { id: "D", label: `第⑬段堂哥和朋友的经历，表明村民能以积极的态度应对家乡的变化。` },
      ],
      answer: "C",
      analysis: `C项对"一袋一袋"的理解不全面。第⑨段三次写"一袋一袋"：装袋、摞起、倒干净，不仅仅表达不舍，更着重表现了麦子之沉重、劳作之艰辛，以及麦子与"我"命运的紧密关联——这些麦子是"我"上大学的学费来源，承载着全家的希望。A项正确，第②段"一次次确认我们是美的缔造者"确实流露出自得之情。B项正确，"丢魂似的冲出去"表现了"我"对麦子的极度珍视。D项正确，堂哥虽做养殖失败但去电子厂后能自嘲"劳动活血化瘀"，朋友转行送外卖后从诗句中汲取力量，都体现了积极面对变化的态度。`,
      score: 3,
      correctRate: 0.65,
    },
    {
      content: `文章是如何围绕"麦子喊了我一声"构思的？请根据文章内容具体说明。`,
      questionType: "text",
      options: [],
      answer: `答案要点：
①"麦子喊了我一声"是全文的线索，贯穿始终。第③段"若不是那棵麦子喊了我一声"引出下文，第⑤段"它借麻雀的嗓子喊了我一声"点明"喊"的方式，第⑪段"就是这一声"再次呼应，结构上前后勾连。
②"这一声"促使"我"的视角发生转变：从无人机居高临下的宏大视角（第②段），跌回到贴着大地、与麦子同高的平民视角（第⑤段、第⑪段），从而发现被宏大叙事遮蔽的个体生命。
③"这一声"唤醒了"我"的个人记忆：由边缘麦子的孤独处境，联想到自己高考后扛麦子、卖麦子上大学的经历（第⑥—⑩段），以及堂哥、朋友等普通人在城市打拼的艰辛（第⑬段）。
④"这一声"深化了文章主旨：从一棵孤独的麦子到千千万万奋力向上的麦子，揭示了普通人脚踏实地、不屈不挠的生命力量（第⑮段）。
【评分参考】每点2分，答出任意三点即可得满分。意思对即可。`,
      analysis: `本题要求分析文章的构思特点，需要从结构线索、视角转换、内容展开、主旨深化等角度进行分析。"麦子喊了我一声"作为文眼，既是叙事线索，也是情感触发点和主题升华点。`,
      score: 6,
      correctRate: 0.55,
    },
    {
      content: `文章第④段写出了"那棵麦子"的哪些特点？有何用意？`,
      questionType: "text",
      options: [],
      answer: `答案要点：
特点：
①孤独：生长在麦田最边缘，无法与麦田中央的伙伴形成共鸣，在麦浪涌动时只能"望洋兴叹"。
②顽强：虽然被遗落在边缘，但同样顶起了一把饱满而丰盈的麦穗。
③脆弱无助：被麻雀踩踏时，既没有毒刺防身，也没能长成凛然不可犯的孤松，只能默默承受。

用意：
①与"我"形成对照：这棵麦子孤独、边缘的处境，正是"我"——一个从农村走进城市、在城市中感到"扎根太浅"的普通人的写照。
②为下文作铺垫：引出"麦子喊了我一声"，促使"我"由宏大的航拍视角转向对个体生命的关注。
③深化主题：一棵边缘麦子的坚韧与无奈，折射出千千万万普通人在时代洪流中奋力生存的生命状态。
【评分参考】特点3分，每点1分；用意3分，每点1分。意思对即可。`,
      analysis: `本题要求分析第④段中麦子的形象特点及其在全文中的作用。这棵麦子具有象征意义，既是现实中具体的麦子，也是"我"及无数普通人的隐喻。答题时需结合文本具体分析，不可脱离原文空谈。`,
      score: 6,
      correctRate: 0.52,
    },
  ];

  for (let i = 0; i < readingQuestions.length; i++) {
    const q = readingQuestions[i];
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
        category: "语文阅读",
        grade: "高三",
        tags: ["语文阅读", "语文", "高三", "练习", "散文", "杜永利"],
      },
    });

    await prisma.groupItem.create({
      data: {
        groupId: readingGroup.id,
        questionId: question.id,
        orderIndex: i,
      },
    });

    console.log(`创建了语文阅读（散文）第${i + 1}题`);
  }

  console.log("语文阅读（散文）题组数据创建完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });