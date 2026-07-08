"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface SubmissionHistoryItem {
  id: string
  answer: string
  isCorrect: boolean
  createdAt: Date
}

interface SubmissionHistoryTableProps {
  submissions: SubmissionHistoryItem[]
  questionIndex: number
  questionType: string
}

export function SubmissionHistoryTable({ submissions, questionIndex: _questionIndex, questionType }: SubmissionHistoryTableProps) {
  if (submissions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        暂无作答记录
      </div>
    )
  }

  const isChoiceType = questionType.includes("选择") || questionType.includes("七选五")

  const formatDate = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[80px]">序号</TableHead>
          <TableHead>我的答案</TableHead>
          <TableHead className="w-[100px]">是否正确</TableHead>
          <TableHead className="text-right">答题时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {submissions.map((submission, index) => (
          <TableRow key={submission.id}>
            <TableCell className="font-medium">{index + 1}</TableCell>
            <TableCell>{isChoiceType ? submission.answer.toUpperCase() : submission.answer}</TableCell>
            <TableCell>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  submission.isCorrect
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                )}
              >
                {submission.isCorrect ? "正确" : "错误"}
              </span>
            </TableCell>
            <TableCell className="text-right">{formatDate(submission.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}