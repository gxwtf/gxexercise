'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'

export interface ReadingLayoutProps {
  mdxSource: MDXRemoteSerializeResult
  children: React.ReactNode
  indentParagraphs?: boolean
  startQuestionNumber?: number
}

export function ReadingLayout({
  mdxSource,
  children,
  indentParagraphs = true,
  startQuestionNumber,
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
            <MDXRemote {...mdxSource} components={components} />
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