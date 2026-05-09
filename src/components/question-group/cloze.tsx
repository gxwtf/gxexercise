'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { ChoiceField } from '@/components/question/ChoiceField'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'
import ClozeContent from '@/content/cloze.mdx'

interface ClozeQuestion {
  id: string
  stem: string
  type: 'single'
  options: Array<{ id: string; label: string }>
}

interface ClozeProps {
  questions: ClozeQuestion[]
}

export default function Cloze({ questions }: ClozeProps) {
  const onAnswerChange = (questionId: string, selected: string[]) => {
    console.log(`Question ${questionId} selected:`, selected);
  }
  // 提取题目ID列表
  const questionIds = questions.map(q => q.id)

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-screen">
        {/* 左侧文章区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <EnglishReading startQuestionNumber={Number(questionIds[0])}>
            <ClozeContent />
          </EnglishReading>
        </div>

        {/* 分隔线 */}
        <Separator orientation="vertical" />

        {/* 右侧题目区域 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection>
            <ChoiceField 
              questions={questions} 
              onChange={onAnswerChange} 
            />
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}