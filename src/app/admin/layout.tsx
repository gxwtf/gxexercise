import Link from "next/link"
import { redirect } from "next/navigation"
import { getQuestionBankViewer } from "@/lib/question-bank-auth"
import Header from "@/components/layout/Header"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

/**
 * 管理后台布局：统一做登录校验，页面本身只关心业务数据。
 * - 未登录：跳转登录页
 * - 已登录：网站管理员，或「题目审核名单」里的同学（只能进题库管理相关页面）
 * - 其他已登录用户：只显示提示，不渲染任何数据
 *
 * 注意：App Router 会并行渲染 page，layout 的提前 return 不能阻止 page 查库，
 * 因此每个 page 内部也必须再调用权限校验（getQuestionBankViewer / getAdminViewer）再查库。
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getQuestionBankViewer()

  if (!viewer.ok) {
    if (viewer.reason === "anonymous") {
      redirect("/login?back=/admin/questions")
    }
    return (
      <>
        <Header />
        <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-4 py-16 text-center">
          <h1 className="text-xl font-bold">需要权限</h1>
          <p className="text-sm text-muted-foreground">
            该页面仅向网站管理员、或题目审核名单里的同学开放。如需查看自己的作答记录，请前往「我的作答记录」。
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/records">我的作答记录</Link>
            </Button>
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
    </>
  )
}
