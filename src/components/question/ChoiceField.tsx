"use client"

import { ChoiceQuestion } from "./choice"
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'
import { useAnswer } from '@/components/question-group/AnswerContext'

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
            {question.stem ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-medium">{startIndex + index + 1}.</span>
                  <div className="text-lg font-medium">
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
              <div className="flex items-center gap-4">
                <span className="text-lg font-medium min-w-[30px]">
                  {startIndex + index + 1}.
                </span>
                <ChoiceQuestion
                  type={question.type}
                  options={question.options}
                  onChange={(selected) => onChange(question.id, selected)}
                  value={value}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}