'use client'

import * as React from 'react'
import { Textarea } from '@/components/ui/textarea'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'
import { useAnswer } from '@/components/question-group/AnswerContext'

export interface AnswerQuestionProps {
  question: {
    id: string
    stem: string
    stemMdx?: MDXRemoteSerializeResult | null
    subStem?: string
  }
  index: number
  language?: 'zh' | 'en'
  minHeight?: string
  placeholder?: string
  showWordCount?: boolean
  wordCountLabel?: string
  showIndex?: boolean
}

export function AnswerQuestion({
  question,
  index,
  language = 'zh',
  minHeight = 'min-h-48',
  placeholder,
  showWordCount = false,
  wordCountLabel,
  showIndex = true,
}: AnswerQuestionProps) {
  const { setAnswer, answers } = useAnswer()
  const savedAnswer = answers[question.id]?.content.answer as string | undefined
  const [text, setText] = React.useState(savedAnswer ?? '')
  const components = useMDXComponents()

  const isEnglish = language === 'en'
  const resolvedPlaceholder = placeholder ?? (isEnglish ? 'Please write your answer here...' : '请在此作答...')
  const resolvedWordCountLabel = wordCountLabel ?? (isEnglish ? 'Word Count' : '字数')
  const count = isEnglish
    ? text.trim().split(/\s+/).filter(w => w.length > 0).length
    : text.length

  const handleTextChange = React.useCallback((value: string) => {
    setText(value)
    const wordCount = isEnglish
      ? value.trim().split(/\s+/).filter(w => w.length > 0).length
      : value.length
    setAnswer(question.id, { answer: value, wordCount })
  }, [question.id, setAnswer, isEnglish])

  return (
    <div className="space-y-3">
      <div className="flex items-start space-x-2">
        {showIndex && <span className="text-lg font-medium text-gray-700">{index}.</span>}
        <div className="flex-1">
          {question.stemMdx ? (
            <div className="text-lg font-medium text-gray-900">
              <MDXRemote {...question.stemMdx} components={components} />
            </div>
          ) : (
            <p className="text-lg font-medium text-gray-900">{question.stem}</p>
          )}
          {question.subStem && (
            <p className="mt-2 text-lg text-gray-700 italic">{question.subStem}</p>
          )}
        </div>
      </div>

      <Textarea
        placeholder={resolvedPlaceholder}
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        className={`resize-y text-lg md:text-lg ${minHeight}`}
      />

      {showWordCount && (
        <div className="text-sm text-muted-foreground">
          <span>{resolvedWordCountLabel}：{count}</span>
        </div>
      )}
    </div>
  )
}