'use client'

import { useRef, useCallback } from 'react'
import { ChoiceField } from '@/components/question/ChoiceField'
import { AnswerQuestion } from '@/components/question/AnswerQuestion'
import { ReadingLayout } from '@/components/question-group/ReadingLayout'
import { QuestionSection } from '@/components/QuestionSection'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents, MathInput2Provider } from '@/mdx-components'
import { useAnswer } from './AnswerContext'

interface ProblemQuestion {
  id: string
  stem: string
  stemMdx?: MDXRemoteSerializeResult | null
  type: 'single' | 'multiple' | 'input' | 'text'
  subStem?: string
  options?: Array<{ id: string; label: string; labelMdx?: MDXRemoteSerializeResult | null }>
}

interface ProblemProps {
  questions: ProblemQuestion[]
  mdxSource?: MDXRemoteSerializeResult | null
  language?: 'zh' | 'en'
  minHeight?: string
  indentParagraphs?: boolean
  startQuestionNumber?: number
  showWordCount?: boolean
}

export default function Problem({
  questions,
  mdxSource,
  language = 'zh',
  minHeight,
  indentParagraphs = true,
  startQuestionNumber,
  showWordCount = false,
}: ProblemProps) {
  const { setAnswer } = useAnswer()
  const components = useMDXComponents()
  const inputValuesRef = useRef<Record<string, Record<number, string>>>({})

  const textQuestions = questions.filter(q => q.type === 'text')

  const onChoiceChange = (questionId: string, selected: string[]) => {
    const answer = selected.length === 1 ? selected[0] : selected.join(',')
    setAnswer(questionId, { answer })
  }

  const onInputChange = useCallback((questionId: string, index: number, value: string) => {
    if (!inputValuesRef.current[questionId]) {
      inputValuesRef.current[questionId] = {}
    }
    inputValuesRef.current[questionId][index] = value
    const values = Object.values(inputValuesRef.current[questionId]).sort()
    setAnswer(questionId, { answer: values.join(',') })
  }, [setAnswer])

  const hasArticle = !!mdxSource
  const isSingleTextQuestion = !hasArticle && questions.length === 1 && textQuestions.length === 1

  const segments: Array<{ type: 'choice'; questions: ProblemQuestion[]; startIndex: number } | { type: 'input' | 'text'; question: ProblemQuestion; index: number }> = []
  let i = 0
  while (i < questions.length) {
    const q = questions[i]
    if (q.type === 'single' || q.type === 'multiple') {
      const group: ProblemQuestion[] = []
      const startIndex = i
      while (i < questions.length && (questions[i].type === 'single' || questions[i].type === 'multiple')) {
        group.push(questions[i])
        i++
      }
      segments.push({ type: 'choice', questions: group, startIndex })
    } else {
      segments.push({ type: q.type as 'input' | 'text', question: q, index: i })
      i++
    }
  }

  const body = (
    <>
      {segments.map((seg) => {
        if (seg.type === 'choice') {
          return (
            <ChoiceField
              key={seg.questions[0].id}
              questions={seg.questions as any}
              startIndex={seg.startIndex}
              onChange={onChoiceChange}
            />
          )
        }
        if (seg.type === 'input') {
          const question = seg.question
          return (
            <div key={question.id} className="space-y-3">
              <div className="flex items-start space-x-2">
                <span className="text-lg font-medium text-gray-700">{seg.index + 1}.</span>
                <div className="flex-1">
                  <div className="text-lg font-medium text-gray-900">
                    {question.stemMdx ? (
                      <MathInput2Provider onInputChange={(idx, val) => onInputChange(question.id, idx, val)}>
                        <MDXRemote {...question.stemMdx} components={components} />
                      </MathInput2Provider>
                    ) : (
                      <p>{question.stem}</p>
                    )}
                  </div>
                  {question.subStem && (
                    <p className="mt-2 text-lg text-gray-700 italic">{question.subStem}</p>
                  )}
                </div>
              </div>
            </div>
          )
        }
        return (
          <AnswerQuestion
            key={seg.question.id}
            question={seg.question}
            index={seg.index + 1}
            language={language}
            minHeight={minHeight}
            showWordCount={showWordCount}
            showIndex={!isSingleTextQuestion}
          />
        )
      })}
    </>
  )

  if (hasArticle) {
    return (
      <ReadingLayout
        mdxSource={mdxSource!}
        indentParagraphs={indentParagraphs}
        startQuestionNumber={startQuestionNumber}
      >
        {body}
      </ReadingLayout>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-background font-question">
      <div className="flex h-screen">
        <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto">
          <QuestionSection>
            {body}
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}