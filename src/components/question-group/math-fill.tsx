'use client'

import * as React from 'react'
import { QuestionSection } from '@/components/QuestionSection'
import { ChoiceQuestion } from '@/components/question/choice'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents, MathInput2Provider } from '@/mdx-components'
import { useAnswer } from './AnswerContext'

interface MathFillQuestion {
  id: string
  stem: string
  stemMdx?: MDXRemoteSerializeResult | null
  type: 'text' | 'input' | 'single' | 'multiple'
  subStem?: string
  options?: Array<{ id: string; label: string; labelMdx?: MDXRemoteSerializeResult | null }>
}

interface MathFillProps {
  questions: MathFillQuestion[]
}

export default function MathFill({ questions }: MathFillProps) {
  const { setAnswer } = useAnswer()
  const questionIds = React.useRef(questions.map(q => q.id))

  const handleInputChange = React.useCallback((index: number, value: string) => {
    const questionId = questionIds.current[index]
    if (questionId) {
      setAnswer(questionId, { answer: value })
    }
  }, [setAnswer])

  const handleChoiceChange = React.useCallback((questionId: string, selected: string[]) => {
    const sorted = [...selected].sort()
    const answer = selected.length === 1 ? selected[0] : sorted.join(',')
    setAnswer(questionId, { answer })
  }, [setAnswer])

  const components = useMDXComponents()

  return (
    <div className="h-screen overflow-hidden bg-background font-question">
      <div className="flex h-screen">
        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection>
            <div className="space-y-8">
              {questions.map((question, index) => (
                <div key={question.id} className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <span className="text-lg font-medium text-gray-700">{index + 1}.</span>
                    <div className="flex-1">
                      {question.type === 'multiple' && question.options ? (
                        <>
                          {question.stemMdx ? (
                            <div className="text-lg font-medium text-gray-900">
                              <MDXRemote {...question.stemMdx} components={components} />
                            </div>
                          ) : (
                            <p className="text-lg font-medium text-gray-900">{question.stem}</p>
                          )}
                          <div className="mt-3">
                            <ChoiceQuestion
                              type="multiple"
                              options={question.options}
                              onChange={(selected) => handleChoiceChange(question.id, selected)}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="text-lg font-medium text-gray-900">
                          {question.stemMdx ? (
                            <MathInput2Provider onInputChange={handleInputChange}>
                              <MDXRemote {...question.stemMdx} components={components} />
                            </MathInput2Provider>
                          ) : (
                            <p>{question.stem}</p>
                          )}
                        </div>
                      )}
                      {question.subStem && (
                        <p className="mt-2 text-lg text-gray-700 italic">{question.subStem}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}