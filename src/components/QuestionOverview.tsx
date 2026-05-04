"use client";

import { useState, useMemo } from "react";
import { QuestionCard } from "./QuestionCard";
import { TestCard } from "./TestCard";
import { Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { prisma } from "@/lib/prisma";
import { QuestionType } from "@/constants/questionTypes";

interface QuestionOverviewProps {
  initialQuestions?: Awaited<ReturnType<typeof prisma.question.findMany>>;
  subject?: string;
  category?: string;
  questionType?: string;
}

export function QuestionOverview({
  initialQuestions,
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

  // 筛选选项
  const categoryOptions = [
    { value: "all", label: "全部题型" },
    { value: "gk", label: "高考真题" },
    { value: "mn", label: "高考模拟" },
    { value: "qm", label: "各区期末" },
    { value: "gx", label: "广学模拟" }
  ];

  const yearOptions = [
    { value: "all", label: "全部" },
    { value: "2024", label: "2024" },
    { value: "2023", label: "2023" },
    { value: "2022", label: "2022" }
  ];

  const gradeOptions = [
    { value: "all", label: "全部" },
    { value: "高一", label: "高一" },
    { value: "高二", label: "高二" },
    { value: "高三", label: "高三" }
  ];

  // 套卷数据示例
  const testPapers = [
    {
      id: "test-1",
      title: "武汉二调",
      type: "高考模拟",
      year: "2024年",
      subject: "英语"
    },
    {
      id: "test-2",
      title: "北京市海淀区期末测试",
      type: "各区期末",
      year: "2023年",
      subject: "英语"
    },
    {
      id: "test-3",
      title: "广学模拟考试套卷",
      type: "广学模拟",
      year: "2024年",
      subject: "英语"
    }
  ];

  // 处理套卷开始练习
  const handleStartTest = (testId: string) => {
    console.log("开始套卷练习:", testId);
    // 这里可以添加跳转到套卷练习页面的逻辑
  };

  const filteredQuestions = useMemo(() => {
    if (!initialQuestions) return [];
    return initialQuestions.filter((question) => {
      const matchesSearch =
        question.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        question.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesSubject = !subject || question.subject === subject;
      const matchesCategory = !category || question.category === category;
      const matchesType = !questionType || question.questionType === questionType;

      // 新增筛选条件
      const matchesCategoryFilter = selectedCategory === "all" || question.category === selectedCategory;
      const matchesYearFilter = selectedYear === "all" || question.year?.toString() === selectedYear;
      const matchesGradeFilter = selectedGrade === "all" || question.tags.includes(selectedGrade);

      return matchesSearch && matchesSubject && matchesCategory && matchesType &&
        matchesCategoryFilter && matchesYearFilter && matchesGradeFilter;
    });
  }, [initialQuestions, searchTerm, subject, category, questionType, selectedCategory, selectedYear, selectedGrade]);

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
                  {testPapers
                    .filter(paper => paper.subject === subject)
                    .map((paper) => (
                      <TestCard
                        key={paper.id}
                        id={paper.id}
                        title={paper.title}
                        type={paper.type}
                        year={paper.year}
                        subject={paper.subject}
                        onStart={handleStartTest}
                      />
                    ))}
                </div>

                {testPapers.filter(paper => paper.subject === subject).length === 0 && (
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
            ) : filteredQuestions.length > 0 ? (
              // 普通题目页面：显示题目和套卷推荐
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredQuestions.map((question, index) => (
                    <div
                      key={question.id}
                      className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <QuestionCard
                        id={question.id}
                        title={question.title}
                        imageUrl={question.imageUrl ?? undefined}
                        subject={question.subject}
                        questionType={question.questionType}
                        year={question.year ?? undefined}
                        source={question.source}
                        tags={question.tags}
                      />
                    </div>
                  ))}
                </div>

                {/* 套卷推荐 */}
                <div className="mt-12">
                  <Separator className="my-6" />
                  <div className="grid gap-4">
                    {testPapers
                      .filter(paper => paper.subject === subject)
                      .slice(0, 3)
                      .map((paper) => (
                        <TestCard
                          key={paper.id}
                          id={paper.id}
                          title={paper.title}
                          type={paper.type}
                          year={paper.year}
                          subject={paper.subject}
                          onStart={handleStartTest}
                        />
                      ))}
                  </div>
                </div>
              </>
            ) : (
              // 无匹配题目
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
                当前显示 {filteredQuestions.length} 道题目
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}