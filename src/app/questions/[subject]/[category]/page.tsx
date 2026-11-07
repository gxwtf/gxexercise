import { prisma } from "@/lib/prisma";
import { routeToSubject, routeToCategory } from "@/constants/subjects";
import { QuestionOverview } from "@/components/QuestionOverview";
import { DISTRICT_ZHENTI, isDistrictValue } from "@/constants/districts";
import { examTypeWhere } from "@/constants/exam-types";

interface PageProps {
  params: Promise<{
    subject: string;
    category: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 12;



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
  const rawDistrict = pick("district") || "all";
  const districtFilter = isDistrictValue(rawDistrict) ? rawDistrict : "all";
  const yearFilter = pick("year") || "all";
  const gradeFilter = pick("grade") || "all";
  const keyword = pick("q").trim();
  const page = Math.max(1, Number.parseInt(pick("page"), 10) || 1);

  // 卷别筛选（高考真题 / 各区一模 / 各区二模 / 各区期中 / 各区期末）：按卷名关键词匹配，
  // 其余自定义分类仍按来源精确匹配（如「广学模拟」）
  const examWhere = examTypeWhere(catFilter);
  const catWhere: Record<string, unknown> = examWhere
    ? examWhere
    : catFilter !== "all"
      ? { source: catFilter }
      : {};

  // 区县筛选：卷子的区县写在 source（= 试卷标题）里，个别老卷只有 title；
  // 「北京真题」这一项等价于「真题」分类，按 tags 命中，避免依赖标题写法。
  const districtWhere: Record<string, unknown> =
    districtFilter === "all"
      ? {}
      : districtFilter === DISTRICT_ZHENTI
        ? { tags: { has: "真题" } }
        : {
            OR: [
              { source: { contains: districtFilter, mode: "insensitive" } },
              { title: { contains: districtFilter, mode: "insensitive" } },
            ],
          };

  const and: Record<string, unknown>[] = [];
  if (Object.keys(districtWhere).length) and.push(districtWhere);

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
        filters={{ cat: catFilter, district: districtFilter, year: yearFilter, grade: gradeFilter, q: keyword }}
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
      filters={{ cat: catFilter, district: districtFilter, year: yearFilter, grade: gradeFilter, q: keyword }}
      yearOptions={questionYears.map((r) => r.year).filter((y): y is number => typeof y === "number")}
      gradeOptions={questionGrades.map((r) => r.grade).filter((g): g is string => Boolean(g))}
    />
  );
}
