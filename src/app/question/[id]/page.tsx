import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { serialize } from 'next-mdx-remote/serialize';
import Cloze from "@/components/question-group/cloze";
import Grammar from "@/components/question-group/grammar";
import EnReading from "@/components/question-group/en-reading";
import SevenChooseFive from "@/components/question-group/seven-choose-five";
import ReadingExpression from "@/components/question-group/reading-expression";
import EnWriting from "@/components/question-group/en-writing";
import QuestionGroupHeader from "@/components/question-group/QuestionGroupHeader";
import { AnswerProvider } from "@/components/question-group/AnswerContext";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

async function QuestionPageContent({ id }: { id: string }) {
  const questionGroup = await prisma.questionGroup.findUnique({
    where: { id },
    include: {
      groupItems: {
        include: {
          question: true
        },
        orderBy: { orderIndex: 'asc' }
      }
    }
  });

  if (!questionGroup) {
    notFound();
  }

  const questions = await Promise.all(questionGroup.groupItems.map(async (item: any) => {
    const stemMdx = item.question.content ? await serialize(item.question.content) : null;
    
    if (item.question.questionType === 'input') {
      return {
        id: item.question.id,
        stem: item.question.content,
        stemMdx,
        type: 'input' as const,
        answer: item.question.answer || '',
        subStem: item.question.subContent || ''
      };
    } else {
      return {
        id: item.question.id,
        stem: item.question.content,
        stemMdx,
        type: 'single' as const,
        options: item.question.options || []
      };
    }
  }));

  if (questionGroup.questionType === 'cloze') {
    const mdxSource = await serialize(questionGroup.content || '');
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <Cloze 
          questions={questions as any} 
          mdxSource={mdxSource}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'grammar') {
    const mdxSource = await serialize(questionGroup.content || '');
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <Grammar 
          questions={questions as any} 
          mdxSource={mdxSource}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'en-reading') {
    const mdxSource = await serialize(questionGroup.content || '');
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <EnReading 
          questions={questions as any} 
          mdxSource={mdxSource}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'seven-choose-five') {
    const mdxSource = await serialize(questionGroup.content || '');
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <SevenChooseFive 
          questions={questions as any} 
          mdxSource={mdxSource}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'reading-expression') {
    const mdxSource = await serialize(questionGroup.content || '');
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <ReadingExpression 
          questions={questions as any} 
          mdxSource={mdxSource}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'en-writing') {
    const mdxSource = await serialize(questionGroup.content || '');
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <EnWriting 
          mdxSource={mdxSource}
        />
      </>
    );
  }

  return (
    <div className="p-8">
      <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
      <div className="mt-8">
        <h1 className="text-2xl font-bold mb-4">题组: {questionGroup.title}</h1>
        <p>题型: {questionGroup.questionType}</p>
        <p>暂不支持的题型</p>
      </div>
    </div>
  );
}

export default async function QuestionPage({ params }: PageProps) {
  const { id } = await params;
  
  return (
    <AnswerProvider>
      <QuestionPageContent id={id} />
    </AnswerProvider>
  );
}