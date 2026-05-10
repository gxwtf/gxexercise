'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'

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
  const [answers, setAnswers] = React.useState<Record<string, string>>({})

  const handleInputChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }))
  }

  const components = useMDXComponents()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <EnglishReading startQuestionNumber={1}>
          <MDXRemote {...mdxSource} components={components} />
        </EnglishReading>
      </div>
    </div>
  )
}