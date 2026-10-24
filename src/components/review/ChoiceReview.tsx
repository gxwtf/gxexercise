"use client"

import { cn } from "@/lib/utils"
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'

type Option = {
  id: string
  label: string
  labelMdx?: MDXRemoteSerializeResult | null
}

type LayoutType = "vertical" | "two-columns" | "four-columns"

interface ChoiceReviewProps {
  options: Option[]
  correctAnswer: string
  userAnswer: string | null
}

function getLayoutType(options: Option[]): LayoutType {
  const totalChars = options.reduce((sum, option) => sum + option.label.length, 0)
  const avgChars = totalChars / options.length

  if (avgChars > 20) {
    return "vertical"
  }

  if (avgChars < 12) {
    return "four-columns"
  }

  return "two-columns"
}

export function ChoiceReview({ options, correctAnswer, userAnswer }: ChoiceReviewProps) {
  const components = useMDXComponents()
  // 答案大小写可能不一致（选项 id 是小写 a/b/c/d，正确答案常见大写 A/B/C/D）——统一按小写比较
  const norm = (v: string) => v.trim().toLowerCase()
  const userAnswers = userAnswer ? userAnswer.split(',').map(norm) : []
  const correctAnswers = correctAnswer.split(',').map(norm)
  const sortedUser = [...userAnswers].sort().join(',')
  const sortedCorrect = [...correctAnswers].sort().join(',')
  const isCorrect = userAnswer !== null && sortedUser === sortedCorrect
  const layoutType = getLayoutType(options)

  const gridClass =
    layoutType === "vertical"
      ? "flex flex-col gap-3"
      : layoutType === "two-columns"
        ? "grid grid-cols-2 gap-3"
        : "grid grid-cols-2 gap-3 sm:grid-cols-4"

  return (
    <div className={gridClass}>
      {options.map((option) => {
        const isSelected = userAnswers.includes(option.id)
        const isCorrectOption = correctAnswers.includes(option.id)

        let style: string

        if (isCorrect && isSelected) {
          style =
            "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
        } else if (!isCorrect && isSelected) {
          style =
            "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
        } else if (!isCorrect && isCorrectOption) {
          style =
            "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
        } else if (userAnswer === null && isCorrectOption) {
          style =
            "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
        } else {
          style =
            "border-border bg-muted/40 text-muted-foreground"
        }

        return (
          <div
            key={option.id}
            className={cn(
              "rounded-lg border px-4 py-2 text-base",
              style
            )}
          >
            {/^[A-Za-z]$/.test(option.id) ? (
              <span className="font-medium">{option.id.toUpperCase()}.</span>
            ) : (
              <span className="font-medium">{option.id.toUpperCase()}</span>
            )}{" "}
            {option.labelMdx ? (
              <MDXRemote
                {...option.labelMdx}
                components={{
                  ...components,
                  p: (props) => <span>{props.children}</span>,
                }}
              />
            ) : (
              option.label
            )}
          </div>
        )
      })}
    </div>
  )
}