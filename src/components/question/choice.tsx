"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'

type Option = {
  id: string
  label: string
  labelMdx?: MDXRemoteSerializeResult | null
}

type ChoiceType = 'single' | 'multiple' | 'indeterminate'
type LayoutType = 'vertical' | 'two-columns' | 'four-columns'

interface ChoiceQuestionProps {
  type: ChoiceType
  options: Option[]
  onChange: (selected: string[]) => void
}

// 判断选项长度的函数
function getLayoutType(options: Option[]): LayoutType {
  const totalChars = options.reduce((sum, option) => sum + option.label.length, 0)
  const avgChars = totalChars / options.length
  
  // 长选项：平均长度超过20个字符，纵向排列
  if (avgChars > 20) {
    return 'vertical'
  }
  
  // 短选项：平均长度小于12个字符，四列排列
  if (avgChars < 12) {
    return 'four-columns'
  }
  
  // 中等选项：两列排列
  return 'two-columns'
}

export function ChoiceQuestion({ type, options, onChange }: ChoiceQuestionProps) {
  const [selected, setSelected] = useState<string[]>([])
  const layoutType = getLayoutType(options)
  const components = useMDXComponents()

  const handleMultipleChange = (id: string, checked: boolean) => {
    const newSelected = checked ? [...selected, id] : selected.filter(s => s !== id)
    setSelected(newSelected)
    onChange(newSelected)
  }

  const handleSingleChange = (value: string) => {
    setSelected([value])
    onChange([value])
  }

  // 渲染选项标签
  const renderOptionLabel = (option: Option) => {
    if (option.labelMdx) {
      return (
        <FieldTitle className="text-base">
          <MDXRemote {...option.labelMdx} components={components} />
        </FieldTitle>
      )
    }
    return <FieldTitle className="text-base whitespace-nowrap">{option.label}</FieldTitle>
  }

  // 渲染选项的通用函数
  const renderOptions = (renderItem: (option: Option) => React.ReactNode) => {
    if (layoutType === 'vertical') {
      // 一题一行：纵向排列
      return (
        <div className="space-y-3">
          {options.map(renderItem)}
        </div>
      )
    } else if (layoutType === 'two-columns') {
      // 一题两行：A、B一行，C、D一行
      const firstRow = options.slice(0, 2)
      const secondRow = options.slice(2, 4)
      
      return (
        <div className="space-y-3">
          <div className="flex gap-6">
            {firstRow.map(renderItem)}
          </div>
          {secondRow.length > 0 && (
            <div className="flex gap-6">
              {secondRow.map(renderItem)}
            </div>
          )}
        </div>
      )
    } else {
      // 一题一行四列：横向排列
      return (
        <div className="flex flex-wrap gap-4">
          {options.map(renderItem)}
        </div>
      )
    }
  }

  // 单选组件
  const renderSingleChoice = () => {
    return (
      <RadioGroup value={selected[0] || ''} onValueChange={handleSingleChange}>
        {renderOptions((option) => (
          <FieldLabel key={option.id} className={layoutType === 'four-columns' ? 'flex-1 min-w-0' : ''}>
            <Field orientation="horizontal" className="!items-center">
              <RadioGroupItem value={option.id} id={option.id} />
              <FieldContent>
                {renderOptionLabel(option)}
              </FieldContent>
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    )
  }

  // 多选组件
  const renderMultipleChoice = () => {
    return (
      <div>
        {renderOptions((option) => (
          <FieldLabel key={option.id} className={layoutType === 'four-columns' ? 'flex-1 min-w-0' : ''}>
            <Field orientation="horizontal" className="!items-center">
              <Checkbox
                id={option.id}
                checked={selected.includes(option.id)}
                onCheckedChange={(checked) => handleMultipleChange(option.id, checked as boolean)}
              />
              <FieldContent>
                {renderOptionLabel(option)}
              </FieldContent>
            </Field>
          </FieldLabel>
        ))}
      </div>
    )
  }

  return type === 'single' ? renderSingleChoice() : renderMultipleChoice()
}