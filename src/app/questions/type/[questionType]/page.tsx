import { prisma } from "@/lib/prisma";
import { routeToQuestionType, QuestionType } from "@/constants/questionTypes";
import { QuestionOverview } from "@/components/QuestionOverview";
import { transformQuestions } from "@/lib/transformers";

interface PageProps {
  params: Promise<{
    questionType: string;
  }>;
}

export default async function QuestionTypePage({ params }: PageProps) {
  const { questionType } = await params;
  const type = routeToQuestionType[questionType];

  const questions = transformQuestions(
    await prisma.question.findMany({
      where: type ? { questionType: type } : undefined,
      orderBy: { createdAt: "desc" },
    })
  );

  return <QuestionOverview initialQuestions={questions} questionType={type} />;
}
