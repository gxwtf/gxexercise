"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export interface QuestionSwitcherItem {
  index: number
  questionId: string
  status: "correct" | "wrong" | "pending" | "unanswered"
}

interface QuestionSwitcherProps {
  questions: QuestionSwitcherItem[]
  currentIndex: number
  basePath: string
}

export function QuestionSwitcher({ questions, currentIndex, basePath }: QuestionSwitcherProps) {
  const router = useRouter()

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {questions.map((q) => {
        const isCurrent = q.index === currentIndex
        const statusLabel = q.status === "correct"
          ? "正确"
          : q.status === "wrong"
            ? "错误"
            : q.status === "pending"
              ? "待人工评阅"
              : "未作答"

        const baseStyle =
          "w-9 h-9 rounded-md text-sm font-medium transition-colors border flex items-center justify-center hover:opacity-80"

        let buttonStyle: string

        if (isCurrent) {
          if (q.status === "correct") {
            buttonStyle = cn(baseStyle, "bg-green-500 border-green-500 text-white")
          } else if (q.status === "wrong") {
            buttonStyle = cn(baseStyle, "bg-red-500 border-red-500 text-white")
          } else if (q.status === "pending") {
            buttonStyle = cn(baseStyle, "bg-amber-500 border-amber-500 text-white")
          } else {
            buttonStyle = cn(baseStyle, "bg-gray-400 border-gray-400 text-white dark:bg-gray-500 dark:border-gray-500")
          }
        } else {
          if (q.status === "correct") {
            buttonStyle = cn(baseStyle, "bg-transparent border-green-500 text-green-600")
          } else if (q.status === "wrong") {
            buttonStyle = cn(baseStyle, "bg-transparent border-red-500 text-red-600")
          } else if (q.status === "pending") {
            buttonStyle = cn(baseStyle, "bg-transparent border-amber-500 text-amber-600")
          } else {
            buttonStyle = cn(baseStyle, "bg-transparent border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400")
          }
        }

        return (
          <button
            key={q.questionId}
            className={buttonStyle}
            aria-label={`第 ${q.index} 题：${statusLabel}`}
            title={statusLabel}
            onClick={() => router.push(`${basePath}/${q.index}`)}
          >
            {q.index}
          </button>
        )
      })}
    </div>
  )
}
