import Link from "next/link";
import { subjects, subjectToRoute, categoriesBySubject, categoryToRoute } from "@/constants/subjects";
import { prisma } from "@/lib/prisma";

export default async function RootPage() {
  const groupCounts = await prisma.questionGroup.groupBy({
    by: ["subject", "category"],
    _count: { id: true },
  });

  const countMap = new Map<string, number>();
  for (const row of groupCounts) {
    countMap.set(`${row.subject}-${row.category}`, row._count.id);
  }

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
                  const count = countMap.get(`${subject}-${category}`) || 0;
                  return (
                    <li key={category}>
                      <Link
                        href={`/questions/${subjectRoute}/${categoryToRoute[category]}`}
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