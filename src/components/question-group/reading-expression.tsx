'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'
import { useAnswer } from './AnswerContext'

interface ReadingExpressionQuestion {
  id: string
  stem: string
  stemMdx?: MDXRemoteSerializeResult | null
  type: 'text' | 'input'
  subStem?: string
}

interface ReadingExpressionProps {
  questions: ReadingExpressionQuestion[]
  mdxSource: MDXRemoteSerializeResult
}

export default function ReadingExpression({ questions, mdxSource }: ReadingExpressionProps) {
  const { setAnswer } = useAnswer()
  const [textAnswers, setTextAnswers] = React.useState<Record<string, string>>({})

  const handleAnswerChange = (questionId: string, answer: string) => {
    setTextAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
    setAnswer(questionId, {
      answer: answer
    })
  }

  const components = useMDXComponents()

  return (
    <div className="h-screen overflow-hidden bg-background font-question">
      <div className="flex h-screen">
        {/* 左侧文章区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <EnglishReading>
            <MDXRemote {...mdxSource} components={components} />
          </EnglishReading>
        </div>

        {/* 分隔线 */}
        <Separator orientation="vertical" />

        {/* 右侧题目区域 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection>
            <div className="space-y-8">
              {questions.map((question, index) => (
                <div key={question.id} className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <span className="text-lg font-medium text-gray-700">{index + 1}.</span>
                    <div className="flex-1">
                      {question.stemMdx ? (
                        <div className="text-lg font-medium text-gray-900">
                          <MDXRemote {...question.stemMdx} components={components} />
                        </div>
                      ) : (
                        <p className="text-lg font-medium text-gray-900">{question.stem}</p>
                      )}
                      {question.subStem && (
                        <p className="mt-2 text-lg text-gray-700 italic">{question.subStem}</p>
                      )}
                    </div>
                  </div>
                  
                  <Textarea
                    placeholder="Please write your answer here..."
                    value={textAnswers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    className="min-h-20 resize-y"
                  />
                </div>
              ))}
            </div>
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}