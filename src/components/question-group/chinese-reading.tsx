'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { ChoiceField } from '@/components/question/ChoiceField'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents, MathInput2Provider } from '@/mdx-components'
import { useAnswer } from './AnswerContext'

interface ChineseReadingQuestion {
  id: string
  stem: string
  stemMdx?: MDXRemoteSerializeResult | null
  type: 'single' | 'multiple' | 'text' | 'input'
  subStem?: string
  options?: Array<{ id: string; label: string; labelMdx?: MDXRemoteSerializeResult | null }>
}

interface ChineseReadingProps {
  questions: ChineseReadingQuestion[]
  mdxSource: MDXRemoteSerializeResult
}

export default function ChineseReading({ questions, mdxSource }: ChineseReadingProps) {
  const { setAnswer } = useAnswer()
  const [textAnswers, setTextAnswers] = React.useState<Record<string, string>>({})
  const inputValuesRef = React.useRef<Record<number, string>>({})

  const choiceQuestions = questions.filter(q => q.type === 'single' || q.type === 'multiple')
  const otherQuestions = questions.filter(q => q.type === 'text' || q.type === 'input')

  const onChoiceChange = (questionId: string, selected: string[]) => {
    const answer = selected.length === 1 ? selected[0] : selected.join(',')
    setAnswer(questionId, { answer })
  }

  const handleInputChange = React.useCallback((index: number, value: string) => {
    inputValuesRef.current[index] = value
    const buildAnswer = (qId: string) => {
      const values: string[] = []
      Object.keys(inputValuesRef.current).sort().forEach((key) => {
        values.push(inputValuesRef.current[Number(key)])
      })
      const textValue = textAnswers[qId] || ''
      return textValue ? `${values.join(',')}\n\n${textValue}` : values.join(',')
    }
    const inputQuestions = questions.filter(q => q.type === 'input')
    inputQuestions.forEach((inputQ) => {
      setAnswer(inputQ.id, { answer: buildAnswer(inputQ.id) })
    })
    const textQuestions = questions.filter(q => q.type === 'text')
    textQuestions.forEach((textQ) => {
      setAnswer(textQ.id, { answer: buildAnswer(textQ.id) })
    })
  }, [questions, setAnswer, textAnswers])

  const handleAnswerChange = (questionId: string, value: string) => {
    setTextAnswers(prev => ({ ...prev, [questionId]: value }))
    const values: string[] = []
    Object.keys(inputValuesRef.current).sort().forEach((key) => {
      values.push(inputValuesRef.current[Number(key)])
    })
    const combined = values.length > 0 ? `${values.join(',')}\n\n${value}` : value
    setAnswer(questionId, { answer: combined })
  }

  const baseComponents = useMDXComponents()

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-screen">
        <div className="flex-1 overflow-y-auto p-6">
          <EnglishReading indentParagraphs>
            <MDXRemote {...mdxSource} components={baseComponents} />
          </EnglishReading>
        </div>

        <Separator orientation="vertical" />

        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection>
            {choiceQuestions.length > 0 && (
              <ChoiceField
                questions={choiceQuestions as any}
                onChange={onChoiceChange}
              />
            )}

            {otherQuestions.map((question) => {
              const globalIndex = questions.indexOf(question)
              return (
                <div key={question.id} className="space-y-3 mt-8">
                  <div className="flex items-start space-x-2">
                    <span className="text-lg font-medium text-gray-700">{globalIndex + 1}.</span>
                    <div className="flex-1">
                      {question.type === 'input' ? (
                        <MathInput2Provider onInputChange={handleInputChange}>
                          {question.stemMdx ? (
                            <div className="text-lg font-medium text-gray-900">
                              <MDXRemote {...question.stemMdx} components={baseComponents} />
                            </div>
                          ) : (
                            <p className="text-lg font-medium text-gray-900">{question.stem}</p>
                          )}
                        </MathInput2Provider>
                      ) : (
                        <MathInput2Provider onInputChange={handleInputChange}>
                          {question.stemMdx ? (
                            <div className="text-lg font-medium text-gray-900">
                              <MDXRemote {...question.stemMdx} components={baseComponents} />
                            </div>
                          ) : (
                            <p className="text-lg font-medium text-gray-900">{question.stem}</p>
                          )}
                        </MathInput2Provider>
                      )}
                      {question.subStem && (
                        <p className="mt-2 text-lg text-gray-700 italic">{question.subStem}</p>
                      )}
                    </div>
                  </div>

                  {question.type === 'text' && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="请输入你的答案..."
                        value={textAnswers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        className="min-h-48 resize-y text-lg md:text-lg"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}