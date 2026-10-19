"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface RecordsRow {
  id: string
  time: string
  subject: string
  title: string
  subtitle: string
  /** 得分文案；未批改时为空 */
  score: string
  pending: boolean
  /** 查看结果 / 查看回顾的地址 */
  detailHref: string
  /** 重新练习的地址 */
  practiceHref: string
  /** 删除用：group=单节练习记录，paper=整份套卷提交 */
  deleteKind: "group" | "paper"
  deleteId: string
}

/**
 * 作答记录表格 —— 沿用回顾页「提交记录」表格的样式：
 * 圆角边框 + 可点击行（hover 高亮）+ 小圆角药丸状态，不用 Badge 组件。
 */
export function RecordsTable({ rows }: { rows: RecordsRow[] }) {
  const router = useRouter()
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const remove = async (row: RecordsRow) => {
    setDeletingId(row.deleteId)
    try {
      const res = await fetch("/api/submissions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: row.deleteKind, id: row.deleteId }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(row.deleteKind === "paper" ? "已删除该套卷作答记录" : "已删除该作答记录")
        router.refresh()
      } else {
        toast.error(json.error || "删除失败")
      }
    } catch {
      toast.error("删除失败，请稍后重试")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">序号</TableHead>
            <TableHead className="w-[140px]">答题时间</TableHead>
            <TableHead className="w-[70px]">学科</TableHead>
            <TableHead>试卷 / 题组</TableHead>
            <TableHead className="w-[120px]">得分 / 总分</TableHead>
            <TableHead className="w-[100px] text-center">状态</TableHead>
            <TableHead className="w-[110px] text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={row.id}
              onClick={() => router.push(row.detailHref)}
              className="cursor-pointer transition-colors hover:bg-muted/50"
            >
              <TableCell className="font-medium">{index + 1}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{row.time}</TableCell>
              <TableCell className="whitespace-nowrap">{row.subject}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="block max-w-[360px] truncate">{row.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{row.subtitle}</span>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap font-medium">
                {row.pending ? (
                  <span className="text-amber-700 dark:text-amber-400">待批改</span>
                ) : (
                  row.score
                )}
              </TableCell>
              <TableCell className="text-center">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    row.pending
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  )}
                >
                  {row.pending ? "批改中" : "已批改"}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={row.practiceHref}>重新练习</Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={(e) => e.stopPropagation()}
                        disabled={deletingId === row.deleteId}
                      >
                        删除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>删除这条作答记录？</AlertDialogTitle>
                        <AlertDialogDescription>
                          {row.deleteKind === "paper"
                            ? "这条记录属于套卷提交，会把整份套卷的作答一起删除，且无法恢复。"
                            : "删除后无法恢复，对应的得分与批改结果也会一并清除。"}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => {
                            e.stopPropagation()
                            void remove(row)
                          }}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          确认删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
