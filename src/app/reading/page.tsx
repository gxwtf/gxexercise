'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { ChoiceField } from '@/components/question/ChoiceField'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'
import ReadingContent from '@/content/reading.mdx'

export default function ReadingPage() {
  // 示例选择题
  const questions = [
    {
      id: '1',
      stem: 'What does the underlined expression "these workarounds" in Paragraph 4 refer to?',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'High costs.' },
        { id: 'b', label: 'Various methods.' },
        { id: 'c', label: 'Weather systems.' },
        { id: 'd', label: 'Inaccurate results.' }
      ]
    },
    {
      id: '2',
      stem: 'What is Paragraph 5 mainly about?',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'The advantages of artificial intelligence.' },
        { id: 'b', label: 'The application of mathematical equations.' },
        { id: 'c', label: 'The fast collection of historical weather data.' },
        { id: 'd', label: 'The working principles of AI weather models.' }
      ]
    },
    {
      id: '3',
      stem: 'What can we learn from the passage?',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'Decision-makers find AI forecasts more reliable.' },
        { id: 'b', label: 'AI models will eventually replace numerical ones.' },
        { id: 'c', label: 'Lack of relevant weather data challenges AI systems.' },
        { id: 'd', label: 'AI weather models help to prevent extreme climate events.' }
      ]
    },
    {
      id: '4',
      stem: 'What\'s the main purpose of the passage?',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'To raise global climate change awareness.' },
        { id: 'b', label: 'To stress the importance of the historical record.' },
        { id: 'c', label: 'To compare the strengths of weather prediction methods.' },
        { id: 'd', label: 'To suggest a way to improve weather prediction accuracy.' }
      ]
    }
  ]

  // 处理题目选择变化
  const handleAnswerChange = (questionId: string, selected: string[]) => {
    console.log(`Question ${questionId} selected:`, selected)
    // 这里可以添加提交答案的逻辑
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-screen">
        {/* 左侧文章区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <EnglishReading>
            <ReadingContent />
          </EnglishReading>
        </div>

        {/* 分隔线 */}
        <Separator orientation="vertical" />

        {/* 右侧题目区域 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection>
            <ChoiceField questions={questions} onChange={handleAnswerChange} />
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}