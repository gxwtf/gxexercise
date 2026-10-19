"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
}

/**
 * 作答记录表格 —— 沿用回顾页「提交记录」表格的样式：
 * 圆角边框 + 可点击行（hover 高亮）+ 小圆角药丸状态，不用 Badge 组件。
 */
export function RecordsTable({ rows }: { rows: RecordsRow[] }) {
  const router = useRouter()

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
            <TableHead className="w-[110px] text-left">操作</TableHead>
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
              <TableCell className="text-left">
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={row.practiceHref}>重新练习</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
