"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export interface AdminDeleteButtonProps {
  /** group=单节练习记录；paper=整份套卷提交（套卷小节删除时会升级为整份套卷） */
  kind: "group" | "paper"
  id: string
  /** 记录标题（题组名或套卷名），用于确认弹窗 */
  title: string
  /** 记录所属用户名，用于确认弹窗 */
  userName: string
  /** 删除成功后：refresh=留在原页刷新；back=回到全部作答记录 */
  afterDelete?: "refresh" | "back"
  className?: string
}

/** 管理员删除作答记录（危险操作，二次确认 + 审计日志在服务端） */
export function AdminDeleteButton({
  kind,
  id,
  title,
  userName,
  afterDelete = "refresh",
  className,
}: AdminDeleteButtonProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const remove = async () => {
    setDeleting(true)
    try {
      const res = await fetch("/api/admin/submissions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(kind === "paper" ? "已删除整份套卷的作答记录" : "已删除该作答记录")
        setOpen(false)
        if (afterDelete === "back") router.push("/admin/submissions")
        else router.refresh()
      } else {
        toast.error(json.error || "删除失败")
      }
    } catch {
      toast.error("删除失败，请稍后重试")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 px-2 text-destructive hover:text-destructive", className)}
          disabled={deleting}
        >
          删除
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除 {userName} 的这条作答记录？</AlertDialogTitle>
          <AlertDialogDescription>
            「{title}」
            {kind === "paper" ? "属于套卷提交，会连同整份套卷的作答一起删除。" : "。"}
            删除后无法恢复，对应的得分与 AI 批改结果也会一并清除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          {/* destructive 变体的文字色（text-destructive）对比度只有 3.8:1，这里换成语义上的
              深红/浅红配对（红-800 / 红-300），浅色与深色都 ≥ 4.5:1 */}
          <AlertDialogAction
            variant="destructive"
            className="text-red-800 dark:text-red-300"
            onClick={(e) => {
              e.preventDefault()
              void remove()
            }}
            disabled={deleting}
          >
            {deleting ? "删除中…" : "确认删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
