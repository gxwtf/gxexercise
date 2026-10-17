import { prisma } from "@/lib/prisma";
import { routeToSubject, routeToCategory } from "@/constants/subjects";
import { QuestionOverview } from "@/components/QuestionOverview";

interface PageProps {
  params: Promise<{
    subject: string;
    category: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 12;

/** 分类筛选 → tags 映射（与界面上的筛选项一一对应） */
const CATEGORY_TAG_MAP: Record<string, string> = {
  高考真题: "真题",
  各区一模: "一模",
  各区二模: "二模",
  各区期末: "期末",
};

export default async function SubjectCategoryPage({ params, searchParams }: PageProps) {
  const { subject, category } = await params;
  const sp = await searchParams;

  const pick = (key: string) => {
    const v = sp[key];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };

  const subjectName = routeToSubject[subject] || subject;
  const categoryName = routeToCategory[category] || category;
  const isTestPaperCategory = categoryName === "套卷";

  const catFilter = pick("cat") || "all";
  const yearFilter = pick("year") || "all";
  const gradeFilter = pick("grade") || "all";
  const keyword = pick("q").trim();
  const page = Math.max(1, Number.parseInt(pick("page"), 10) || 1);

  // 分类筛选：有 tag 映射的按 tags 过滤，其余按来源精确匹配（如「广学模拟」）
  const catTag = CATEGORY_TAG_MAP[catFilter];
  const catWhere: Record<string, unknown> = catTag
    ? { tags: { has: catTag } }
    : catFilter !== "all"
      ? { source: catFilter }
      : {};

  const and: Record<string, unknown>[] = [];

  if (isTestPaperCategory) {
    const where: Record<string, unknown> = { subject: subjectName, ...catWhere };
    if (yearFilter !== "all") where.year = Number(yearFilter);
    if (gradeFilter !== "all") where.grade = gradeFilter;
    if (keyword) {
      and.push({
        OR: [
          { title: { contains: keyword, mode: "insensitive" } },
          { source: { contains: keyword, mode: "insensitive" } },
        ],
      });
    }
    if (and.length) where.AND = and;

    const [total, papers, paperYears, paperGrades] = await Promise.all([
      prisma.testPaper.count({ where }),
      prisma.testPaper.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          title: true,
          subject: true,
          source: true,
          year: true,
          grade: true,
          tags: true,
        },
      }),
      prisma.testPaper.findMany({
        where: { subject: subjectName },
        select: { year: true },
        distinct: ["year"],
        orderBy: { year: "desc" },
      }),
      prisma.testPaper.findMany({
        where: { subject: subjectName },
        select: { grade: true },
        distinct: ["grade"],
      }),
    ]);

    return (
      <QuestionOverview
        mode="papers"
        groups={[]}
        papers={papers}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        subject={subjectName}
        category={categoryName}
        filters={{ cat: catFilter, year: yearFilter, grade: gradeFilter, q: keyword }}
        yearOptions={paperYears.map((r) => r.year).filter((y): y is number => typeof y === "number")}
        gradeOptions={paperGrades.map((r) => r.grade).filter((g): g is string => Boolean(g))}
      />
    );
  }

  const where: Record<string, unknown> = { subject: subjectName, category: categoryName, ...catWhere };
  if (yearFilter !== "all") {
    and.push({ groupItems: { some: { question: { year: Number(yearFilter) } } } });
  }
  if (gradeFilter !== "all") {
    and.push({
      OR: [
        { grade: gradeFilter },
        { groupItems: { some: { question: { grade: gradeFilter } } } },
      ],
    });
  }
  if (keyword) {
    and.push({
      OR: [
        { title: { contains: keyword, mode: "insensitive" } },
        { content: { contains: keyword, mode: "insensitive" } },
        { source: { contains: keyword, mode: "insensitive" } },
        { tags: { has: keyword } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const [total, groups, questionYears, questionGrades] = await Promise.all([
    prisma.questionGroup.count({ where }),
    prisma.questionGroup.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        subject: true,
        questionType: true,
        source: true,
        tags: true,
        score: true,
        imageUrl: true,
      },
    }),
    prisma.question.findMany({
      where: { subject: subjectName },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
    prisma.question.findMany({
      where: { subject: subjectName },
      select: { grade: true },
      distinct: ["grade"],
    }),
  ]);

  return (
    <QuestionOverview
      mode="groups"
      groups={groups}
      papers={[]}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      subject={subjectName}
      category={categoryName}
      filters={{ cat: catFilter, year: yearFilter, grade: gradeFilter, q: keyword }}
      yearOptions={questionYears.map((r) => r.year).filter((y): y is number => typeof y === "number")}
      gradeOptions={questionGrades.map((r) => r.grade).filter((g): g is string => Boolean(g))}
    />
  );
}
