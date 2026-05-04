import { prisma } from "@/lib/prisma";
import { QuestionOverview } from "@/components/QuestionOverview";
import { transformQuestions } from "@/lib/transformers";

export default async function QuestionsPage() {
  const questions = transformQuestions(
    await prisma.question.findMany({
      where: {
        showOnHomepage: true,
      },
      orderBy: { createdAt: "desc" },
    })
  );

  const groups = await prisma.questionGroup.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      groupItems: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  const papers = await prisma.testPaper.findMany({
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
      initialGroups={groups}
      initialPapers={papers}
    />
  );
}
