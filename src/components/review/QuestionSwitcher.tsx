"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export interface QuestionSwitcherItem {
  index: number
  questionId: string
  status: "correct" | "wrong" | "unanswered" | "reviewing"
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

        const baseStyle =
          "w-9 h-9 rounded-md text-sm font-medium transition-colors border flex items-center justify-center hover:opacity-80"

        let buttonStyle: string

        if (isCurrent) {
          if (q.status === "correct") {
            buttonStyle = cn(baseStyle, "border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500 dark:text-green-950")
          } else if (q.status === "wrong") {
            buttonStyle = cn(baseStyle, "border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-500 dark:text-red-950")
          } else if (q.status === "reviewing") {
            buttonStyle = cn(baseStyle, "border-amber-500 bg-amber-500 text-amber-950 dark:border-amber-400 dark:bg-amber-400 dark:text-amber-950")
          } else {
            buttonStyle = cn(baseStyle, "border-border bg-muted text-foreground")
          }
        } else {
          if (q.status === "correct") {
            buttonStyle = cn(baseStyle, "border-green-600 bg-transparent text-green-700 dark:border-green-500 dark:text-green-400")
          } else if (q.status === "wrong") {
            buttonStyle = cn(baseStyle, "border-red-600 bg-transparent text-red-700 dark:border-red-500 dark:text-red-400")
          } else if (q.status === "reviewing") {
            buttonStyle = cn(baseStyle, "border-amber-500 bg-transparent text-amber-700 dark:border-amber-400 dark:text-amber-300")
          } else {
            buttonStyle = cn(baseStyle, "border-border bg-transparent text-muted-foreground")
          }
        }

        return (
          <button
            key={q.questionId}
            className={buttonStyle}
            onClick={() => router.push(`${basePath}/${q.index}`)}
          >
            {q.index}
          </button>
        )
      })}
    </div>
  )
}