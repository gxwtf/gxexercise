import { prisma } from "@/lib/prisma";
import { routeToSubject } from "@/constants/subjects";
import { QuestionOverview } from "@/components/QuestionOverview";
import { transformQuestions } from "@/lib/transformers";

interface PageProps {
  params: Promise<{
    subject: string;
  }>;
}

export default async function SubjectPage({ params }: PageProps) {
  const { subject } = await params;
  const subjectName = routeToSubject[subject] || subject;

  const questions = transformQuestions(
    await prisma.question.findMany({
      where: {
        subject: subjectName,
        showOnHomepage: true,
      },
      orderBy: { createdAt: "desc" },
    })
  );

  const groups = await prisma.questionGroup.findMany({
    where: {
      subject: subjectName,
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
      initialGroups={groups}
      initialPapers={papers}
      subject={subjectName}
    />
  );
}
