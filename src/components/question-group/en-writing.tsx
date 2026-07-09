'use client'

import * as React from 'react'
import { Textarea } from '@/components/ui/textarea'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'
import { QuestionSection } from '@/components/QuestionSection'
import { useAnswer } from './AnswerContext'

interface EnWritingQuestion {
  id: string
  stem: string
  stemMdx?: MDXRemoteSerializeResult | null
  type: 'text' | 'input'
  subStem?: string
}

interface EnWritingProps {
  questions: EnWritingQuestion[]
  mdxSource: MDXRemoteSerializeResult
}

export default function EnWriting({ questions, mdxSource }: EnWritingProps) {
  const { setAnswer } = useAnswer()
  const [text, setText] = React.useState('')
  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length

  const questionId = questions[0]?.id ?? 'writing'

  React.useEffect(() => {
    setAnswer(questionId, {
      answer: text,
      wordCount
    })
  }, [text, wordCount, setAnswer, questionId])

  const components = useMDXComponents()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        {/* 题干部分 */}
        <QuestionSection>
          <MDXRemote {...mdxSource} components={components} />

          {/* 写作区域 */}
          <div className="space-y-4">
            <Textarea
              placeholder="Please write your answer here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-64 text-lg md:text-lg"
            />

            {/* 字数统计 */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Word Count: {wordCount}</span>
            </div>
          </div>
        </QuestionSection>
      </div>
    </div>
  )
}