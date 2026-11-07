import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface QuestionBankRow {
  id: string
  /** 全局序号（跨页连续，便于对照「题库里第几条」） */
  no: number
  title: string
  subject: string
  /** 题型中文名（questionTypeLabel 结果）——列表里只展示题型，类别与题型大多重复，不再单列 */
  typeLabel: string
  /** 单题数（GroupItem 数量） */
  itemCount: number
  score: number
  /** 更新时间（已格式化） */
  updatedAt: string
}

/**
 * 题组列表表格：只读展示 + 进入编辑页 / 前台预览。
 * 只显示题型（类别与题型基本一一对应，重复显示没有信息量）；不显示封面。
 */
export function QuestionBankTable({ rows }: { rows: QuestionBankRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">序号</TableHead>
            <TableHead>标题</TableHead>
            <TableHead className="w-[70px]">学科</TableHead>
            <TableHead className="w-[120px]">题型</TableHead>
            <TableHead className="w-[70px] text-center">单题数</TableHead>
            <TableHead className="w-[70px] text-center">分值</TableHead>
            <TableHead className="w-[140px]">更新时间</TableHead>
            <TableHead className="w-[180px] text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="transition-colors hover:bg-muted/50">
              <TableCell className="tabular-nums text-muted-foreground">{row.no}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <Link
                    href={`/admin/questions/${row.id}`}
                    className="block max-w-[420px] truncate font-medium hover:text-primary"
                  >
                    {row.title}
                  </Link>
                  <span className="truncate text-xs text-muted-foreground">{row.id}</span>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">{row.subject}</TableCell>
              <TableCell className="whitespace-nowrap">{row.typeLabel}</TableCell>
              <TableCell className="text-center tabular-nums">{row.itemCount}</TableCell>
              <TableCell className="text-center tabular-nums">{row.score}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{row.updatedAt}</TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Button asChild size="sm" variant="ghost" className="px-2">
                    <Link href={`/admin/questions/${row.id}`}>编辑</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="px-2">
                    <a href={`/question/${row.id}`} target="_blank" rel="noreferrer">
                      预览
                    </a>
                  </Button>
                  {/* 记录：把修改记录页按该题组标题筛一遍，省得再手动搜 */}
                  <Button asChild size="sm" variant="ghost" className="px-2">
                    <Link href={`/admin/questions/logs?q=${encodeURIComponent(row.title)}`}>记录</Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
