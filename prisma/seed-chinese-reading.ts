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

const chineseReadingArticle = `### 材料一

拥堵的早高峰，打辆“空中的士”去上班；饥肠辘辘的中午，叫架无人机来送餐……曾在科幻电影中看到的场景正随低空经济的发展一步步走进现实。

低空经济是指以低空空域为依托，以各种有人驾驶和无人驾驶航空器的低空飞行活动为牵引，辐射带动相关领域融合发展的综合性经济形态。低空空域是指1000米高度以下，根据需要可延伸至3000米高度的空域。低空飞行活动不仅涵盖低空空域内的传统通用航空活动（泛指除军事飞行和公共航空运输以外的民用航空活动），还包括新兴的无人机、eVTOL（电动垂直起降飞行器）等的飞行活动。低空经济连接了“天”与“地”，涉及数量众多的地面制造、保障与服务业态，具有极强的产业带动能力。

低空空域和土地、海洋一样，是一种自然资源。我国地域辽阔，低空资源丰富，这种自然资源一旦转化为经济资源，人类的活动范围就由“平面”转向“立体”，人类活动的效率可以实现指数级增长。经济学中的资源配置理论强调，通过市场机制和政策手段，实现资源的最优配置，以创造更大的经济价值和社会价值，使社会福利最大化。而低空飞行活动与各相关产业的联合发展，可实现资源的高效整合与配置，使低空空域拥有巨大的经济价值，从而服务于广大民众的生活。

当低空与经济相遇，低空资源得到充分释放，这为经济发展带来新的机遇与活力。首先，低空经济塑造发展新动能。低空经济与信息通信、交通物流、文化旅游等业态相融合，可拓展出“低空＋物流”“低空＋巡检”“低空＋文旅“等各类应用场景，激活新型消费潜力，形成新的经济增长点。其次，低空经济加速相关技术突破。低空飞行活动的强烈需求，刺激以eVTOL为代表的新型低空飞行器技术升级，同时促进人工智能、卫星互联网等信息技术融合转化，形成空天地一体化低空智联网。此外，低空经济带动产业经济结构转型升级，推动现有产业走向智能化、绿色化。

2024年，中央经济工作会议把低空经济作为“新增长引擎”写入政府工作报告。我国在无人机应用技术、导航与控制技术、电动能源技术等方面已经具备核心竞争力。强力的政策支持和坚实的技术基础，使低空经济蓬勃发展成为可能。

<RightAlign>（取材于周钰哲、沈海军等的相关文章）</RightAlign>

### 材料二

低空经济开启了万亿级市场的新赛道，各地纷纷抢抓产业机遇，竞逐“天空之城”。不过，受产业链长、区域发展不平衡等因素制约，低空经济发展之路还面临诸多的堵点与痛点。

低空经济的产业链包括上游、中游和下游。上游主要是原材料与核心零部件，包括航空材料、芯片以及电池等的研发与制造；中游主要是航空器，包括无人机、eVTOL以及各类配套设施的研发与制造；下游聚焦于产业融合，即如何将中游生产的产品服务应用于各个场景中。低空经济产业链涵盖低空制造产业、低空飞行产业、低空保障产业和综合服务产业四大板块。在产业链的牵引下，各板块资源相互作用，形成有机系统，共同构建出良好的产业生态，才能使低空经济健康发展。

构建低空经济产业生态的最大挑战是如何实现关键要素的共同演化。低空空域作为基础资源，为航空器技术创新以及新场景探索提供了充足的物理空间。空域的精细化管理和适度开放，可吸引更多企业进行新产品试飞，从而进一步促使企业主动创造新场景。以低空飞行器技术为代表的低空技术是低空经济发展的重要驱动力。低空技术的不断突破可以带动低空经济场景的拓展，还可以为低空空域的管理提供新思路。低空经济场景是低空领域新技术、新载运装备、新商业模式实际应用的具体情境或环境，是发展低空经济的根本与落脚点。新技术在实际的场景应用中实现迭代优化，才能带动产业链上下游的发展。

当下，很多城市直面挑战，积极探索构建低空经济产业生态的良策。深圳市在核心零部件和整机制造上实力强劲，还拥有大疆、丰翼科技等领军企业和1700多家低空经济链上企业，因此，深圳以技术创新为引领，开发、改进适应各种场景的低空飞行器，并研发出智能融合低空系统以提升低空空域的管理效率和服务水平。合肥以场景应用为引领，专门设立了场景公司，在骆岗公园开通国内首个全空间无人体系示范应用场景，以场景来倒逼技术创新，并积累空域管理经验。而北京、上海、杭州等15座城市则宣布携手共建低空经济生态圈。

低空经济竞争就是低空经济产业生态竞争。各地需要根据产业优势和自身禀赋找到自己的生态位，形成错位发展。地区间需要加强协同互动、资源共享。这样才能向“天上一张网，地上一盘棋”的产业协同生态迈进。

<RightAlign>（取材于欧阳桃花、孟培军等的相关文章）</RightAlign>`;

async function main() {
  console.log("清理旧语文阅读数据...");

  const cnReadingGroups = await prisma.questionGroup.findMany({
    where: { questionType: "chinese-reading" },
    select: { id: true },
  });
  const cnReadingGroupIds = cnReadingGroups.map((g) => g.id);

  const cnReadingQuestions = await prisma.question.findMany({
    where: { category: "语文阅读" },
    select: { id: true },
  });
  const cnReadingQuestionIds = cnReadingQuestions.map((q) => q.id);

  if (cnReadingGroupIds.length > 0) {
    await prisma.groupItem.deleteMany({ where: { groupId: { in: cnReadingGroupIds } } });
    await prisma.questionGroupSubmission.deleteMany({ where: { questionGroupId: { in: cnReadingGroupIds } } });
    await prisma.questionGroup.deleteMany({ where: { id: { in: cnReadingGroupIds } } });
    console.log(`删除了 ${cnReadingGroupIds.length} 个语文阅读题组`);
  }

  if (cnReadingQuestionIds.length > 0) {
    await prisma.questionSubmission.deleteMany({ where: { questionId: { in: cnReadingQuestionIds } } });
    await prisma.question.deleteMany({ where: { id: { in: cnReadingQuestionIds } } });
    console.log(`删除了 ${cnReadingQuestionIds.length} 个语文阅读题`);
  }

  console.log("开始创建语文阅读题组数据...");

  const chineseReadingGroup = await prisma.questionGroup.create({
    data: {
      title: "语文阅读练习 - 低空经济",
      content: chineseReadingArticle,
      questionType: "chinese-reading",
      score: 18,
      subject: "语文",
      source: "练习题",
      category: "语文阅读",
      grade: "高三",
      tags: ["语文阅读", "语文", "高三", "练习", "低空经济"],
    },
  });

  console.log(`创建了语文阅读题组: ${chineseReadingGroup.title}`);

  const chineseReadingQuestions = [
    {
      content: `根据材料一，下列属于低空经济的一项是`,
      questionType: "single",
      options: [
        { id: "A", label: `“挑山工”机械狗登泰山运输货物，降低运输成本。` },
        { id: "B", label: `国产大飞机C919陆续交付，带动相关产业的发展。` },
        { id: "C", label: `电力公司使用无人机巡查输电线路，提升巡查效率。` },
        { id: "D", label: `神舟飞船携带数万颗种子飞入太空，助力太空育种。` },
      ],
      answer: "C",
      analysis: `根据材料一，低空经济是指以低空空域（1000米高度以下）为依托的飞行活动。A项机械狗属于地面活动；B项大飞机C919属于公共航空运输；D项神舟飞船属于太空活动，远超低空空域范围。只有C项无人机巡查输电线路属于低空空域内的无人机飞行活动，符合低空经济的定义。`,
      score: 3,
      correctRate: 0.75,
    },
    {
      content: `下列对材料一第三段内容的概括，最恰当的一项是`,
      questionType: "single",
      options: [
        { id: "A", label: `我国低空空域和土地、海洋一样是自然资源。` },
        { id: "B", label: `低空资源可转化为经济资源并拥有经济价值。` },
        { id: "C", label: `资源配置理论在低空经济中得到广泛的应用。` },
        { id: "D", label: `低空飞行活动可服务于广大民众的日常生活。` },
      ],
      answer: "B",
      analysis: `材料一第三段的核心论述逻辑是：低空空域是自然资源→这种资源可转化为经济资源→通过资源配置理论实现最优配置→低空空域拥有巨大经济价值。A项只是段首的引入；C项“广泛应用”在文中未体现；D项是段尾的延伸结果。B项最准确地概括了全段的核心内容。`,
      score: 3,
      correctRate: 0.68,
    },
    {
      content: `根据材料二，下列理解与推断，不正确的一项是`,
      questionType: "single",
      options: [
        { id: "A", label: `离开产业链的牵引，低空经济产业四大板块资源将无法发挥作用。` },
        { id: "B", label: `产业链上游与中游实力强劲是深圳打造“天空之城”的优势之一。` },
        { id: "C", label: `低空经济产业链长，使得各地在产业竞争中的错位发展成为可能。` },
        { id: "D", label: `构建产业协同生态有利于解决低空经济区域间发展不平衡的问题。` },
      ],
      answer: "A",
      analysis: `材料二原文为“在产业链的牵引下，各板块资源相互作用，形成有机系统”，这只说明产业链对各板块的牵引作用，并未说离开产业链四大板块资源就“无法发挥作用”。A项表述过于绝对。B项对应深圳“核心零部件和整机制造上实力强劲”；C项对应“各地需要根据产业优势和自身禀赋找到自己的生态位，形成错位发展”；D项对应“向'天上一张网，地上一盘棋'的产业协同生态迈进”。`,
      score: 3,
      correctRate: 0.62,
    },
    {
      content: `对材料一和材料二相关内容的分析和评价，下列表述不正确的一项是`,
      questionType: "single",
      options: [
        { id: "A", label: `材料一中“低空经济带动产业经济结构转型升级”，表明低空经济可促进经济高质量发展。` },
        { id: "B", label: `材料二中“合肥以场景应用为引领”，可印证材料一“低空经济塑造发展新动能”` },
        { id: "C", label: `材料二中15座城市宣布携手共建的事实，说明一座城市不能建立完整的低空经济生态圈。` },
        { id: "D", label: `材料一探讨了何为低空经济及其为何能发展，材料二则探讨了如何让低空经济健康发展。` },
      ],
      answer: "C",
      analysis: `材料二中15座城市携手共建低空经济生态圈，体现的是区域协同发展的理念，但不能由此推出“一座城市不能建立完整的低空经济生态圈”。事实上，深圳、合肥等城市都在各自探索构建产业生态。C项属于过度推断，逻辑上不成立。A、B、D三项均正确反映了材料内容。`,
      score: 3,
      correctRate: 0.58,
    },
    {
      content: `根据以上材料内容，在第一小题横线处填写恰当内容，并按要求回答第二小题。（6分）

（1）构建低空经济产业生态的关键要素包括低空空域、<Input2/> 和 <Input2/>。（2分）

（2）请从低空经济产业生态关键要素共同演化的角度，结合链接材料的相关内容，为延庆区低空经济发展提出建议。（4分）

【链接材料】
延庆区有中国民航局首批、北京市唯一的“民用无人驾驶航空试验区”，有374 平方公里的独立空域。延庆还拥有八达岭长城、龙庆峡、野鸭湖湿地公园等丰富的文旅资源。延庆低空经济产业园已经集聚无人机企业近百家，各企业正不断加强技术攻关，力争到2026年，提升无人机自主创新能力，突破关键核心技术。`,
      questionType: "text",
      options: [],
      answer: `
（1）（2分）
参考答案：①低空技术  ②低空经济场景
（2）（4分）
答案示例一：
延庆低空经济发展应依托低空空域资源优势，不断加强对空域的精细化管理（1分），吸引更多的企业进行无人机的研发、试飞，从而实现关键核心技术的突破（1分）；延庆还应凭借丰富的文旅资源，积极拓展“低空＋巡检”“低空＋文旅”等应用场景（1分），并在场景应用中不断积累、完善空域管理经验（1分）。
答案示例二：
延庆低空经济发展应以空域管理、规划为引领，带动技术、场景的发展（1分）。依托空域资源优势，延庆可吸引更多的无人机企业进行产品研发、试飞，从而实现关键核心技术的突破（1分），并拓展出“低空＋巡检”“低空＋文旅”等应用场景（1分）。技术突破、场景拓展也必将为航空试验区积累空域管理与服务经验（1分）。
【评分参考】（1）每空1分。（2）共4分。每点1分，意思对即可。如从延庆区与其他区或其他城市优势互补、错位发展的角度来谈，可依据答案具体情况酌情给分。`,
      analysis: `本题要求从低空经济产业生态关键要素（低空空域、低空技术、低空经济场景）共同演化的角度提出建议。需要结合延庆区的具体条件（独立空域、文旅资源、近百家无人机企业），分别从空域资源利用、技术创新驱动、场景应用牵引三个维度，阐述三者如何相互促进、共同演化。`,
      score: 6,
      correctRate: 0.55,
    },
  ];

  for (let i = 0; i < chineseReadingQuestions.length; i++) {
    const q = chineseReadingQuestions[i];
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
        tags: ["语文阅读", "语文", "高三", "练习", "低空经济"],
      },
    });

    await prisma.groupItem.create({
      data: {
        groupId: chineseReadingGroup.id,
        questionId: question.id,
        orderIndex: i,
      },
    });

    console.log(`创建了语文阅读第${i + 1}题`);
  }

  console.log("语文阅读题组数据创建完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });