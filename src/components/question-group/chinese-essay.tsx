'use client'

import * as React from 'react'
import { Textarea } from '@/components/ui/textarea'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'
import { QuestionSection } from '@/components/QuestionSection'
import { useAnswer } from './AnswerContext'

interface EssayQuestion {
  id: string
  stem: string
  stemMdx?: MDXRemoteSerializeResult | null
  type: 'text' | 'input'
  subStem?: string
}

interface EssayProps {
  questions: EssayQuestion[]
  mdxSource: MDXRemoteSerializeResult
}

export default function Essay({ questions, mdxSource }: EssayProps) {
  const { setAnswer } = useAnswer()
  const [text, setText] = React.useState('')
  const charCount = text.length

  const questionId = questions[0]?.id ?? 'essay'

  React.useEffect(() => {
    setAnswer(questionId, {
      answer: text,
      wordCount: charCount,
    })
  }, [text, charCount, setAnswer, questionId])

  const components = useMDXComponents()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <QuestionSection>
          <style>{`.article-indent p { text-indent: 2em; }`}</style>
          <div className="article-indent [&>p:first-of-type]:!indent-0">
            <MDXRemote {...mdxSource} components={components} />
          </div>

          <div className="space-y-4 mt-6">
            <Textarea
              placeholder="请在此作答..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-64 text-lg md:text-lg"
            />

            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>字数：{charCount}</span>
            </div>
          </div>
        </QuestionSection>
      </div>
    </div>
  )
}