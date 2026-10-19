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
 * 选项排版按标准试卷样式：
 * - 四个「短选项」（纯数字/符号/短词，无图片）→ 宽屏一行 4 个
 * - 其余（长句、含公式、含图片）→ 每行 2 个（A B / C D），手机上 1 个
 * 固定列数（1 / 2 / 4），不再出现「一行三个」这种不整齐的情况。
 */
function gridClass(options: Option[]): string {
  const plain = (t: string) => t.replace(/\$[^$]*\$/g, "XX").replace(/!\[[^\]]*\]\([^)]*\)/g, "IMG")
  const compact =
    options.length === 4 &&
    options.every((o) => !/!\[/.test(o.label) && plain(o.label).length <= 12)
  return compact
    ? "grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4"
    : "grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2"
}

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
    <div className={gridClass(options)}>
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
