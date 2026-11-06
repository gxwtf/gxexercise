import { NextResponse } from "next/server"
import { subjects, subjectToRoute, categoriesBySubject, categoryToRoute } from "@/constants/subjects"

/**
 * 首页「按考试找卷」的中转：把 (学科, 类型, 年份) 转成该学科的套卷列表页。
 *
 * 为什么需要它：套卷列表在 `/questions/<学科>/套卷` 这种按学科分路径的路由下，
 * 一个普通 HTML 表单没法「按选项改路径」，所以用一个 GET 中转拼出目标 URL 后 302。
 *
 * 用法：/api/go/papers?subject=历史&cat=各区一模&year=2026
 */
const VALID_CATS = new Set(["高考真题", "各区一模", "各区二模", "各区期末", "全部"])

export async function GET(req: Request) {
  const url = new URL(req.url)
  const subjectParam = (url.searchParams.get("subject") || "").trim()
  const catParam = (url.searchParams.get("cat") || "").trim()
  const yearParam = (url.searchParams.get("year") || "all").trim()
  const keyword = (url.searchParams.get("q") || "").trim()

  const subject = subjects.includes(subjectParam) ? subjectParam : subjects[0]
  const cat = VALID_CATS.has(catParam) && catParam !== "全部" ? catParam : "all"
  const year = /^\d{4}$/.test(yearParam) ? yearParam : "all"

  // 「套卷」这个类别在每科的分类里都存在（categoriesBySubject 里统一带）
  const categoryName = (categoriesBySubject[subject] || []).includes("套卷") ? "套卷" : "选择"
  const categoryRoute = categoryToRoute[subject]?.[categoryName]
  const subjectRoute = subjectToRoute[subject]
  if (!subjectRoute || !categoryRoute) {
    return NextResponse.redirect(new URL("/questions", url.origin), 302)
  }

  const target = new URL(`/questions/${subjectRoute}/${categoryRoute}`, url.origin)
  target.searchParams.set("cat", cat)
  if (year !== "all") target.searchParams.set("year", year)
  if (keyword) target.searchParams.set("q", keyword)
  return NextResponse.redirect(target, 302)
}
