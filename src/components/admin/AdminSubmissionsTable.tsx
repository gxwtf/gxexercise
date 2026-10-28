import Link from "next/link"
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

export interface AdminSubmissionRow {
  id: string
  /** 答题时间（已格式化） */
  time: string
  userName: string
  userId: number
  subject: string
  title: string
  subtitle: string
  /** 得分 / 总分（已格式化） */
  score: string
  pending: boolean
  detailHref: string
}

/** 管理员提交记录表格：只读，点整行进入作答详情 */
export function AdminSubmissionsTable({ rows }: { rows: AdminSubmissionRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[70px]">序号</TableHead>
            <TableHead className="w-[140px]">答题时间</TableHead>
            <TableHead className="w-[170px]">用户</TableHead>
            <TableHead className="w-[70px]">学科</TableHead>
            <TableHead>试卷 / 题组</TableHead>
            <TableHead className="w-[110px]">得分 / 总分</TableHead>
            <TableHead className="w-[90px] text-center">状态</TableHead>
            <TableHead className="w-[80px] text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.id} className="transition-colors hover:bg-muted/50">
              <TableCell className="font-medium">{index + 1}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{row.time}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="block max-w-[160px] truncate">{row.userName}</span>
                  <span className="text-xs text-muted-foreground">#{row.userId}</span>
                </div>
              </TableCell>
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
                <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                  <Link href={row.detailHref}>查看</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
