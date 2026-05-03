'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import Reading3Content from '@/content/reading3.mdx'

export default function Reading3Page() {
  // 阅读表达题目
  const questions = [
    {
      id: '53',
      stem: 'Why did the author choose chemistry as his college major?',
      type: 'text' as const
    },
    {
      id: '54',
      stem: 'When did the author begin to question his belief about not being suited for a Ph. D.?',
      type: 'text' as const
    },
    {
      id: '55',
      stem: 'Please decide which part is false in the following statement, then underline it and explain why.',
      subStem: '➢ The author decided to pursue a Ph. D. because he failed in the job interview.',
      type: 'text' as const
    },
    {
      id: '56',
      stem: 'Do you think it\'s necessary for people to love what they do? Why or why not? (In about 40 words)',
      type: 'text' as const
    }
  ]

  // 存储用户答案
  const [answers, setAnswers] = React.useState<Record<string, string>>({})

  // 处理答案变化
  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-screen">
        {/* 左侧文章区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <EnglishReading>
            <Reading3Content />
          </EnglishReading>
        </div>

        {/* 分隔线 */}
        <Separator orientation="vertical" />

        {/* 右侧题目区域 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection>
            <div className="space-y-8">
              {questions.map((question) => (
                <div key={question.id} className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <span className="text-lg font-medium text-gray-700">{question.id}.</span>
                    <div className="flex-1">
                      <p className="text-lg font-medium text-gray-900">{question.stem}</p>
                      {question.subStem && (
                        <p className="mt-2 text-base text-gray-700 italic">{question.subStem}</p>
                      )}
                    </div>
                  </div>
                  
                  <Textarea
                    placeholder="Please write your answer here..."
                    value={answers[question.id] || ''}
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