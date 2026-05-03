'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import GrammaContent from '@/content/gramma.mdx'

export default function GrammaPage() {
  // 存储用户填写的答案
  const [answers, setAnswers] = React.useState<Record<string, string>>({})

  // 处理输入框变化的函数
  const handleInputChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }))
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <EnglishReading startQuestionNumber={11}>
          <GrammaContent />
        </EnglishReading>
      </div>
    </div>
  )
}