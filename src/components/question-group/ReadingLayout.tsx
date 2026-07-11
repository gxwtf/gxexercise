'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { MathInput2Provider, useMDXComponents } from '@/mdx-components'

export interface ReadingLayoutProps {
  mdxSource: MDXRemoteSerializeResult
  children: React.ReactNode
  indentParagraphs?: boolean
  startQuestionNumber?: number
  onInlineInputChange?: (index: number, value: string) => void
}

export function ReadingLayout({
  mdxSource,
  children,
  indentParagraphs = true,
  startQuestionNumber,
  onInlineInputChange,
}: ReadingLayoutProps) {
  const components = useMDXComponents()

  return (
    <div className="overflow-hidden bg-background">
      <div className="flex">
        <div className="flex-1 overflow-y-auto p-6">
          <EnglishReading
            indentParagraphs={indentParagraphs}
            startQuestionNumber={startQuestionNumber}
          >
            <MathInput2Provider onInputChange={onInlineInputChange}>
              <MDXRemote {...mdxSource} components={components} />
            </MathInput2Provider>
          </EnglishReading>
        </div>

        <Separator orientation="vertical" />

        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection>
            {children}
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}
