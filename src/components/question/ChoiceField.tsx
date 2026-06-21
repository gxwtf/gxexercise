"use client"

import { ChoiceQuestion } from "./choice"
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'

type Option = {
  id: string
  label: string
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
}

export function ChoiceField({ questions, onChange }: ChoiceFieldProps) {
  const components = useMDXComponents()

  return (
    <div className="space-y-6">
      {questions.map((question, index) => (
        <div key={question.id} className="space-y-4">
          {question.stem ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-medium">{index + 1}.</span>
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
              />
            </>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-lg font-medium min-w-[30px]">
                {index + 1}.
              </span>
              <ChoiceQuestion
                type={question.type}
                options={question.options}
                onChange={(selected) => onChange(question.id, selected)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}