'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { ChoiceField } from '@/components/question/ChoiceField'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'
import { useAnswer } from './AnswerContext'

/**
 * 英语阅读题目接口定义
 */
interface EnReadingQuestion {
  id: string
  stem: string
  type: 'single'
  options: Array<{ id: string; label: string; labelMdx?: MDXRemoteSerializeResult | null }>
}

/**
 * EnReading 组件属性接口
 */
interface EnReadingProps {
  questions: EnReadingQuestion[]
  mdxSource: MDXRemoteSerializeResult
}

/**
 * 英语阅读理解题型组件
 * 
 * 该组件实现英语阅读题目的左右分栏布局：
 * - 左侧：文章阅读区域（MDX 渲染）
 * - 右侧：选择题答题区域
 * 
 * @param questions - 题目列表
 * @param mdxSource - 序列化后的 MDX 文章内容
 * @returns JSX 元素
 */
export default function EnReading({ questions, mdxSource }: EnReadingProps) {
  // 获取答案状态管理方法
  const { setAnswer } = useAnswer()

  /**
   * 处理答案变化的回调函数
   * 
   * @param questionId - 题目 ID
   * @param selected - 用户选择的选项 ID 数组
   */
  const onAnswerChange = (questionId: string, selected: string[]) => {
    // 如果只有一个选项，直接使用选项值；否则用逗号连接多个选项
    const answer = selected.length === 1 ? selected[0] : selected.join(',')
    // 将答案保存到全局状态
    setAnswer(questionId, { answer })
  }

  // 获取 MDX 组件映射配置
  const components = useMDXComponents()

  // 渲染左右分栏布局
  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-screen">
        {/* 左侧文章阅读区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <EnglishReading indentParagraphs>
            {/* 使用 MDXRemote 渲染文章内容 */}
            <MDXRemote {...mdxSource} components={components} />
          </EnglishReading>
        </div>

        {/* 垂直分隔线 */}
        <Separator orientation="vertical" />

        {/* 右侧题目答题区域 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection>
            {/* 选择题组件 */}
            <ChoiceField
              questions={questions}
              onChange={onAnswerChange}
            />
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}