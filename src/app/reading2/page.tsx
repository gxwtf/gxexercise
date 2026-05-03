'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { BlankFillingQuestion } from '@/components/question/BlankFillingQuestion'
import { useBlankFillingLogic } from '@/components/question/BlankFillingLogic'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'
import Reading2Content from '@/content/reading2.mdx'

export default function Reading2Page() {
  // 示例选项（七选五）
  const sampleOptions = [
    { id: 'a', label: 'The Translators without Borders (TWB) Community is a nonprofit helping people get important information and be heard, whatever language they speak.' },
    { id: 'b', label: 'In addition,' },
    { id: 'c', label: 'On the other hand,' },
    { id: 'd', label: 'As a result,' },
    { id: 'e', label: 'Furthermore,' },
    { id: 'f', label: 'However,' },
    { id: 'g', label: 'Therefore,' }
  ]

  // 使用封装的逻辑组件
  const {
    filledBlanks,
    selectedOption,
    availableOptions,
    handleOptionSelect,
    handleBlankClick,
    handleRemove
  } = useBlankFillingLogic({
    options: sampleOptions
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* 左侧文章区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <EnglishReading
            blanks={filledBlanks}
            options={sampleOptions}
            onBlankClick={handleBlankClick}
            onRemove={handleRemove}
          >
            <Reading2Content />
          </EnglishReading>
        </div>

        {/* 分隔线 */}
        <Separator orientation="vertical" />

        {/* 右侧题目区域 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection title="根据短文内容，从短文后的七个选项中选出能填入空白处的最佳选项。选项中有两项为多余选项。">
            <BlankFillingQuestion
              availableOptions={availableOptions}
              selectedOption={selectedOption}
              onOptionSelect={handleOptionSelect}
            />
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}