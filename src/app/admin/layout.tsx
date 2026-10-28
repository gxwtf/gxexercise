import Link from "next/link"
import { redirect } from "next/navigation"
import { getAdminViewer } from "@/lib/admin-guard"
import Header from "@/components/layout/Header"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

/**
 * 管理后台布局：统一做登录 + 管理员校验，页面本身只关心业务数据。
 * - 未登录：跳转登录页，登录后回到管理员提交记录
 * - 已登录但非管理员：只显示提示，不渲染任何数据
 *
 * 注意：App Router 会并行渲染 page，layout 的提前 return 不能阻止 page 查库，
 * 因此每个 page 内部也必须调用 getAdminViewer() 再查库（见 admin/submissions/**）。
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getAdminViewer()

  if (!viewer.ok) {
    if (viewer.reason === "anonymous") {
      redirect("/login?back=/admin/submissions")
    }
    return (
      <>
        <Header />
        <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-4 py-16 text-center">
          <h1 className="text-xl font-bold">需要管理员权限</h1>
          <p className="text-sm text-muted-foreground">
            该页面仅向管理员开放。如需查看自己的作答记录，请前往「我的作答记录」。
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
