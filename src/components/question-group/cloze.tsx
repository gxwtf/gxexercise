'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { ChoiceField } from '@/components/question/ChoiceField'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'
import { useAnswer } from './AnswerContext'

interface ClozeQuestion {
  id: string
  stem: string
  type: 'single'
  options: Array<{ id: string; label: string; labelMdx?: MDXRemoteSerializeResult | null }>
}

interface ClozeProps {
  questions: ClozeQuestion[]
  mdxSource: MDXRemoteSerializeResult
}

export default function Cloze({ questions, mdxSource }: ClozeProps) {
  const { setAnswer } = useAnswer()

  const onAnswerChange = (questionId: string, selected: string[]) => {
    const answer = selected.length === 1 ? selected[0] : selected.join(',')
    setAnswer(questionId, { answer })
  }

  const components = useMDXComponents()

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-screen">
        <div className="flex-1 overflow-y-auto p-6">
          <EnglishReading startQuestionNumber={1} indentParagraphs>
            <MDXRemote {...mdxSource} components={components} />
          </EnglishReading>
        </div>

        <Separator orientation="vertical" />

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