"use client"

// 管理页的「返回」按钮：样式与行为对齐答题页（QuestionGroupHeader）的返回按钮
//   - ghost + ChevronLeft + 「返回」；
//   - 有未保存修改时先弹确认（对齐答题页「放弃作答并返回」）；
//   - 优先回到浏览器上一页（能带回列表页的筛选/页码），没有历史才回题库管理列表。

import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
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

interface AdminBackButtonProps {
  /** 当前页是否有未保存的修改（有则返回前弹确认） */
  dirty: boolean
  /** 没有浏览器历史时的兜底页面 */
  fallbackHref: string
  /** 确认弹窗里的对象名，用于提示文案 */
  subject?: string
}

export function AdminBackButton({ dirty, fallbackHref, subject }: AdminBackButtonProps) {
  const router = useRouter()

  // 答题页的做法：优先回上一页，没有历史才回列表
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back()
    else router.push(fallbackHref)
  }

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0 gap-1 px-2"
      title={dirty ? "放弃未保存的修改并返回" : "返回"}
    >
      <ChevronLeft className="size-4" />
      返回
    </Button>
  )

  if (!dirty) {
    return (
      <Button variant="ghost" size="sm" className="shrink-0 gap-1 px-2" title="返回" onClick={goBack}>
        <ChevronLeft className="size-4" />
        返回
      </Button>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>离开编辑页？</AlertDialogTitle>
          <AlertDialogDescription>
            {subject ? `「${subject}」` : "当前题组"}还有未保存的修改，返回后这些修改会丢失；已保存的内容不受影响。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>继续编辑</AlertDialogCancel>
          <AlertDialogAction onClick={goBack}>放弃并返回</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
