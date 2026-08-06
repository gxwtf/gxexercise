'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents, MathInput2Provider } from '@/mdx-components'
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
  startQuestionNumber?: number
}

export default function Grammar({ questions, mdxSource, startQuestionNumber = 1 }: GrammarProps) {
  const { setAnswer } = useAnswer()

  const handleInputChange = (questionNumber: string, value: string) => {
    const questionIndex = parseInt(questionNumber) - startQuestionNumber
    const question = questions[questionIndex]
    
    if (question) {
      setAnswer(question.id, {
        answer: value
      })
    }
  }

  const handleInput2Change = React.useCallback((index: number, value: string) => {
    const question = questions[index]
    if (question) {
      setAnswer(question.id, {
        answer: value
      })
    }
  }, [questions, setAnswer])

  const components = useMDXComponents()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <EnglishReading 
          startQuestionNumber={startQuestionNumber}
          onInputChange={handleInputChange}
          indentParagraphs
        >
          <MathInput2Provider onInputChange={handleInput2Change}>
            <div>
              <MDXRemote {...mdxSource} components={components} />
            </div>
          </MathInput2Provider>
        </EnglishReading>
      </div>
    </div>
  )
}