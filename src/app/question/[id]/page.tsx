import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import dynamic from 'next/dynamic';

// 动态导入客户端组件
const Cloze = dynamic(() => import("@/components/question-group/cloze"));

// 将 Prisma 数据类型转换为普通数字（处理可能的 Decimal 类型）
function convertDecimals(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'object') {
    if (obj.constructor?.name === 'Decimal') {
      return Number(obj);
    }
    
    const converted: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      converted[key] = convertDecimals(obj[key]);
    }
    return converted;
  }
  
  return obj;
}

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

  // 将数据转换为前端可用的格式
  const convertedGroup = convertDecimals(questionGroup);
  
  // 构建题目数组
  const questions = convertedGroup.groupItems.map((item: any) => ({
    id: item.question.id,
    stem: item.question.content,
    type: 'single' as const,
    options: item.question.options || []
  }));

  // 如果是完形填空类型，则使用完形填空组件
  if (convertedGroup.questionType === 'cloze') {
    return (
      <Cloze 
        questions={questions} 
      />
    );
  }

  // 如果是其他题型，可以扩展其他组件
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">题组: {convertedGroup.title}</h1>
      <p>题型: {convertedGroup.questionType}</p>
      <p>暂不支持的题型</p>
      {/* 在这里可以添加其他题型的支持 */}
    </div>
  );
}

export default async function QuestionPage({ params }: PageProps) {
  const { id } = await params;
  
  return <QuestionPageContent id={id} />;
}