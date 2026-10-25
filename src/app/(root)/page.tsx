import Link from "next/link";
import { subjects, subjectToRoute, categoriesBySubject, categoryToRoute } from "@/constants/subjects";
import { prisma } from "@/lib/prisma";
import { getLeaderboard } from "@/lib/leaderboard";
import { LeaderboardList } from "@/components/leaderboard/LeaderboardList";

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const [{ rows: studyTop }, { rows: scoreTop }] = await Promise.all([
    getLeaderboard({ period: "week", metric: "count", limit: 5 }),
    getLeaderboard({ period: "week", metric: "score", limit: 5 }),
  ]);

  const [groupCounts, testPaperCounts] = await Promise.all([
    prisma.questionGroup.groupBy({
      by: ["subject", "category"],
      _count: { id: true },
    }),
    // 「套卷」数据在 TestPaper 表（套卷分类页也只读这张表），QuestionGroup 里没有
    // category='套卷' 的记录，必须单独按学科统计，否则首页套卷数量恒为 0。
    prisma.testPaper.groupBy({
      by: ["subject"],
      _count: { id: true },
    }),
  ]);

  const countMap = new Map<string, number>();
  for (const row of groupCounts) {
    countMap.set(`${row.subject}-${row.category}`, row._count.id);
  }

  const testPaperCountMap = new Map<string, number>();
  for (const row of testPaperCounts) {
    testPaperCountMap.set(row.subject, row._count.id);
  }

  const getCategoryCount = (subject: string, category: string) =>
    category === "套卷"
      ? testPaperCountMap.get(subject) || 0
      : countMap.get(`${subject}-${category}`) || 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          欢迎访问广学题库！
        </h1>
        <p className="text-muted-foreground">
          请选择一个学科，开始你的练习之旅。
        </p>
      </div>

      {/* 广学榜：本周前 5 名 */}
      <section className="mb-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-bold text-foreground">广学榜</h2>
          <Link href="/leaderboard" className="text-sm font-medium text-brand hover:underline">
            查看完整榜单（周榜 / 月榜）→
          </Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <LeaderboardList title="勤学榜" subtitle="本周做题数量 Top 5" rows={studyTop} metric="count" compact href="/leaderboard?period=week" />
          <LeaderboardList title="卓越榜" subtitle="本周得分合计 Top 5" rows={scoreTop} metric="score" compact href="/leaderboard?period=week" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          统计规则：周期内同一道题只算一次（多次作答取最高分）；周榜为本周一至周日，月榜为本月 1 日至月末（北京时间）。
          <Link href="/leaderboard" className="ml-1 text-brand hover:underline">
            查看详细规则
          </Link>
        </p>
      </section>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {subjects.map((subject) => {
          const subjectRoute = subjectToRoute[subject];
          const categories = categoriesBySubject[subject] || [];

          return (
            <div
              key={subject}
              className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <Link href={`/questions/${subjectRoute}`}>
                <h2 className="text-2xl font-bold mb-4">{subject}</h2>
              </Link>
              <ul className="space-y-1">
                {categories.map((category) => {
                  const count = getCategoryCount(subject, category);
                  return (
                    <li key={category}>
                      <Link
                        href={`/questions/${subjectRoute}/${categoryToRoute[subject]?.[category]}`}
                        className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <span>{category}</span>
                        <span className="text-muted-foreground text-xs">
                          {count > 0 ? `${count} 套` : "—"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

    </div>
  );
}