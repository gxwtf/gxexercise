'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { ChoiceQuestion } from '@/components/question/choice'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'

export default function ReadingPage() {
  // 示例文章内容
  const sampleContent = [
    'Artificial intelligence (AI) is transforming various industries at an unprecedented pace. From healthcare to finance, AI technologies are revolutionizing how we work and live.',
    <React.Fragment key="machine-learning">
      One of the most significant developments in AI is{' '}
      <span className="underline decoration-sky-500 underline-offset-2 font-semibold">
        machine learning
      </span>
      , which allows computers to learn from data without being explicitly programmed. This technology powers everything from recommendation systems to autonomous vehicles.
    </React.Fragment>,
    'However, the rapid advancement of AI also raises important ethical questions. Issues such as data privacy, algorithmic bias, and job displacement need to be carefully considered as we move forward.',
    'Despite these challenges, the potential benefits of AI are enormous. In healthcare, AI can help diagnose diseases earlier and more accurately. In education, it can provide personalized learning experiences for students. And in environmental science, AI can help us better understand and address climate change.',
    'As we continue to develop and implement AI technologies, it is crucial that we do so responsibly and ethically, ensuring that these powerful tools benefit all of humanity.',
  ]

  // 示例选择题
  const sampleQuestion = {
    id: '1',
    type: 'single' as const,
    question: '1. What is the main topic of this article?',
    options: [
      { id: 'a', label: 'The history of AI' },
      { id: 'b', label: 'The future of AI' },
      { id: 'c', label: 'AI in healthcare' },
      { id: 'd', label: 'Ethical issues in AI' }
    ]
  }

  // 处理题目选择变化
  const handleAnswerChange = (questionId: string, selected: string[]) => {
    console.log(`Question ${questionId} selected:`, selected)
    // 这里可以添加提交答案的逻辑
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* 左侧文章区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <EnglishReading 
            title="The Future of Artificial Intelligence" 
            content={sampleContent}
            className="max-w-none"
          />
        </div>

        {/* 分隔线 */}
        <Separator orientation="vertical" />

        {/* 右侧题目区域 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection>
            <div>
              <h3 className="font-semibold mb-3">{sampleQuestion.question}</h3>
              <ChoiceQuestion
                type={sampleQuestion.type}
                options={sampleQuestion.options}
                onChange={(selected) => handleAnswerChange(sampleQuestion.id, selected)}
              />
            </div>
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}