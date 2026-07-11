import { redirect } from "next/navigation";
import { routeToSubject, categoriesBySubject, categoryToRoute } from "@/constants/subjects";

interface PageProps {
  params: Promise<{
    subject: string;
  }>;
}

export default async function SubjectPage({ params }: PageProps) {
  const { subject } = await params;
  const subjectName = routeToSubject[subject] || subject;

  // 获取该学科的第一个分类
  const categories = categoriesBySubject[subjectName] || [];
  if (categories.length > 0) {
    // 排除"套卷"分类，优先显示其他分类
    const nonTestPaperCategories = categories.filter(cat => cat !== '套卷');
    const firstCategory = nonTestPaperCategories.length > 0 ? nonTestPaperCategories[0] : categories[0];
    const categoryRoute = categoryToRoute[subjectName]?.[firstCategory] || firstCategory.toLowerCase();
    
    // 重定向到第一个分类页面
    redirect(`/questions/${subject}/${categoryRoute}`);
  }

  // 如果没有分类，显示错误页面
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">页面未找到</h1>
        <p className="text-muted-foreground">该学科暂无可用分类</p>
      </div>
    </div>
  );
}