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

async function main() {
  console.log("开始创建数学填空题和选择题数据...");

  // ==========================================
  // 数学填空题组
  // ==========================================
  const mathFillGroup = await prisma.questionGroup.create({
    data: {
      title: "数学填空练习 - 函数与数列",
      content: "",
      questionType: "math-fill",
      score: 20,
      subject: "数学",
      source: "练习题",
      category: "数学填空",
      grade: "高三",
      tags: ["数学填空", "数学", "高三", "练习", "函数", "数列"],
    },
  });

  console.log(`创建了数学填空题组: ${mathFillGroup.title}`);

  const mathFillQuestions = [
    {
      content: "已知函数 $f(x)=\\frac{x}{x-1}, f(x)$ 的导函数为 $f^{\\prime}(x)$ ，则 $f^{\\prime}(2)=$ <Input2/>．",
      answer: "-1",
      analysis: "由 $f(x)=\\frac{x}{x-1}$ 得 $f^{\\prime}(x)=\\frac{(x-1)-x}{(x-1)^2}=\\frac{-1}{(x-1)^2}$，所以 $f^{\\prime}(2)=\\frac{-1}{(2-1)^2}=-1$。",
      score: 10,
      correctRate: 0.72,
      questionType: "input",
      options: [],
    },
    {
      content: "已知无穷数列 $\\left\\{a_n\\right\\}$ 满足 $a_1=m, a_n=a_{n-1}^3-3 a_{n-1}+k\\left(n \\geqslant 2, n \\in \\mathrm{~N}^*\\right)$ ，给出下列四个结论，其中所有正确结论的序号是：",
      answer: "①,②,③",
      analysis: "① 正确：当 $m=0$ 且 $k=0$ 时，$a_n=0$ 为等差数列。\n② 正确：当 $m$ 足够大时，$a_n^3$ 的增长速度使得数列递增。\n③ 正确：取 $k$ 为适当值，使得每项在 $(-\\sqrt{3},0)$ 区间内，可以保证每项小于 0 且互不相等。\n④ 错误：若 $a_n$ 为等比数列，设 $a_n=mq^{n-1}$，代入递推可得矛盾，故不存在。",
      score: 10,
      correctRate: 0.45,
      questionType: "multiple",
      options: [
        { id: "①", label: "对任意实数 m，存在实数 k，使得数列为等差数列" },
        { id: "②", label: "对任意实数 k，存在实数 m，使得数列为单调递增数列" },
        { id: "③", label: "对任意实数 k，存在实数 m，使得数列的每项都小于 0 且互不相等" },
        { id: "④", label: "不存在实数 m 和 k，使得数列为等比数列（公比 q ≠ 1）" },
      ],
    },
  ];

  for (const q of mathFillQuestions) {
    const question = await prisma.question.create({
      data: {
        content: q.content,
        questionType: q.questionType,
        options: q.options,
        answer: q.answer,
        analysis: q.analysis,
        score: q.score,
        correctRate: q.correctRate,
        subject: "数学",
        source: "练习题",
        category: "数学填空",
        grade: "高三",
        tags: ["数学填空", "数学", "高三"],
      },
    });

    await prisma.groupItem.create({
      data: {
        groupId: mathFillGroup.id,
        questionId: question.id,
        orderIndex: mathFillQuestions.indexOf(q),
      },
    });

    console.log(`创建了数学填空第${mathFillQuestions.indexOf(q) + 1}题`);
  }

  console.log("数学填空题组创建完成！");

  // ==========================================
  // 数学选择题组
  // ==========================================
  const mathChoiceGroup = await prisma.questionGroup.create({
    data: {
      title: "数学选择练习 - 数列与函数",
      content: "",
      questionType: "math-choice",
      score: 20,
      subject: "数学",
      source: "练习题",
      category: "数学选择",
      grade: "高三",
      tags: ["数学选择", "数学", "高三", "练习", "数列", "函数"],
    },
  });

  console.log(`创建了数学选择题组: ${mathChoiceGroup.title}`);

  const mathChoiceQuestions = [
    {
      content: "已知 $\\left\\{a_n\\right\\}$ 是无穷等差数列，＂存在正整数 $m$ ，使得 $a_m=0$＂是＂存在正整数 $t$ ，使得 $S_t=0$＂的",
      options: [
        { id: "A", label: "充分不必要条件" },
        { id: "B", label: "必要不充分条件" },
        { id: "C", label: "充分必要条件" },
        { id: "D", label: "既不充分也不必要条件" },
      ],
      answer: "A",
      analysis: "充分性：若存在正整数 $m$ 使得 $a_m=0$，设公差为 $d$，则 $a_1=-(m-1)d$，$S_t=ta_1+\\frac{t(t-1)}{2}d$。取 $t=2m-1$ 时，$S_t=0$。\n必要性：若存在正整数 $t$ 使得 $S_t=0$，取 $m=\\frac{t+1}{2}$（当 $t$ 为奇数时），$a_m=0$。但当 $t$ 为偶数时情况不同，所以必要性不成立。",
      score: 10,
      correctRate: 0.55,
    },
    {
      content: "若函数 $f(x)=\\left\\{\\begin{array}{l}a x^2+2 x, \\quad x\\lt 0, \\\\ \\mathrm{e}^x+(a-1) x, x \\geqslant 0\\end{array}\\right.$ 的值域为 $\\mathbf{R}$ ，则实数 $a$ 的取值范围是",
      options: [
        { id: "A", label: "$\\left(-\\infty, 1-\\mathrm{e}^2\\right]$" },
        { id: "B", label: "$\\left[1-\\mathrm{e}^2, 0\\right)$" },
        { id: "C", label: "$(-\\infty, 1-e]$" },
        { id: "D", label: "$[1-e, 0)$" },
      ],
      answer: "D",
      analysis: "当 $x\\lt 0$ 时，$f(x)=ax^2+2x$，其值域取决于 $a$。\n当 $x\\geqslant 0$ 时，$f(x)=e^x+(a-1)x$。\n为使值域为 $\\mathbf{R}$，需要左右两段相互补充覆盖所有实数。\n分析可知 $a\\in[1-e,0)$ 时满足条件。",
      score: 10,
      correctRate: 0.38,
    },
  ];

  for (const q of mathChoiceQuestions) {
    const question = await prisma.question.create({
      data: {
        content: q.content,
        questionType: "single",
        options: q.options,
        answer: q.answer,
        analysis: q.analysis,
        score: q.score,
        correctRate: q.correctRate,
        subject: "数学",
        source: "练习题",
        category: "数学选择",
        grade: "高三",
        tags: ["数学选择", "数学", "高三"],
      },
    });

    await prisma.groupItem.create({
      data: {
        groupId: mathChoiceGroup.id,
        questionId: question.id,
        orderIndex: mathChoiceQuestions.indexOf(q),
      },
    });

    console.log(`创建了数学选择第${mathChoiceQuestions.indexOf(q) + 1}题`);
  }

  console.log("数学选择题组创建完成！");
  console.log("所有数学题目数据创建完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });