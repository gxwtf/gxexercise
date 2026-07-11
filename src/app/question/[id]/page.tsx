import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { serialize } from 'next-mdx-remote/serialize';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import Grammar, { type GrammarQuestion } from "@/components/question-group/grammar";
import SevenChooseFive, { type SevenChooseFiveQuestion } from "@/components/question-group/seven-choose-five";
import Problem from "@/components/question-group/Problem";
import QuestionGroupHeader from "@/components/question-group/QuestionGroupHeader";

type QuestionOption = {
  id: string;
  label: string;
};

function parseQuestionOptions(value: unknown): QuestionOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((option) => {
    if (!option || typeof option !== "object" || Array.isArray(option)) {
      return [];
    }

    const { id, label } = option as Record<string, unknown>;
    if ((typeof id !== "string" && typeof id !== "number") || typeof label !== "string") {
      return [];
    }

    return [{ id: String(id), label }];
  });
}

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
    select: {
      title: true,
      content: true,
      options: true,
      questionType: true,
      groupItems: {
        select: {
          question: {
            select: {
              id: true,
              content: true,
              subContent: true,
              questionType: true,
              options: true,
            },
          },
        },
        orderBy: { orderIndex: 'asc' }
      }
    }
  });

  if (!questionGroup) {
    notFound();
  }

  const serializeOptions = async (options: QuestionOption[]) => Promise.all(
    options.map(async (opt) => {
      try {
        const escaped = escapeLatexBraces(opt.label);
        const labelMdx = await serialize(escaped, { mdxOptions });
        return { ...opt, labelMdx };
      } catch {
        return { ...opt, labelMdx: null };
      }
    })
  );

  const groupOptions = await serializeOptions(parseQuestionOptions(questionGroup.options));

  const questions = await Promise.all(questionGroup.groupItems.map(async (item) => {
    let stemMdx = null;
    if (item.question.content) {
      try {
        const escaped = escapeLatexBraces(item.question.content);
        stemMdx = await serialize(escaped, { mdxOptions });
      } catch {
        stemMdx = null;
      }
    }

    const optionsWithMdx = await serializeOptions(parseQuestionOptions(item.question.options));
    
    if (item.question.questionType === 'input') {
      return {
        id: item.question.id,
        stem: item.question.content,
        stemMdx,
        type: 'input' as const,
        subStem: item.question.subContent || ''
      };
    } else if (item.question.questionType === 'text') {
      return {
        id: item.question.id,
        stem: item.question.content,
        stemMdx,
        type: 'text' as const,
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
        <Problem
          questions={questions}
          mdxSource={mdxSource}
          language="en"
          indentParagraphs={false}
          startQuestionNumber={1}
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
          questions={questions as GrammarQuestion[]}
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
          questions={questions as GrammarQuestion[]}
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
        <Problem
          questions={questions}
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
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <SevenChooseFive
          questions={questions as SevenChooseFiveQuestion[]}
          mdxSource={mdxSource}
          groupOptions={groupOptions}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'reading-expression') {
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <Problem
          questions={questions}
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
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <Problem
          questions={questions}
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
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <Problem
          questions={questions}
          language="zh"
          showWordCount
        />
      </>
    );
  }

  if (questionGroup.questionType === 'chinese-essay') {
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <Problem
          questions={questions}
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
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <Problem
          questions={questions}
          language="zh"
        />
      </>
    );
  }

  if (questionGroup.questionType === 'math-choice') {
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <Problem
          questions={questions}
          language="zh"
        />
      </>
    );
  }

  if (questionGroup.questionType === 'chinese-reading') {
    const mdxSource = await serialize(questionGroup.content || '', { mdxOptions });
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} />
        <Problem
          questions={questions}
          mdxSource={mdxSource}
          language="zh"
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
