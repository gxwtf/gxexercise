import { prisma } from "@/lib/prisma";
import { routeToSubject, routeToCategory } from "@/constants/subjects";
import { QuestionOverview } from "@/components/QuestionOverview";
import { transformQuestions } from "@/lib/transformers";

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

  const questions = transformQuestions(
    await prisma.question.findMany({
      where: {
        subject: subjectName,
        category: categoryName,
        showOnHomepage: true,
      },
      orderBy: { createdAt: "desc" },
    })
  );

  const groups = isTestPaperCategory ? [] : await prisma.questionGroup.findMany({
    where: {
      subject: subjectName,
      category: categoryName,
    },
    orderBy: { createdAt: "desc" },
    include: {
      groupItems: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  const papers = await prisma.testPaper.findMany({
    where: {
      subject: subjectName,
    },
    orderBy: { createdAt: "desc" },
    include: {
      paperItems: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  return (
    <QuestionOverview
      initialQuestions={questions}
      initialTestPapers={papers}
      subject={subjectName}
      category={categoryName}
    />
  );
}