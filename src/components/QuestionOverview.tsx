"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, FileText, SlidersHorizontal } from "lucide-react";
import { QuestionCard } from "./QuestionCard";
import { TestCard } from "./TestCard";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageBar } from "@/components/PageBar";
import useSession from "@/lib/use-session";

type ListGroup = {
  id: string;
  title: string;
  subject: string;
  questionType: string;
  source: string;
  tags: string[];
  score: number;
  imageUrl?: string | null;
};

type ListPaper = {
  id: string;
  title: string;
  subject: string;
  source: string;
  year?: number | null;
  grade?: string | null;
  tags: string[];
};

interface Filters {
  cat: string;
  year: string;
  grade: string;
  q: string;
}

interface QuestionOverviewProps {
  mode: "groups" | "papers";
  groups: ListGroup[];
  papers: ListPaper[];
  total: number;
  page: number;
  pageSize: number;
  subject: string;
  category: string;
  filters: Filters;
  yearOptions: number[];
  gradeOptions: string[];
}

/** 界面上的一级筛选（对应 tags / 来源） */
const CATEGORY_OPTIONS = [
  { value: "all", label: "全部题型" },
  { value: "高考真题", label: "高考真题" },
  { value: "各区一模", label: "各区一模" },
  { value: "各区二模", label: "各区二模" },
  { value: "各区期末", label: "各区期末" },
  { value: "广学模拟", label: "广学模拟" },
];

export function QuestionOverview({
  mode,
  groups,
  papers,
  total,
  page,
  pageSize,
  subject,
  category,
  filters,
  yearOptions,
  gradeOptions,
}: QuestionOverviewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useSession();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const [testSubmissions, setTestSubmissions] = useState<Record<string, string>>({});
  const [submissionCounts, setSubmissionCounts] = useState<{
    groups: Record<string, number>;
    testPapers: Record<string, number>;
  }>({ groups: {}, testPapers: {} });

  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  // 记录列表页地址：从列表点进做题页时，回顾页的「返回」要回到这里
  useEffect(() => {
    try {
      sessionStorage.setItem("list_url", window.location.pathname + window.location.search);
    } catch {}
  }, []);

  // 练习次数 / 最近一次提交（仅当前页）
  useEffect(() => {
    const groupIds = groups.map((g) => g.id).join(",");
    const testPaperIds = papers.map((p) => p.id).join(",");
    if (!groupIds && !testPaperIds) return;

    const params = new URLSearchParams();
    if (groupIds) params.set("groupIds", groupIds);
    if (testPaperIds) params.set("testPaperIds", testPaperIds);

    fetch(`/api/stats/submission-counts?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSubmissionCounts({
            groups: data.data.groups || {},
            testPapers: data.data.testPapers || {},
          });
        }
      })
      .catch(() => {});
  }, [groups, papers]);

  useEffect(() => {
    if (!session.userid || !papers.length) return;
    const ids = papers.map((p) => p.id).join(",");
    // userId 由服务端从登录会话读取，前端不再传递
    fetch(`/api/submissions/test-paper/latest?testPaperIds=${ids}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setTestSubmissions(data))
      .catch(() => {});
  }, [session.userid, papers]);

  /** 拼接带筛选条件的地址：所有分页/筛选都走 URL，服务端渲染，状态不会错乱 */
  const hrefWith = (over: Partial<Filters> & { page?: number }) => {
    const next = { ...filters, ...over };
    const params = new URLSearchParams();
    if (next.cat && next.cat !== "all") params.set("cat", next.cat);
    if (next.year && next.year !== "all") params.set("year", next.year);
    if (next.grade && next.grade !== "all") params.set("grade", next.grade);
    if (next.q) params.set("q", next.q);
    const targetPage = over.page ?? 1;
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const isTestPaperPage = mode === "papers";

  const submitSearch = () => {
    router.push(hrefWith({ q: searchDraft.trim(), page: 1 }));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          {/* 左侧筛选面板（移动端默认折叠） */}
          <Card className={`${filtersOpen ? "block" : "hidden"} w-full shrink-0 bg-card rounded-xl p-4 sm:p-6 h-fit lg:block lg:w-72`}>
            <h3 className="text-base font-semibold mb-4 border-l-4 border-primary pl-3 sm:text-lg sm:mb-5">筛选条件</h3>

            {/* 题型分类 */}
            <div className="mb-5 grid grid-cols-2 gap-2 lg:mb-6 lg:flex lg:flex-col">
              {CATEGORY_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="lg"
                  asChild
                  variant={filters.cat === option.value ? "default" : "outline"}
                  className="w-full"
                >
                  <Link href={hrefWith({ cat: option.value, page: 1 })}>{option.label}</Link>
                </Button>
              ))}
            </div>

            {/* 年份 */}
            <div className="mb-6">
              <Label className="text-sm font-medium text-muted-foreground mb-3 block">选择年份</Label>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant={filters.year === "all" ? "default" : "outline"} size="sm" className="px-3 py-1 text-xs">
                  <Link href={hrefWith({ year: "all", page: 1 })}>全部</Link>
                </Button>
                {yearOptions.map((year) => (
                  <Button
                    key={year}
                    asChild
                    variant={filters.year === String(year) ? "default" : "outline"}
                    size="sm"
                    className="px-3 py-1 text-xs"
                  >
                    <Link href={hrefWith({ year: String(year), page: 1 })}>{year}</Link>
                  </Button>
                ))}
              </div>
            </div>

            {/* 年级 */}
            <div>
              <Label className="text-sm font-medium text-muted-foreground mb-3 block">选择年级</Label>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant={filters.grade === "all" ? "default" : "outline"} size="sm" className="px-3 py-1 text-xs">
                  <Link href={hrefWith({ grade: "all", page: 1 })}>全部</Link>
                </Button>
                {gradeOptions.map((grade) => (
                  <Button
                    key={grade}
                    asChild
                    variant={filters.grade === grade ? "default" : "outline"}
                    size="sm"
                    className="px-3 py-1 text-xs"
                  >
                    <Link href={hrefWith({ grade, page: 1 })}>{grade}</Link>
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {/* 右侧内容 */}
          <div className="min-w-0 flex-1">
            <div className="mb-4 rounded-xl bg-card p-3 sm:mb-6 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <form
                  className="relative flex-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitSearch();
                  }}
                >
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    enterKeyHint="search"
                    placeholder="搜索题目或套卷..."
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-foreground placeholder:text-muted-foreground transition-all focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
                  />
                </form>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
                    {isTestPaperPage ? `共 ${total} 份套卷` : `共 ${total} 个题组`}
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
              <div>
                <div className="grid grid-cols-1 gap-4">
                  {papers.map((paper) => (
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
                  pageCount={pageCount}
                  hrefForPage={(p) => hrefWith({ page: p })}
                  showLabel={false}
                />

                {papers.length === 0 && (
                  <div className="text-center py-16 bg-card rounded-xl">
                    <div className="text-muted-foreground mb-2">
                      <FileText className="w-12 h-12 mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-1">暂无{subject}套卷</h3>
                    <p className="text-muted-foreground">尝试调整筛选条件或搜索关键词</p>
                  </div>
                )}
              </div>
            ) : groups.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {groups.map((group) => (
                    <div key={group.id}>
                      <QuestionCard
                        id={group.id}
                        title={group.title.length > 100 ? group.title.substring(0, 100) + "..." : group.title}
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
                  pageCount={pageCount}
                  hrefForPage={(p) => hrefWith({ page: p })}
                  showLabel={false}
                />
              </>
            ) : (
              <div className="text-center py-16 bg-card rounded-xl">
                <div className="text-muted-foreground mb-2">
                  <Search className="w-12 h-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-1">未找到匹配的题目</h3>
                <p className="text-muted-foreground">尝试调整筛选条件或搜索关键词</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
