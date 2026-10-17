"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QuestionCard } from "./QuestionCard";
import { TestCard } from "./TestCard";
import { Search, FileText, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import useSession from "@/lib/use-session";
import { PageBar } from "@/components/PageBar";

/**
 * 列表页只需要每组内出现过的年份/年级（用于筛选），
 * 不再下发 groupItems 明细与题目/文章正文，RSC 负载可降一个数量级（移动端首屏明显更快）。
 */
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
  years: number[];
  grades: string[];
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
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const PAGE_SIZE = 12;
  const router = useRouter()
  const { session } = useSession()
  const [testSubmissions, setTestSubmissions] = useState<Record<string, string>>({})
  const [submissionCounts, setSubmissionCounts] = useState<{ groups: Record<string, number>; testPapers: Record<string, number> }>({ groups: {}, testPapers: {} })

  useEffect(() => {
    const groupIds = initialGroups.map((g) => g.id).join(",")
    const testPaperIds = initialTestPapers.map((p) => p.id).join(",")
    if (!groupIds && !testPaperIds) return

    const params = new URLSearchParams()
    if (groupIds) params.set("groupIds", groupIds)
    if (testPaperIds) params.set("testPaperIds", testPaperIds)

    fetch(`/api/stats/submission-counts?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSubmissionCounts({
            groups: data.data.groups || {},
            testPapers: data.data.testPapers || {},
          })
        }
      })
      .catch(() => {})
  }, [initialGroups, initialTestPapers])

  useEffect(() => {
    if (!session.userid || !initialTestPapers?.length) return
    const ids = initialTestPapers.map(p => p.id).join(",")
    fetch(`/api/submissions/test-paper/latest?userId=${session.userid}&testPaperIds=${ids}`)
      .then(res => res.json())
      .then(data => setTestSubmissions(data))
      .catch(() => { })
  }, [session.userid, initialTestPapers])

  // 使用从props传入的套卷数据
  const testPapers = initialTestPapers;

  // 筛选条件变化时回到第一页
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory, selectedYear, selectedGrade, questionType]);


  // 筛选选项
  const categoryOptions = [
    { value: "all", label: "全部题型" },
    { value: "高考真题", label: "高考真题" },
    { value: "各区一模", label: "各区一模" },
    { value: "各区二模", label: "各区二模" },
    { value: "各区期末", label: "各区期末" },
    { value: "广学模拟", label: "广学模拟" }
  ];

  const categoryTagMap: Record<string, string> = {
    "高考真题": "真题",
    "各区一模": "一模",
    "各区二模": "二模",
    "各区期末": "期末",
  };

  // 过滤套卷数据
  const filteredTestPapers = useMemo(() => {
    return testPapers.filter((paper) => {
      const matchesSearch =
        paper.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        ) ||
        paper.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.year?.toString().includes(searchTerm) ||
        paper.grade?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSubject = !subject || paper.subject === subject;

      const matchesCategoryFilter = selectedCategory === "all" ||
        (categoryTagMap[selectedCategory]
          ? paper.tags.includes(categoryTagMap[selectedCategory])
          : paper.source === selectedCategory);
      const matchesYearFilter = selectedYear === "all" || paper.year?.toString() === selectedYear;
      const matchesGradeFilter = selectedGrade === "all" || paper.grade === selectedGrade;

      return matchesSearch && matchesSubject &&
        matchesCategoryFilter && matchesYearFilter && matchesGradeFilter;
    });
  }, [testPapers, searchTerm, subject, selectedCategory, selectedYear, selectedGrade]);

  // 动态生成年份选项
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [{ value: "all", label: "全部" }];

    // 从组题关联的题目中提取所有年份
    const uniqueYears = new Set<number>();
    initialGroups.forEach(group => {
      (group.years || []).forEach((y) => uniqueYears.add(y));
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
      (group.grades || []).forEach((g) => uniqueGrades.add(g));
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
        ) ||
        group.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.years.some((y) => y.toString().includes(searchTerm));
      const matchesSubject = !subject || group.subject === subject;
      const matchesCategory = !category || group.category === category;
      const matchesType = !questionType || group.questionType === questionType;

      // 新增筛选条件
      const matchesCategoryFilter = selectedCategory === "all" ||
        (categoryTagMap[selectedCategory]
          ? group.tags.includes(categoryTagMap[selectedCategory])
          : group.source === selectedCategory);
      const matchesYearFilter = selectedYear === "all" ||
        group.years.some((y) => y.toString() === selectedYear);
      const matchesGradeFilter = selectedGrade === "all" ||
        group.grade === selectedGrade ||
        group.grades.includes(selectedGrade);

      return matchesSearch && matchesSubject && matchesCategory && matchesType &&
        matchesCategoryFilter && matchesYearFilter && matchesGradeFilter;
    });
  }, [initialGroups, searchTerm, subject, category, questionType, selectedCategory, selectedYear, selectedGrade]);

  // 分页切片
  const pagedGroups = useMemo(
    () => filteredGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredGroups, page]
  );
  const pagedPapers = useMemo(
    () => filteredTestPapers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredTestPapers, page]
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          {/* 左侧筛选面板（移动端默认折叠，用「筛选条件」按钮展开） */}
          <Card className={`${filtersOpen ? "block" : "hidden"} w-full shrink-0 bg-card rounded-xl p-4 sm:p-6 h-fit lg:block lg:w-72`}>
            <h3 className="text-base font-semibold mb-4 border-l-4 border-primary pl-3 sm:text-lg sm:mb-5">筛选条件</h3>

            {/* 题型分类：移动端两列平铺，桌面端竖排 */}
            <div className="mb-5 grid grid-cols-2 gap-2 lg:mb-6 lg:flex lg:flex-col">
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
            <div className="mb-4 rounded-xl bg-card p-3 sm:mb-6 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="搜索题目或套卷..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-foreground placeholder:text-muted-foreground transition-all focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
                    {isTestPaperPage ? `共 ${filteredTestPapers.length} 份套卷` : `共 ${filteredGroups.length} 个题组`}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 lg:hidden"
                    onClick={() => setFiltersOpen((v) => !v)}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    筛选
                  </Button>
                </div>
              </div>
            </div>

            {isTestPaperPage ? (
              // 套卷页面：只显示套卷内容，每行一个
              <div>
                <div className="grid grid-cols-1 gap-4">
                  {pagedPapers.map((paper) => (
                    <TestCard
                      key={paper.id}
                      id={paper.id}
                      title={paper.title}
                      type={paper.source}
                      year={paper.year || null}
                      grade={paper.grade || null}
                      subject={paper.subject}
                      latestSubmissionId={testSubmissions[paper.id]}
                      submissionCount={submissionCounts.testPapers[paper.id] || 0}
                    />
                  ))}
                </div>

                <PageBar
                  page={page}
                  pageCount={Math.ceil(filteredTestPapers.length / PAGE_SIZE)}
                  onPageChange={setPage}
                  totalItems={filteredTestPapers.length}
                  pageSize={PAGE_SIZE}
                  unit="份套卷"
                />

                {filteredTestPapers.length === 0 && (
                  <div className="text-center py-16 bg-card rounded-xl">
                    <div className="text-muted-foreground mb-2">
                      <FileText className="w-12 h-12 mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-1">
                      暂无{subject}套卷
                    </h3>
                    <p className="text-muted-foreground">
                      尝试调整筛选条件或搜索关键词
                    </p>
                  </div>
                )}
              </div>
            ) : filteredGroups.length > 0 ? (
              // 普通题目页面：显示组题和套卷推荐
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {pagedGroups.map((group) => (
                    <div
                      key={group.id}
                    >
                      <QuestionCard
                        id={group.id}
                        title={group.title.length > 100 ? group.title.substring(0, 100) + '...' : group.title}
                        imageUrl={group.imageUrl ?? undefined}
                        subject={group.subject}
                        questionType={group.questionType}
                        source={group.source}
                        tags={group.tags}
                        totalScore={group.score}
                        completedCount={submissionCounts.groups[group.id] || 0}
                      />
                    </div>
                  ))}
                </div>
                <PageBar
                  page={page}
                  pageCount={Math.ceil(filteredGroups.length / PAGE_SIZE)}
                  onPageChange={setPage}
                  totalItems={filteredGroups.length}
                  pageSize={PAGE_SIZE}
                  unit="个题组"
                />
              </>
            ) : (
              // 无匹配组题
              <div className="text-center py-16 bg-card rounded-xl">
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
          </div>
        </div>
      </div>
    </div>
  );
}