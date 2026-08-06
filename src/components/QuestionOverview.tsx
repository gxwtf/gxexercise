"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QuestionCard } from "./QuestionCard";
import { TestCard } from "./TestCard";
import { Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import useSession from "@/lib/use-session";

type Question = {
  id: string;
  questionType: string;
  content: string;
  options?: any | null;
  answer: string;
  analysis?: string | null;
  score: number;
  correctRate: number | null;
  subject: string;
  source: string;
  grade?: string | null;
  category: string;
  year?: number | null;
  tags: string[];
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type GroupItem = {
  id: string;
  groupId: string;
  questionId: string;
  orderIndex: number;
  question: Question;
};

type QuestionGroup = {
  id: string;
  title: string;
  content: string;
  questionType: string;
  score: number;
  subject: string;
  source: string;
  grade?: string | null;
  category: string;
  tags: string[];
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  groupItems: GroupItem[];
};

type TestPaper = {
  id: string;
  title: string;
  description?: string | null;
  subject: string;
  source: string;
  year?: number | null;
  grade?: string | null;
  totalScore?: number | null;
  duration?: number | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

interface QuestionOverviewProps {
  initialGroups?: QuestionGroup[];
  initialTestPapers?: TestPaper[];
  subject?: string;
  category?: string;
  questionType?: string;
}

export function QuestionOverview({
  initialGroups = [],
  initialTestPapers = [],
  subject,
  category,
  questionType,
}: QuestionOverviewProps) {
  // 判断是否为套卷页面
  const isTestPaperPage = category === '套卷';
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const router = useRouter()
  const { session } = useSession()
  const [testSubmissions, setTestSubmissions] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!session.userid || !initialTestPapers?.length) return
    const ids = initialTestPapers.map(p => p.id).join(",")
    fetch(`/api/submissions/test-paper/latest?userId=${session.userid}&testPaperIds=${ids}`)
      .then(res => res.json())
      .then(data => setTestSubmissions(data))
      .catch(() => {})
  }, [session.userid, initialTestPapers])

  // 使用从props传入的套卷数据
  const testPapers = initialTestPapers;

  // 过滤套卷数据
  const filteredTestPapers = useMemo(() => {
    return testPapers.filter((paper) => {
      const matchesSearch =
        paper.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesSubject = !subject || paper.subject === subject;

      // 套卷新增筛选条件
      const matchesCategoryFilter = selectedCategory === "all" || paper.source === selectedCategory;
      const matchesYearFilter = selectedYear === "all" || paper.year?.toString() === selectedYear;
      const matchesGradeFilter = selectedGrade === "all" || paper.grade === selectedGrade;

      return matchesSearch && matchesSubject &&
        matchesCategoryFilter && matchesYearFilter && matchesGradeFilter;
    });
  }, [testPapers, searchTerm, subject, selectedCategory, selectedYear, selectedGrade]);

  // 筛选选项 - 固定的四个选项
  const categoryOptions = [
    { value: "all", label: "全部题型" },
    { value: "高考真题", label: "高考真题" },
    { value: "高考模拟", label: "高考模拟" },
    { value: "各区期末", label: "各区期末" },
    { value: "广学模拟", label: "广学模拟" }
  ];

  // 动态生成年份选项（从组题关联的题目中提取）
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [{ value: "all", label: "全部" }];
    
    // 从组题关联的题目中提取所有年份
    const uniqueYears = new Set<number>();
    initialGroups.forEach(group => {
      group.groupItems.forEach(item => {
        if (item.question && item.question.year) uniqueYears.add(item.question.year);
      });
    });
    
    // 添加最近5年
    for (let i = currentYear; i >= currentYear - 5; i--) {
      uniqueYears.add(i);
    }
    
    // 转换为选项
    Array.from(uniqueYears)
      .sort((a, b) => b - a)
      .forEach(year => {
        years.push({ value: year.toString(), label: year.toString() });
      });
    
    return years;
  }, [initialGroups]);

  // 动态生成年级选项（从组题中提取）
  const gradeOptions = useMemo(() => {
    const grades = [{ value: "all", label: "全部" }];
    
    // 从组题数据中提取所有年级
    const uniqueGrades = new Set<string>();
    initialGroups.forEach(group => {
      if (group.grade) uniqueGrades.add(group.grade);
      group.groupItems.forEach(item => {
        if (item.question && item.question.grade) uniqueGrades.add(item.question.grade!);
      });
    });
    
    // 添加标准年级选项
    ["高一", "高二", "高三"].forEach(grade => {
      if (uniqueGrades.has(grade)) {
        grades.push({ value: grade, label: grade });
      }
    });
    
    return grades;
  }, [initialGroups]);

  // 处理单个题组练习

  const filteredGroups = useMemo(() => {
    return initialGroups.filter((group) => {
      const matchesSearch =
        group.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesSubject = !subject || group.subject === subject;
      const matchesCategory = !category || group.category === category;
      const matchesType = !questionType || group.questionType === questionType;

      // 新增筛选条件
      const matchesCategoryFilter = selectedCategory === "all" || group.source === selectedCategory;
      const matchesYearFilter = selectedYear === "all" || 
        group.groupItems.some(item => item.question.year?.toString() === selectedYear);
      const matchesGradeFilter = selectedGrade === "all" || 
        group.grade === selectedGrade ||
        group.groupItems.some(item => item.question.grade === selectedGrade);

      return matchesSearch && matchesSubject && matchesCategory && matchesType &&
        matchesCategoryFilter && matchesYearFilter && matchesGradeFilter;
    });
  }, [initialGroups, searchTerm, subject, category, questionType, selectedCategory, selectedYear, selectedGrade]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* 左侧筛选面板 */}
          <Card className="w-68 bg-card rounded-xl p-6 h-fit">
            <h3 className="text-lg font-semibold mb-5 border-l-4 border-primary pl-3">筛选条件</h3>

            {/* 题型分类 */}
            <div className="space-y-2 mb-6">
              {categoryOptions.map((option) => (
                <Button
                  size="lg"
                  key={option.value}
                  variant={selectedCategory === option.value ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setSelectedCategory(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            {/* 年份筛选 */}
            <div className="mb-6">
              <Label className="text-sm font-medium text-muted-foreground mb-3 block">选择年份</Label>
              <div className="flex flex-wrap gap-2">
                {yearOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={selectedYear === option.value ? "default" : "outline"}
                    size="sm"
                    className="px-3 py-1 text-xs"
                    onClick={() => setSelectedYear(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* 年级筛选 */}
            <div>
              <Label className="text-sm font-medium text-muted-foreground mb-3 block">选择年级</Label>
              <div className="flex flex-wrap gap-2">
                {gradeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={selectedGrade === option.value ? "default" : "outline"}
                    size="sm"
                    className="px-3 py-1 text-xs"
                    onClick={() => setSelectedGrade(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {/* 右侧内容区域 */}
          <div className="flex-1">
            <div className="bg-card rounded-xl mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="搜索题目..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
              </div>
            </div>

            {isTestPaperPage ? (
              // 套卷页面：只显示套卷内容，每行一个
              <div>
                <h2 className="text-2xl font-bold mb-6">{subject}套卷练习</h2>
                <div className="grid grid-cols-1 gap-4">
                  {filteredTestPapers.map((paper) => (
                    <TestCard
                      key={paper.id}
                      id={paper.id}
                      title={paper.title}
                      type={paper.source}
                      year={paper.year || null}
                      grade={paper.grade || null}
                      subject={paper.subject}
                      latestSubmissionId={testSubmissions[paper.id]}
                    />
                  ))}
                </div>

                {filteredTestPapers.length === 0 && (
                  <div className="text-center py-16 bg-card rounded-xl border border-border">
                    <div className="text-muted-foreground mb-2">
                      <FileText className="w-12 h-12 mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-1">
                      暂无{subject}套卷
                    </h3>
                    <p className="text-muted-foreground">
                      请稍后查看或联系管理员添加
                    </p>
                  </div>
                )}
              </div>
            ) : filteredGroups.length > 0 ? (
              // 普通题目页面：显示组题和套卷推荐
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredGroups.map((group, index) => (
                    <div
                      key={group.id}
                      className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <QuestionCard
                        id={group.id}
                        title={group.title.length > 100 ? group.title.substring(0, 100) + '...' : group.title}
                        imageUrl={group.imageUrl ?? undefined}
                        subject={group.subject}
                        questionType={group.questionType}
                        source={group.source}
                        tags={group.tags}
                      />
                    </div>
                  ))}
                </div>

                {/* 套卷推荐 */}
                {testPapers.length > 0 && (
                  <div className="mt-12">
                    <Separator className="my-6" />
                    <h3 className="text-lg font-semibold mb-4">推荐套卷</h3>
                    <div className="grid gap-4">
                      {testPapers.slice(0, 3).map((paper) => (
                        <TestCard
                          key={paper.id}
                          id={paper.id}
                          title={paper.title}
                          type={paper.source}
                          year={paper.year || null}
                          grade={paper.grade || null}
                          subject={paper.subject}
                          latestSubmissionId={testSubmissions[paper.id]}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // 无匹配组题
              <div className="text-center py-16 bg-card rounded-xl border border-border">
                <div className="text-muted-foreground mb-2">
                  <Search className="w-12 h-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-1">
                  未找到匹配的题目
                </h3>
                <p className="text-muted-foreground">
                  尝试调整筛选条件或搜索关键词
                </p>
              </div>
            )}

            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                当前显示 {filteredGroups.length} 个组题
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}