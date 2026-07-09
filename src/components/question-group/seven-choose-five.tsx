'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { BlankFillingQuestion } from '@/components/question/BlankFillingQuestion'
import { useBlankFillingLogic } from '@/components/question/BlankFillingLogic'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'
import { useAnswer } from './AnswerContext'

interface SevenChooseFiveQuestion {
  id: string
  stem: string
  type: 'single' | 'multiple'
  options: Array<{ id: string; label: string; labelMdx?: MDXRemoteSerializeResult | null }>
}

interface SevenChooseFiveProps {
  questions: SevenChooseFiveQuestion[]
  mdxSource: MDXRemoteSerializeResult
}

export default function SevenChooseFive({ questions, mdxSource }: SevenChooseFiveProps) {
  const { setAnswer } = useAnswer()
  const options = questions.length > 0 ? questions[0].options : []

  const {
    filledBlanks,
    selectedOption,
    availableOptions,
    handleOptionSelect,
    handleBlankClick,
    handleRemove
  } = useBlankFillingLogic({
    options
  })

  React.useEffect(() => {
    questions.forEach((q, index) => {
      const blankId = String(index + 1)
      const answer = filledBlanks[blankId] || ''
      setAnswer(q.id, { answer })
    })
  }, [filledBlanks, questions, setAnswer])

  const components = useMDXComponents()

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* 左侧文章区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <EnglishReading
            blanks={filledBlanks}
            options={options}
            onBlankClick={handleBlankClick}
            onRemove={handleRemove}
          >
            <MDXRemote {...mdxSource} components={components} />
          </EnglishReading>
        </div>

        {/* 分隔线 */}
        <Separator orientation="vertical" />

        {/* 右侧题目区域 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection title="根据短文内容，从短文后的七个选项中选出能填入空白处的最佳选项。选项中有两项为多余选项。">
            <BlankFillingQuestion
              availableOptions={availableOptions}
              selectedOption={selectedOption}
              onOptionSelect={handleOptionSelect}
            />
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}