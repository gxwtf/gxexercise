import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/iron";
import { serialize } from 'next-mdx-remote/serialize';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import Grammar from "@/components/question-group/grammar";
import SevenChooseFive from "@/components/question-group/seven-choose-five";
import Problem from "@/components/question-group/Problem";
import QuestionGroupHeader from "@/components/question-group/QuestionGroupHeader";
import { QuestionSection } from "@/components/QuestionSection";

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
    
    if (item.question.questionType === 'input' || item.question.questionType === 'input2') {
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
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Problem
          questions={questions as any} 
          mdxSource={mdxSource}
          language="en"
          indentParagraphs
          startQuestionNumber={1}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'grammar') {
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Grammar 
          questions={questions as any} 
          mdxSource={mdxSource}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'word-choice') {
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        {questionGroup.content && (
          <div className="max-w-4xl mx-auto px-6 mt-4">
            <QuestionSection>
              <div className="border-1 border-black p-4 text-lg">
                {questionGroup.content}
              </div>
            </QuestionSection>
          </div>
        )}
        <Problem
          questions={questions as any}
          language="en"
        />
      </>
    );
  }

  if (questionGroup.questionType === 'chinese-dictation') {
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
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
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Problem
          questions={questions as any} 
          mdxSource={mdxSource}
          language="en"
        />
      </>
    );
  }

  if (questionGroup.questionType === 'seven-choose-five') {
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
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
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Problem
          questions={questions as any} 
          mdxSource={mdxSource}
          language="en"
          minHeight="min-h-20"
        />
      </>
    );
  }

  if (questionGroup.questionType === 'en-writing') {
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Problem
          questions={questions as any}
          language="en"
          minHeight="min-h-64"
          showWordCount
        />
      </>
    );
  }

  if (questionGroup.questionType === 'chinese-micro-writing') {
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Problem
          questions={questions as any}
          language="zh"
          showWordCount
        />
      </>
    );
  }

  if (questionGroup.questionType === 'chinese-essay') {
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Problem
          questions={questions as any}
          language="zh"
          minHeight="min-h-64"
          showWordCount
        />
      </>
    );
  }

  if (questionGroup.questionType === 'math-fill') {
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Problem
          questions={questions as any}
          language="zh"
        />
      </>
    );
  }

  if (questionGroup.questionType === 'math-choice') {
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Problem
          questions={questions as any}
          language="zh"
        />
      </>
    );
  }

  if (questionGroup.questionType === 'chinese-reading') {
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Problem
          questions={questions as any} 
          mdxSource={mdxSource}
          language="zh"
        />
      </>
    );
  }

  return (
    <div className="p-8">
      <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
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

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userid) {
    redirect(`/login?back=/question/${id}`);
  }
  
  return (
    <AnswerProvider>
      <div className="h-screen flex flex-col overflow-y-auto">
        <QuestionPageContent id={id} />
      </div>
    </AnswerProvider>
  );
}