"use client"

import { ChoiceQuestion } from "./choice"
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'
import { useAnswer } from '@/components/question-group/AnswerContext'

/** 题干只有一张图（图片版题目）：题号与图片顶端对齐，图片占满内容宽度 */
function isImageOnlyStem(text?: string) {
  if (!text) return false
  const t = text.trim()
  return /^!\[[^\]]*\]\([^)]*\)$/.test(t) || /^<QImg\b[^>]*\/>$/.test(t)
}


type Option = {
  id: string
  label: string
  labelMdx?: MDXRemoteSerializeResult | null
}

type ChoiceType = 'single' | 'multiple' | 'indeterminate'

interface Question {
  id: string
  stem: string
  stemMdx?: MDXRemoteSerializeResult | null
  type: ChoiceType
  options: Option[]
}

interface ChoiceFieldProps {
  questions: Question[]
  onChange: (questionId: string, selected: string[]) => void
  startIndex?: number
}

export function ChoiceField({ questions, onChange, startIndex = 0 }: ChoiceFieldProps) {
  const components = useMDXComponents()
  const { answers } = useAnswer()

  return (
    <div className="space-y-6">
      {questions.map((question, index) => {
        const saved = answers[question.id]?.content.answer as string | undefined
        const value = saved ? (question.type === 'single' ? [saved] : saved.split(',')) : undefined
        return (
          <div key={question.id} className="space-y-4">
            {question.stem?.trim() ? (
              <>
                <div className={isImageOnlyStem(question.stem) ? "flex items-start gap-1" : "flex items-baseline gap-1"}>
                  <span className={isImageOnlyStem(question.stem) ? "shrink-0 text-lg font-medium leading-none pt-[2px]" : "shrink-0 text-lg font-medium"}>{startIndex + index + 1}.</span>
                  <div className={isImageOnlyStem(question.stem) ? "mt-5 min-w-0 flex-1 text-lg font-medium" : "text-lg font-medium"}>
                    {question.stemMdx ? (
                      <MDXRemote {...question.stemMdx} components={components} />
                    ) : (
                      question.stem
                    )}
                  </div>
                </div>
                <ChoiceQuestion
                  type={question.type}
                  options={question.options}
                  onChange={(selected) => onChange(question.id, selected)}
                  value={value}
                />
              </>
            ) : (
              // 没有题干：题号与「第一个选项」顶部对齐（原来 items-center 会垂直居中）
              <div className="flex items-start gap-4">
                <span className="shrink-0 text-lg font-medium leading-7 min-w-[30px]">
                  {startIndex + index + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <ChoiceQuestion
                    type={question.type}
                    options={question.options}
                    onChange={(selected) => onChange(question.id, selected)}
                    value={value}
                    columns={isImageOnlyStem(question.stem) ? 4 : undefined}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}