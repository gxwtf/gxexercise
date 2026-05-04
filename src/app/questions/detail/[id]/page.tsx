import { prisma } from "@/lib/prisma";
import { QuestionOverview } from "@/components/QuestionOverview";
import { notFound } from "next/navigation";
import { transformQuestion } from "@/lib/transformers";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function QuestionDetailPage({ params }: PageProps) {
  const { id } = await params;

  const question = await prisma.question.findUnique({
    where: { id },
  });

  if (!question) {
    notFound();
  }

  return <QuestionOverview initialQuestions={[transformQuestion(question)]} />;
}
