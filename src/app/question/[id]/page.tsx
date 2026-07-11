import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { serialize } from 'next-mdx-remote/serialize';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import Cloze from "@/components/question-group/cloze";
import Grammar from "@/components/question-group/grammar";
import EnReading from "@/components/question-group/en-reading";
import SevenChooseFive from "@/components/question-group/seven-choose-five";
import ReadingExpression from "@/components/question-group/reading-expression";
import EnWriting from "@/components/question-group/en-writing";
import MathFill from "@/components/question-group/math-fill";
import MathChoice from "@/components/question-group/math-choice";
import ChineseReading from "@/components/question-group/chinese-reading";
import MicroWriting from "@/components/question-group/chinese-micro-writing";
import Essay from "@/components/question-group/chinese-essay";
import QuestionGroupHeader from "@/components/question-group/QuestionGroupHeader";

function escapeLatexBraces(content: string): string {
  let result = ''
  let inTag = 0
  let inMath = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (ch === '$' && inTag === 0) {
      inMath = !inMath
      result += ch
    } else if (ch === '<') {
      inTag++
      result += ch
    } else if (ch === '>') {
      inTag = Math.max(0, inTag - 1)
      result += ch
    } else if (ch === '{' && inTag === 0 && !inMath) {
      result += '\\{'
    } else if (ch === '}' && inTag === 0 && !inMath) {
      result += '\\}'
    } else {
      result += ch
    }
  }
  return result
}
import { AnswerProvider } from "@/components/question-group/AnswerContext";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

async function QuestionPageContent({ id }: { id: string }) {
  const mdxOptions = {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [rehypeKatex],
  };

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
    let stemMdx = null;
    if (item.question.content) {
      try {
        const escaped = escapeLatexBraces(item.question.content);
        stemMdx = await serialize(escaped, { mdxOptions });
      } catch {
        stemMdx = null;
      }
    }

    const options = (item.question.options || []) as Array<{ id: string; label: string }>;
    const optionsWithMdx = await Promise.all(
      options.map(async (opt: { id: string; label: string }) => {
        try {
          const escaped = escapeLatexBraces(opt.label);
          const labelMdx = await serialize(escaped, { mdxOptions });
          return { ...opt, labelMdx };
        } catch {
          return { ...opt, labelMdx: null };
        }
      })
    );
    
    if (item.question.questionType === 'input') {
      return {
        id: item.question.id,
        stem: item.question.content,
        stemMdx,
        type: 'input' as const,
        answer: item.question.answer || '',
        subStem: item.question.subContent || ''
      };
    } else if (item.question.questionType === 'text') {
      return {
        id: item.question.id,
        stem: item.question.content,
        stemMdx,
        type: 'text' as const,
        answer: item.question.answer || '',
        subStem: item.question.subContent || ''
      };
    } else if (item.question.questionType === 'multiple') {
      return {
        id: item.question.id,
        stem: item.question.content,
        stemMdx,
        type: 'multiple' as const,
        options: optionsWithMdx
      };
    } else {
      return {
        id: item.question.id,
        stem: item.question.content,
        stemMdx,
        type: 'single' as const,
        options: optionsWithMdx
      };
    }
  }));

  if (questionGroup.questionType === 'cloze') {
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
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
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
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

  if (questionGroup.questionType === 'chinese-dictation') {
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
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
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
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
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
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
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
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
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <EnWriting 
          questions={questions as any}
          mdxSource={mdxSource}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'chinese-micro-writing') {
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <MicroWriting 
          questions={questions as any}
          mdxSource={mdxSource}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'chinese-essay') {
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <Essay 
          questions={questions as any}
          mdxSource={mdxSource}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'math-fill') {
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <MathFill 
          questions={questions as any}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'math-choice') {
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <MathChoice 
          questions={questions as any}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'chinese-reading') {
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <ChineseReading 
          questions={questions as any} 
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