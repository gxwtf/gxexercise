import { redirect } from "next/navigation";
import { routeToSubject, categoriesBySubject, categoryToRoute } from "@/constants/subjects"
import { Inbox } from "lucide-react"
import { EmptyState } from "@/components/EmptyState";

interface PageProps {
  params: Promise<{
    subject: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SubjectPage({ params, searchParams }: PageProps) {
  const { subject } = await params;
  const sp = await searchParams;
  const subjectName = routeToSubject[subject] || subject;

  // 保留筛选参数（换学科不丢「考区 / 年份 / 关键词」等）
  const kept = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v) kept.set(key, v);
  }
  const suffix = kept.toString() ? `?${kept.toString()}` : "";

  // 获取该学科的第一个分类
  const categories = categoriesBySubject[subjectName] || [];
  if (categories.length > 0) {
    // 排除"套卷"分类，优先显示其他分类
    const nonTestPaperCategories = categories.filter(cat => cat !== '套卷');
    const firstCategory = nonTestPaperCategories.length > 0 ? nonTestPaperCategories[0] : categories[0];
    const categoryRoute = categoryToRoute[subjectName]?.[firstCategory] || firstCategory.toLowerCase();
    
    // 重定向到第一个分类页面
    redirect(`/questions/${subject}/${categoryRoute}${suffix}`);
  }

  // 如果没有分类，显示错误页面
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <EmptyState icon={<Inbox />} title="页面未找到" description="该学科暂无可用的题目分类。" />
    </div>
  );
}