import { prisma } from "@/lib/prisma";
import { normalizeQuestionMdx } from "@/lib/mdx-text"
import { trimSharedMaterialContents, usesSharedMaterial } from "@/lib/shared-material"
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
import Problem from "@/components/question-group/Problem"
import QuestionGroupHeader from "@/components/question-group/QuestionGroupHeader";
import { QuestionSection } from "@/components/QuestionSection";

function escapeLatexBraces(input: string): string {
  input = normalizeQuestionMdx(input)
  // <br> 必须自闭合（MDX 会报 "Expected a closing tag for <br>"，语文表格里常见）
  const content = input.replace(/<br\s*\/?>/gi, '<br />')
  let result = ''
  let inTag = 0
  let inMath = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (ch === '$' && inTag === 0) {
      inMath = !inMath
      result += ch
    } else if (ch === '<') {
      if (inMath) {
        result += ch // 公式里的 < 是关系符
      } else if (/^<\/?[A-Za-z][A-Za-z0-9-]*(\s[^<>]*)?\/?>/.test(content.slice(i))) {
        inTag++
        result += ch
      } else {
        result += '&lt;'
      }
    } else if (ch === '>') {
      if (inMath) {
        result += ch
      } else if (inTag > 0) {
        inTag = Math.max(0, inTag - 1)
        result += ch
      } else {
        result += '&gt;'
      }
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

  // 同材料选择题：整套练习时把后续题里重复的材料前缀裁掉（只影响显示，数据库不动）
  const displayStems = usesSharedMaterial(questionGroup.questionType)
    ? trimSharedMaterialContents(questionGroup.groupItems.map((item: any) => item.question.content))
    : questionGroup.groupItems.map((item: any) => item.question.content ?? "");

  const questions = await Promise.all(questionGroup.groupItems.map(async (item: any, qi: number) => {
    const displayStem: string = displayStems[qi] ?? (item.question.content ?? "");
    let stemMdx = null;
    if (displayStem) {
      try {
        const escaped = escapeLatexBraces(displayStem);
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
        stem: displayStem,
        stemMdx,
        type: 'input' as const,
        answer: item.question.answer || '',
        subStem: item.question.subContent || ''
      };
    } else if (item.question.questionType === 'text') {
      return {
        id: item.question.id,
        stem: displayStem,
        stemMdx,
        type: 'text' as const,
        answer: item.question.answer || '',
        subStem: item.question.subContent || ''
      };
    } else if (item.question.questionType === 'multiple') {
      return {
        id: item.question.id,
        stem: displayStem,
        stemMdx,
        type: 'multiple' as const,
        options: optionsWithMdx
      };
    } else {
      return {
        id: item.question.id,
        stem: displayStem,
        stemMdx,
        type: 'single' as const,
        options: optionsWithMdx
      };
    }
  }));

  // 题组正文（阅读材料）：为空时不给 MDX，前端就不会再画出空的「阅读区域」
  const contentMdx = (questionGroup.content || '').trim()
    ? await serialize(normalizeQuestionMdx(questionGroup.content), { mdxOptions })
    : null;

  if (questionGroup.questionType === 'cloze') {
    const mdxSource = contentMdx;
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
    const mdxSource = contentMdx;
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Grammar 
          questions={questions as any} 
          mdxSource={mdxSource!}
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
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-lg">
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
    const mdxSource = contentMdx;
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Grammar 
          questions={questions as any} 
          mdxSource={mdxSource!}
        />
      </>
    );
  }

  // 生物大题（材料内联填空，长句空用 <InputLong>）
  if (questionGroup.questionType === 'biology-fill') {
    const mdxSource = contentMdx;
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        {/* 生物材料不缩进（理科卷排版） */}
        <Grammar
          questions={questions as any}
          mdxSource={mdxSource!}
          indentParagraphs={false}
        />
      </>
    );
  }

  // 物理实验题（与生物完全同构：材料 + 内联 <Input>/<InputLong>，一个空一条单题，逐空 AI 判分）
  if (questionGroup.questionType === 'physics-fill') {
    const mdxSource = contentMdx;
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        {/* 理科卷材料不缩进（与生物一致） */}
        <Grammar
          questions={questions as any}
          mdxSource={mdxSource!}
          indentParagraphs={false}
        />
      </>
    );
  }

  // 数学解答题 / 物理计算题：一整道大题 = 一个题组 + 一条 text 单题，
  // 题面（LaTeX + 图）在单题的 stem 里，学生在一个多行文本框里写整题过程；
  // 这两类**不做 AI 批改**（没有批改提示词），提交后只留作答、回顾页给参考答案。
  if (questionGroup.questionType === 'math-solve' || questionGroup.questionType === 'physics-solve') {
    // 题号按原卷显示（组名形如「2026北京西城高三二模数学·第19题」），不要退化成「1.」
    const bigNo = Number((questionGroup.title.match(/第\s*(\d{1,3})\s*题/) || [])[1] || 0) || undefined
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Problem
          questions={questions as any}
          language="zh"
          startQuestionNumber={bigNo}
          minHeight="min-h-72"
          placeholder={questionGroup.questionType === 'math-solve'
            ? '请写出完整解答过程（可分步书写，换行不会被合并；需说明依据与结论）'
            : '请写出完整计算过程（先写所用公式，再代入数据并注明单位）'}
        />
      </>
    );
  }

  // 历史 / 地理 / 政治大题（结构与生物同构：材料里内联设问 + 占位符；
  // 占位符是 <AnswerBox>，长得像「阅读表达」那种大答题框；
  // 中文文科材料，indentParagraphs 用 Grammar 默认的 true）
  if (questionGroup.questionType === 'history-fill' || questionGroup.questionType === 'geography-fill' || questionGroup.questionType === 'politics-fill') {
    const mdxSource = contentMdx;
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Grammar
          questions={questions as any}
          mdxSource={mdxSource!}
        />
      </>
    );
  }

  // 英语阅读：不再提供同卷 A/B/C/D 篇切换

  if (questionGroup.questionType === 'en-reading') {
    const mdxSource = contentMdx;
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
    const mdxSource = contentMdx;
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <SevenChooseFive 
          questions={questions as any} 
          mdxSource={mdxSource!}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'reading-expression') {
    const mdxSource = contentMdx;
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
          pickOne={questionGroup.answerMode === 'pick-one'}
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
          pickOne={questionGroup.answerMode === 'pick-one'}
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

  if (questionGroup.questionType === 'chemistry-image') {
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <div className="qimage-full">
          <Problem questions={questions as any} mdxSource={contentMdx} indentParagraphs={false} />
        </div>
      </>
    );
  }

  if (questionGroup.questionType === 'math-choice' || questionGroup.questionType === 'physics-choice' || questionGroup.questionType === 'chemistry-choice' || questionGroup.questionType === 'chemistry-image' || questionGroup.questionType === 'biology-choice' || questionGroup.questionType === 'politics' || questionGroup.questionType === 'history-choice' || questionGroup.questionType === 'geography-choice' || questionGroup.questionType === 'politics-choice') {
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Problem
          questions={questions as any}
          language="zh"
          indentParagraphs={questionGroup.questionType !== 'biology-choice'}
        />
      </>
    );
  }

  if (questionGroup.questionType === 'chinese-reading') {
    // 名著阅读：不设阅读区，材料与小题同在主区域，每小题一个答题框
    const isNamedBook = questionGroup.category === '名著';
    return (
      <>
        <QuestionGroupHeader title={questionGroup.title} questionGroupId={id} questionCount={questionGroup.groupItems.length} score={questionGroup.score} />
        <Problem
          questions={questions as any} 
          mdxSource={contentMdx}
          language="zh"
          articleLayout={isNamedBook ? 'inline' : 'side'}
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