import { prisma } from "@/lib/prisma";
import { QuestionOverview } from "@/components/QuestionOverview";

export default async function QuestionsPage() {
  const questions = await prisma.question.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <QuestionOverview initialQuestions={questions} />;
}