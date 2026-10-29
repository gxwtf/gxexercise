"use client"

import { cn } from "@/lib/utils"
import { normalizeChoiceAnswer } from "@/lib/answer-check"
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
  // 选项 id 与答案字母的大小写可能不一致（七选五选项 id 常是大写 A-G、答案却录成小写 a-g；
  // 数学 / 语文则相反：选项 id 小写、答案大写），统一规范化后再比较，否则正确选项不会标绿。
  // 同时兼容 "B,D" / "B D" / "bd" 等写法（去分隔符、压空格、全角转半角）。
  const userLetters = [...normalizeChoiceAnswer(userAnswer ?? "")]
  const correctLetters = [...normalizeChoiceAnswer(correctAnswer)]
  const userLettersKey = [...userLetters].sort().join("")
  const correctLettersKey = [...correctLetters].sort().join("")
  const isCorrect = userLettersKey.length > 0 && userLettersKey === correctLettersKey
  const layoutType = getLayoutType(options)

  const gridClass =
    layoutType === "vertical"
      ? "flex flex-col gap-3"
      : layoutType === "two-columns"
        ? "grid grid-cols-2 gap-3"
        : "grid grid-cols-2 gap-3 sm:grid-cols-4"

  return (
    <div className={cn(gridClass, "font-question")}>
      {options.map((option) => {
        const optionKey = normalizeChoiceAnswer(option.id)
        const isSelected = userLetters.includes(optionKey)
        const isCorrectOption = correctLetters.includes(optionKey)

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