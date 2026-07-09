'use client'

import * as React from 'react'
import { ChoiceField } from '@/components/question/ChoiceField'
import { QuestionSection } from '@/components/QuestionSection'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'
import { useAnswer } from './AnswerContext'

interface MathChoiceQuestion {
  id: string
  stem: string
  stemMdx?: MDXRemoteSerializeResult | null
  type: 'single'
  options: Array<{ id: string; label: string; labelMdx?: MDXRemoteSerializeResult | null }>
}

interface MathChoiceProps {
  questions: MathChoiceQuestion[]
}

export default function MathChoice({ questions }: MathChoiceProps) {
  const { setAnswer } = useAnswer()

  const onAnswerChange = (questionId: string, selected: string[]) => {
    const answer = selected.length === 1 ? selected[0] : selected.join(',')
    setAnswer(questionId, { answer })
  }

  const components = useMDXComponents()

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-screen">
        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection>
            <ChoiceField
              questions={questions}
              onChange={onAnswerChange}
            />
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}