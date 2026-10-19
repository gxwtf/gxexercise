"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
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

/** 控件（单选圆圈/多选框）加间距约占的宽度 */
const CONTROL_W = 24
/** 列间距，对应 gap-x-8 */
const GAP = 32
/** 只允许 4 / 2 / 1 列，避免出现「一行三个」的不整齐排版 */
const CANDIDATES = [4, 2, 1]

/**
 * 参考 exam-zh 的 choices 环境：它用 \settowidth 实测每个选项的宽度再决定列数，
 * 这里同样用真实渲染宽度测量（而不是数汉字/字符）：
 *   1. 用一个隐藏的 nowrap 副本量出每个选项的自然宽度
 *   2. 从 4 列往下试，取「最宽选项也能放下」的最大列数
 *   3. 只取 4 / 2 / 1 三档；长选项自然落到 1 列（独占一行，放不下才换行）
 */
function useOptionColumns(options: Option[], deps: unknown[]) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const measureRef = useRef<HTMLDivElement | null>(null)
  const [cols, setCols] = useState(1)

  const compute = useCallback(() => {
    const wrap = wrapRef.current
    const box = measureRef.current
    if (!wrap || !box) return
    const avail = wrap.clientWidth
    if (!avail) return
    const items = Array.from(box.querySelectorAll<HTMLElement>("[data-measure-item]"))
    if (!items.length) return
    const widest = Math.max(...items.map((el) => el.offsetWidth)) + CONTROL_W
    const fits = CANDIDATES.find(
      (n) => n <= options.length && n * widest + (n - 1) * GAP <= avail
    )
    setCols(fits ?? 1)
  }, [options.length])

  useLayoutEffect(() => { compute() }, [compute, ...deps])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => compute())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [compute])

  return { wrapRef, measureRef, cols }
}

export function ChoiceQuestion({ type, options, onChange, value }: ChoiceQuestionProps) {
  const [selected, setSelected] = useState<string[]>(value ?? [])
  const components = useMDXComponents()
  const { wrapRef, measureRef, cols } = useOptionColumns(options, [type])

  const handleMultipleChange = (id: string, checked: boolean) => {
    const newSelected = checked ? [...selected, id] : selected.filter(s => s !== id)
    setSelected(newSelected)
    onChange(newSelected)
  }

  const handleSingleChange = (value: string) => {
    setSelected([value])
    onChange([value])
  }

  // 选项内容：允许换行、长公式/长单词可断行，图片限高
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
    <div ref={wrapRef} className="relative min-w-0">
      {/* 隐藏的测量层：nowrap 量出每个选项的自然宽度 */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 -z-10 h-0 overflow-hidden opacity-0"
      >
        {options.map((option) => (
          <span
            key={option.id}
            data-measure-item
            className="inline-block whitespace-nowrap px-0 text-base"
          >
            {option.labelMdx ? <MDXRemote {...option.labelMdx} components={components} /> : option.label}
          </span>
        ))}
      </div>

      <div
        className="grid min-w-0 gap-x-8 gap-y-2.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <FieldLabel key={option.id} className="min-w-0">
            <Field orientation="horizontal" className="!items-start">
              <span className="mt-[0.3rem] shrink-0">{control(option)}</span>
              <FieldContent className="min-w-0">{renderOptionLabel(option)}</FieldContent>
            </Field>
          </FieldLabel>
        ))}
      </div>
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
