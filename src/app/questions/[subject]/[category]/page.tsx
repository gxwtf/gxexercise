import { prisma } from "@/lib/prisma";
import { categoryForSubjectRoute, routeToSubject } from "@/constants/subjects";
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
  const categoryName = categoryForSubjectRoute(subjectName, category);

  const isTestPaperCategory = categoryName === '套卷';

  // 普通科目入口展示该科目的全部题组；套卷入口只展示试卷。
  const groups = isTestPaperCategory ? [] : await prisma.questionGroup.findMany({
    where: {
      subject: subjectName,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      questionType: true,
      subject: true,
      source: true,
      grade: true,
      category: true,
      tags: true,
      imageUrl: true,
      groupItems: {
        orderBy: { orderIndex: "asc" },
        select: {
          question: {
            select: {
              year: true,
              grade: true,
            },
          },
        },
      },
    },
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
      tags: true,
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
