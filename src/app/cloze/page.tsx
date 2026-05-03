'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { ChoiceField } from '@/components/question/ChoiceField'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'
import ClozeContent from '@/content/cloze.mdx'

export default function ClozePage() {
  // 示例选择题
  const questions = [
    {
      id: '1',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'walker' },
        { id: 'b', label: 'climber' },
        { id: 'c', label: 'coach' },
        { id: 'd', label: 'rescuer' }
      ]
    },
    {
      id: '2',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'safer' },
        { id: 'b', label: 'faster' },
        { id: 'c', label: 'harder' },
        { id: 'd', label: 'smoother' }
      ]
    },
    {
      id: '3',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'plan' },
        { id: 'b', label: 'track' },
        { id: 'c', label: 'accept' },
        { id: 'd', label: 'complete' }
      ]
    },
    {
      id: '4',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'torn' },
        { id: 'b', label: 'hurt' },
        { id: 'c', label: 'serious' },
        { id: 'd', label: 'excited' }
      ]
    },
    {
      id: '5',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'sad' },
        { id: 'b', label: 'calm' },
        { id: 'c', label: 'scared' },
        { id: 'd', label: 'lucky' }
      ]
    },
    {
      id: '6',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'fix' },
        { id: 'b', label: 'kick' },
        { id: 'c', label: 'break' },
        { id: 'd', label: 'reach' }
      ]
    },
    {
      id: '7',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'doubted' },
        { id: 'b', label: 'comforted' },
        { id: 'c', label: 'satisfied' },
        { id: 'd', label: 'disappointed' }
      ]
    },
    {
      id: '8',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'run out' },
        { id: 'b', label: 'give in' },
        { id: 'c', label: 'take hold' },
        { id: 'd', label: 'break down' }
      ]
    },
    {
      id: '9',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'nodded' },
        { id: 'b', label: 'cleared' },
        { id: 'c', label: 'raised' },
        { id: 'd', label: 'clouded' }
      ]
    },
    {
      id: '10',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'aching' },
        { id: 'b', label: 'moving' },
        { id: 'c', label: 'shaking' },
        { id: 'd', label: 'twisting' }
      ]
    },
    {
      id: '11',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'left' },
        { id: 'b', label: 'made' },
        { id: 'c', label: 'missed' },
        { id: 'd', label: 'changed' }
      ]
    },
    {
      id: '12',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'relieved' },
        { id: 'b', label: 'nervous' },
        { id: 'c', label: 'hesitant' },
        { id: 'd', label: 'regretful' }
      ]
    },
    {
      id: '13',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'joy' },
        { id: 'b', label: 'honesty' },
        { id: 'c', label: 'pride' },
        { id: 'd', label: 'strength' }
      ]
    },
    {
      id: '14',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'surprise' },
        { id: 'b', label: 'gratitude' },
        { id: 'c', label: 'curiosity' },
        { id: 'd', label: 'confidence' }
      ]
    },
    {
      id: '15',
      stem: '',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'mixed' },
        { id: 'b', label: 'dropped' },
        { id: 'c', label: 'shifted' },
        { id: 'd', label: 'darkened' }
      ]
    }
  ];

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
            <ClozeContent />
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