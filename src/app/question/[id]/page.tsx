import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { serialize } from 'next-mdx-remote/serialize';
import Cloze from "@/components/question-group/cloze";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

async function QuestionPageContent({ id }: { id: string }) {
  // 获取题组及其关联的题目
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

  // 构建题目数组
  const questions = questionGroup.groupItems.map((item: any) => ({
    id: item.question.id,
    stem: item.question.content,
    type: 'single' as const,
    options: item.question.options || []
  }));

  // 如果是完形填空类型，则使用完形填空组件
  if (questionGroup.questionType === 'cloze') {
    // 序列化数据库中的 MDX 内容
    const mdxSource = await serialize(questionGroup.content || '');
    
    return (
      <Cloze 
        questions={questions} 
        mdxSource={mdxSource}
      />
    );
  }

  // 如果是其他题型，可以扩展其他组件
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">题组: {questionGroup.title}</h1>
      <p>题型: {questionGroup.questionType}</p>
      <p>暂不支持的题型</p>
      {/* 在这里可以添加其他题型的支持 */}
    </div>
  );
}

export default async function QuestionPage({ params }: PageProps) {
  const { id } = await params;
  
  return <QuestionPageContent id={id} />;
}