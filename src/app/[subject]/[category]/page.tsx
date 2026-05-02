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

  const questions = await prisma.question.findMany({
    where: {
      subject: subjectName,
      category: categoryName,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <QuestionOverview
      initialQuestions={questions}
      subject={subjectName}
      category={categoryName}
    />
  );
}