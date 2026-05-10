'use client'

import * as React from 'react'
import { Textarea } from '@/components/ui/textarea'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'

interface EnWritingProps {
  mdxSource: MDXRemoteSerializeResult
}

export default function EnWriting({ mdxSource }: EnWritingProps) {
  const [text, setText] = React.useState('')
  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length

  const components = useMDXComponents()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        {/* 题干部分 */}
        <div className="mb-6">
          <MDXRemote {...mdxSource} components={components} />
        </div>
        
        {/* 写作区域 */}
        <div className="space-y-4">
          <Textarea
            placeholder="Please write your email here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-64"
          />
          
          {/* 字数统计 */}
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Word Count: {wordCount}</span>
          </div>
        </div>
      </div>
    </div>
  )
}