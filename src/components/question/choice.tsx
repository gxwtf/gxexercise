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

interface ChoiceQuestionProps {
  type: ChoiceType
  options: Option[]
  onChange: (selected: string[]) => void
  value?: string[]
}

/**
 * 选项排版不用再按字数猜列数：
 * 用一个自适应网格 —— 每列至少 14rem，能排几列就排几列，
 * 长选项自然换行（不再溢出边框），窄屏自动变一列。
 */
const OPTION_GRID =
  "grid gap-x-6 gap-y-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]"

export function ChoiceQuestion({ type, options, onChange, value }: ChoiceQuestionProps) {
  const [selected, setSelected] = useState<string[]>(value ?? [])
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

  // 选项内容：允许换行、允许长公式/长单词断行，图片限高
  const renderOptionLabel = (option: Option) => {
    const cls =
      "block min-w-0 text-base leading-relaxed whitespace-normal break-words " +
      "[&_img]:inline-block [&_img]:max-h-16 [&_img]:w-auto [&_img]:align-middle"
    if (option.labelMdx) {
      return (
        <FieldTitle className={cls}>
          <MDXRemote {...option.labelMdx} components={components} />
        </FieldTitle>
      )
    }
    return <FieldTitle className={cls}>{option.label}</FieldTitle>
  }

  const renderOptions = (control: (option: Option) => React.ReactNode) => (
    <div className={OPTION_GRID}>
      {options.map((option) => (
        <FieldLabel key={option.id} className="min-w-0">
          <Field orientation="horizontal" className="!items-start">
            <span className="mt-[0.3rem] shrink-0">{control(option)}</span>
            <FieldContent className="min-w-0">
              {renderOptionLabel(option)}
            </FieldContent>
          </Field>
        </FieldLabel>
      ))}
    </div>
  )

  const renderSingleChoice = () => (
    <RadioGroup value={selected[0] || ''} onValueChange={handleSingleChange}>
      {renderOptions((option) => (
        <RadioGroupItem value={option.id} id={option.id} />
      ))}
    </RadioGroup>
  )

  const renderMultipleChoice = () => (
    <div>
      {renderOptions((option) => (
        <Checkbox
          id={option.id}
          checked={selected.includes(option.id)}
          onCheckedChange={(checked) => handleMultipleChange(option.id, checked as boolean)}
        />
      ))}
    </div>
  )

  return type === 'single' ? renderSingleChoice() : renderMultipleChoice()
}
