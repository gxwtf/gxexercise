import { prisma } from "@/lib/prisma";
import { routeToSubject, routeToCategory } from "@/constants/subjects";
import { QuestionOverview } from "@/components/QuestionOverview";

interface PageProps {
  params: Promise<{
    subject: string;
    category: string;
  }>;
}

export default async function SubjectCategoryPage({ params }: PageProps) {
  const { subject, category } = await params;
  const subjectName = routeToSubject[subject] || subject;
  const categoryName = routeToCategory[category] || category;

  const isTestPaperCategory = categoryName === '套卷';

  // 查询 QuestionGroup：只取列表需要的字段（正文截断为预览），
  // 避免把整篇文章和每道题的正文/选项/解析塞进 RSC 负载
  const groupsRaw = isTestPaperCategory ? [] : await prisma.questionGroup.findMany({
    where: {
      subject: subjectName,
      category: categoryName,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      questionType: true,
      score: true,
      subject: true,
      source: true,
      grade: true,
      category: true,
      tags: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
      groupItems: {
        orderBy: { orderIndex: "asc" },
        select: { question: { select: { year: true, grade: true } } },
      },
    },
  });

  // 列表只需要每组的年份/年级集合做筛选，groupItems 明细不下发（RSC 负载再降一个数量级）
  const groups = groupsRaw.map(({ groupItems, ...g }) => {
    const years = Array.from(
      new Set(groupItems.map((gi) => gi.question.year).filter((y): y is number => y != null))
    ).sort((a, b) => b - a);
    const grades = Array.from(
      new Set([g.grade, ...groupItems.map((gi) => gi.question.grade)].filter((x): x is string => !!x))
    );
    return { ...g, content: (g.content || "").slice(0, 240), years, grades };
  });

  const papers = await prisma.testPaper.findMany({
    where: {
      subject: subjectName,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      subject: true,
      source: true,
      year: true,
      grade: true,
      totalScore: true,
      duration: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { paperItems: true } },
    },
  });

  return (
    <QuestionOverview
      initialGroups={groups}
      initialTestPapers={papers}
      subject={subjectName}
      category={categoryName}
    />
  );
}