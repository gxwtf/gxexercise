import { prisma } from "@/lib/prisma";
import { routeToSubject } from "@/constants/subjects";
import { routeToQuestionType, QuestionType } from "@/constants/questionTypes";
import { QuestionOverview } from "@/components/QuestionOverview";

interface PageProps {
  params: Promise<{
    subject: string;
  }>;
}

export default async function SubjectCategoryPage({ params }: PageProps) {
  const { subject } = await params;
  const subjectName = routeToSubject[subject] || subject;

  const questions = await prisma.question.findMany({
    where: {
      subject: subjectName,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <QuestionOverview
      initialQuestions={questions}
      subject={subjectName}
    />
  );
}