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
    <div className="bg-background lg:h-full lg:overflow-hidden">
      <div className="flex flex-col lg:h-full lg:flex-row">
        {/* 移动端：文章在上、题目在下，整页连续滚动 */}
        <div className="w-full p-3 sm:p-6 lg:flex-1 lg:overflow-y-auto">
          <EnglishReading
            indentParagraphs={indentParagraphs}
            startQuestionNumber={startQuestionNumber}
          >
            <MDXRemote {...mdxSource} components={components} />
          </EnglishReading>
        </div>

        <div className="mx-3 my-2 border-t border-border lg:hidden" />
        <Separator orientation="vertical" className="hidden lg:block" />

        <div className="w-full p-3 sm:p-6 lg:flex-1 lg:overflow-y-auto">
          <QuestionSection>
            {children}
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}