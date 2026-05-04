"use client";

import { useState, useMemo } from "react";
import { QuestionCard } from "./QuestionCard";
import { GroupCard } from "./GroupCard";
import { TestCard } from "./TestCard";
import { FilterPanel, FilterState } from "./FilterPanel";
import { Search, FileText, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { prisma } from "@/lib/prisma";
import { questionTypes as questionTypesConst } from "@/constants/questionTypes";
const questionTypes = [...questionTypesConst];
import type { QuestionModel, QuestionGroupModel as QuestionGroup, TestPaperModel as TestPaper } from "@/generated/prisma/models";

type TransformedQuestion = Omit<QuestionModel, 'correctRate'> & { correctRate: number | null };

interface QuestionOverviewProps {
  initialQuestions?: TransformedQuestion[];
  initialGroups?: QuestionGroup[];
  initialPapers?: TestPaper[];
  subject?: string;
  category?: string;
  questionType?: string;
}

export function QuestionOverview({
  initialQuestions = [],
  initialGroups = [],
  initialPapers = [],
  subject,
  category,
  questionType: initialQuestionType,
}: QuestionOverviewProps) {
  const isTestPaperPage = category === '套卷';
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    questionType: initialQuestionType || '',
    source: '',
    year: '',
    tag: '',
  });

  const sources = useMemo(() => {
    const sourceSet = new Set<string>();
    initialQuestions.forEach(q => sourceSet.add(q.source));
    initialGroups.forEach(g => sourceSet.add(g.source));
    initialPapers.forEach(p => sourceSet.add(p.source));
    return Array.from(sourceSet);
  }, [initialQuestions, initialGroups, initialPapers]);

  const years = useMemo(() => {
    const yearSet = new Set<string>();
    initialQuestions.forEach(q => {
      if (q.year) yearSet.add(q.year.toString());
    });
    return Array.from(yearSet).sort((a, b) => parseInt(b) - parseInt(a));
  }, [initialQuestions]);

  const tags = useMemo(() => {
    const tagSet = new Set<string>();
    initialQuestions.forEach(q => q.tags.forEach(t => tagSet.add(t)));
    initialGroups.forEach(g => g.tags.forEach(t => tagSet.add(t)));
    initialPapers.forEach(p => p.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet);
  }, [initialQuestions, initialGroups, initialPapers]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({
      questionType: initialQuestionType || '',
      source: '',
      year: '',
      tag: '',
    });
    setSearchTerm('');
  };

  const filteredQuestions = useMemo(() => {
    return initialQuestions.filter((question) => {
      const matchesSearch =
        question.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        question.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesType = !filters.questionType || question.questionType === filters.questionType;
      const matchesSource = !filters.source || question.source === filters.source;
      const matchesYear = !filters.year || question.year?.toString() === filters.year;
      const matchesTag = !filters.tag || question.tags.includes(filters.tag);

      return matchesSearch && matchesType && matchesSource && matchesYear && matchesTag;
    });
  }, [initialQuestions, searchTerm, filters]);

  const filteredGroups = useMemo(() => {
    return initialGroups.filter((group) => {
      const matchesSearch =
        group.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesSource = !filters.source || group.source === filters.source;
      const matchesTag = !filters.tag || group.tags.includes(filters.tag);

      return matchesSearch && matchesSource && matchesTag;
    });
  }, [initialGroups, searchTerm, filters]);

  const filteredPapers = useMemo(() => {
    return initialPapers.filter((paper) => {
      const matchesSearch =
        paper.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesSource = !filters.source || paper.source === filters.source;
      const matchesTag = !filters.tag || paper.tags.includes(filters.tag);

      return matchesSearch && matchesSource && matchesTag;
    });
  }, [initialPapers, searchTerm, filters]);

  const handleStartTest = (testId: string) => {
    console.log("开始套卷练习:", testId);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* 左侧筛选面板 */}
          <Card className="w-68 bg-card rounded-xl p-6 h-fit sticky top-6">
            <h3 className="text-lg font-semibold mb-5 border-l-4 border-primary pl-3">筛选条件</h3>
            <FilterPanel
              questionTypes={questionTypes}
              sources={sources}
              years={years}
              tags={tags}
              selectedFilters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />
          </Card>

          {/* 右侧内容区域 */}
          <div className="flex-1">
            <div className="bg-card rounded-xl mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="搜索题目、组题或套卷..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
              </div>
            </div>

            {isTestPaperPage ? (
              <div>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <BookOpen className="w-6 h-6" />
                  {subject}套卷练习
                </h2>
                <div className="grid grid-cols-1 gap-4">
                  {filteredPapers.map((paper) => (
                    <TestCard
                      key={paper.id}
                      id={paper.id}
                      title={paper.title}
                      type={paper.source}
                      year=""
                      subject={paper.subject}
                      onStart={handleStartTest}
                    />
                  ))}
                </div>

                {filteredPapers.length === 0 && (
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
            ) : (
              <>
                {/* 组题区域 */}
                {filteredGroups.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      组题 ({filteredGroups.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredGroups.map((group) => (
                        <div
                          key={group.id}
                          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                        >
                          <GroupCard
                            id={group.id}
                            title={group.title}
                            content={group.content}
                            subject={group.subject}
                            source={group.source}
                            tags={group.tags}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 单题区域 */}
                {filteredQuestions.length > 0 && (
                  <div>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                      单题 ({filteredQuestions.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {filteredQuestions.map((question, index) => (
                        <div
                          key={question.id}
                          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <QuestionCard
                            id={question.id}
                            title={question.content.length > 100 ? question.content.substring(0, 100) + '...' : question.content}
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
                  </div>
                )}

                {/* 套卷推荐 */}
                {initialPapers.length > 0 && !isTestPaperPage && (
                  <div className="mt-12">
                    <Separator className="my-6" />
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                      推荐套卷
                    </h2>
                    <div className="grid gap-4">
                      {filteredPapers.slice(0, 3).map((paper) => (
                        <TestCard
                          key={paper.id}
                          id={paper.id}
                          title={paper.title}
                          type={paper.source}
                          year=""
                          subject={paper.subject}
                          onStart={handleStartTest}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {filteredQuestions.length === 0 && filteredGroups.length === 0 && !isTestPaperPage && (
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
                    当前显示 {filteredGroups.length} 个组题，{filteredQuestions.length} 道单题
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
