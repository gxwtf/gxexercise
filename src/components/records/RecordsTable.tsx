"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  /** 整份分析报告 PDF：套卷小节=整卷报告，单节练习=该次作答的题组报告 */
  pdfHref: string
  /** 删除用：group=单节练习记录，paper=整份套卷提交 */
  deleteKind: "group" | "paper"
  deleteId: string
}

/**
 * 作答记录表格 —— 默认不显示多选；
 * 点右上角「多选」后才出现复选框列，并可批量删除。
 */
export function RecordsTable({ rows }: { rows: RecordsRow[] }) {
  const router = useRouter()
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [selectMode, setSelectMode] = React.useState(false)
  const [selected, setSelected] = React.useState<string[]>([])
  const [batchDeleting, setBatchDeleting] = React.useState(false)

  const allSelected = rows.length > 0 && selected.length === rows.length
  const someSelected = selected.length > 0 && !allSelected

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected([])
  }

  const toggleAll = () => setSelected(allSelected ? [] : rows.map((r) => r.id))
  const toggleOne = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const removeOne = async (row: RecordsRow) => {
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

  const removeBatch = async () => {
    const targets = rows.filter((r) => selected.includes(r.id))
    if (targets.length === 0) return
    setBatchDeleting(true)
    try {
      const res = await fetch("/api/submissions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: targets.map((r) => ({ kind: r.deleteKind, id: r.deleteId })) }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`已删除 ${targets.length} 条作答记录`)
        setSelected([])
        router.refresh()
      } else {
        toast.error(json.error || "删除失败")
      }
    } catch {
      toast.error("删除失败，请稍后重试")
    } finally {
      setBatchDeleting(false)
    }
  }

  return (
    <div>
      {/* 工具栏：默认只有「多选」按钮；进入多选后出现批量操作 */}
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2 text-sm">
        {selectMode ? (
          <>
            <Button size="sm" variant="ghost" className="h-7" onClick={toggleAll}>
              {allSelected ? "取消全选" : "全选"}
            </Button>
            <span className="text-muted-foreground">已选 {selected.length} 条</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-destructive hover:text-destructive"
                  disabled={selected.length === 0 || batchDeleting}
                >
                  批量删除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除选中的 {selected.length} 条作答记录？</AlertDialogTitle>
                  <AlertDialogDescription>
                    删除后无法恢复，相关的得分与批改结果也会一并清除。属于套卷提交的记录会连同整份套卷一起删除。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => void removeBatch()}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    确认删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button size="sm" variant="ghost" className="h-7" onClick={exitSelectMode}>
              退出多选
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setSelectMode(true)}>
            <CheckSquare className="size-4" />
            多选
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {selectMode && (
                <TableHead className="w-[40px] text-center">
                  <Checkbox
                    aria-label="全选"
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
              )}
              <TableHead className="w-[80px]">序号</TableHead>
              <TableHead className="w-[140px]">答题时间</TableHead>
              <TableHead className="w-[70px]">学科</TableHead>
              <TableHead>试卷 / 题组</TableHead>
              <TableHead className="w-[120px]">得分 / 总分</TableHead>
              <TableHead className="w-[100px] text-center">状态</TableHead>
              <TableHead className="w-[230px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={row.id}
                onClick={() => (selectMode ? toggleOne(row.id) : router.push(row.detailHref))}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-muted/50",
                  selectMode && selected.includes(row.id) && "bg-muted hover:bg-muted/80"
                )}
              >
                {selectMode && (
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`选择第 ${index + 1} 行`}
                      checked={selected.includes(row.id)}
                      onCheckedChange={() => toggleOne(row.id)}
                    />
                  </TableCell>
                )}
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
                    <Button asChild size="sm" variant="ghost" className="h-7 px-2" onClick={(e) => e.stopPropagation()}>
                      <a href={row.pdfHref} title="导出整份分析报告 PDF">
                        分析报告
                      </a>
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
                              void removeOne(row)
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
    </div>
  )
}
