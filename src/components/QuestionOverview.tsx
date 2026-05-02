"use client";

import { useState, useMemo } from "react";
import { QuestionCard } from "./QuestionCard";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const [searchTerm, setSearchTerm] = useState("");

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
      return matchesSearch && matchesSubject && matchesCategory && matchesType;
    });
  }, [initialQuestions, searchTerm, subject, category, questionType]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-card rounded-xl shadow-sm p-4 mb-6 border border-border">
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

        {filteredQuestions.length > 0 ? (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        ) : (
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
  );
}