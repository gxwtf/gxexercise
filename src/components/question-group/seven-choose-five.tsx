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
  startQuestionNumber?: number
}

export default function SevenChooseFive({ questions, mdxSource, startQuestionNumber }: SevenChooseFiveProps) {
  const { setAnswer, answers } = useAnswer()
  const options = questions.length > 0 ? questions[0].options : []

  const {
    filledBlanks,
    selectedOption,
    availableOptions,
    handleOptionSelect,
    handleBlankClick,
    handleRemove,
    setFilledBlanks,
  } = useBlankFillingLogic({
    options
  })

  React.useEffect(() => {
    const restored: Record<string, string> = {}
    questions.forEach((q, index) => {
      const saved = answers[q.id]?.content.answer as string | undefined
      if (saved) {
        restored[String(index + 1)] = saved
      }
    })
    if (Object.keys(restored).length > 0) {
      setFilledBlanks(restored)
    }
  }, [])

  React.useEffect(() => {
    questions.forEach((q, index) => {
      const blankId = String(index + 1)
      const answer = filledBlanks[blankId] || ''
      setAnswer(q.id, { answer })
    })
  }, [filledBlanks, questions, setAnswer])

  const components = useMDXComponents()

  return (
    <div className="font-question bg-background lg:h-full lg:overflow-hidden">
      <div className="flex flex-col lg:h-full lg:flex-row">
        {/* 文章区域（移动端在上方） */}
        <div className="w-full p-3 sm:p-6 lg:flex-1 lg:overflow-y-auto">
          <EnglishReading
            indentParagraphs
            blanks={filledBlanks}
            options={options}
            onBlankClick={handleBlankClick}
            onRemove={handleRemove}
            startQuestionNumber={startQuestionNumber}
          >
            <MDXRemote {...mdxSource} components={components} />
          </EnglishReading>
        </div>

        {/* 分隔线：移动端横线、桌面端竖线 */}
        <div className="mx-3 my-2 border-t border-border lg:hidden" />
        <Separator orientation="vertical" className="hidden lg:block" />

        {/* 题目区域（移动端在下方） */}
        <div className="w-full p-3 sm:p-6 lg:flex-1 lg:overflow-y-auto">
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