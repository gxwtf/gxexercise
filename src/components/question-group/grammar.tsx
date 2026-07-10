'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'
import { useAnswer } from './AnswerContext'

interface GrammarQuestion {
  id: string
  stem: string
  type: 'input'
  answer: string
}

interface GrammarProps {
  questions: GrammarQuestion[]
  mdxSource: MDXRemoteSerializeResult
}

export default function Grammar({ questions, mdxSource }: GrammarProps) {
  const { setAnswer } = useAnswer()

  const handleInputChange = (questionNumber: string, value: string) => {
    // 根据题号找到对应的题目
    const questionIndex = parseInt(questionNumber) - 1
    const question = questions[questionIndex]
    
    if (question) {
      setAnswer(question.id, {
        answer: value
      })
    }
  }

  const components = useMDXComponents()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <EnglishReading 
          startQuestionNumber={1}
          onInputChange={handleInputChange}
          indentParagraphs
        >
          <MDXRemote {...mdxSource} components={components} />
        </EnglishReading>
      </div>
    </div>
  )
}