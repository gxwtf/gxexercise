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
  /** 指定列数（图片题：四个选项固定排一行） */
  columns?: number
}

/** 控件（单选圆圈/多选框）加间距约占的宽度 */
const CONTROL_W = 24
/** 列间距，对应 gap-x-8 */
const GAP = 32
/** 只允许 4 / 2 / 1 列，避免出现「一行三个」的不整齐排版 */
const CANDIDATES = [4, 2, 1]

/**
 * 判断选项内容是否发生换行。
 * 用「元素高度 / 行高」估算行数，而不是 Range 的行盒数量——
 * 后者会被 KaTeX 的上下标（同一行里不同 top 的盒子）误判成多行。
 */
function isWrapped(el: HTMLElement): boolean {
  if (!el) return false
  const cs = getComputedStyle(el)
  let lineH = parseFloat(cs.lineHeight)
  if (!Number.isFinite(lineH)) lineH = parseFloat(cs.fontSize) * 1.6 || 24
  const h = el.getBoundingClientRect().height
  if (!h || !lineH) return false
  return h / lineH > 2.2   // 明显超过两行才认为换行（KaTeX/段落边距会把单行撑高，阈值太敏感会误降列数）
}

/**
 * 参考 exam-zh 的 choices 环境：用真实渲染宽度决定列数（\settowidth 的等价做法）。
 * 1. 隐藏的 nowrap 副本量出每个选项的自然宽度 → 由宽度推算可行列数（4/2/1）
 * 2. 渲染后再检查：多列时只要有选项换行（哪怕只多出一个字），就降一档
 *    4 → 2 → 1，最终保证「不留零碎换行」
 * 3. ResizeObserver 跟随容器宽度重算
 */
/** 首帧（SSR / 水合前）按选项文字长度先给个合理列数，避免一律 1 列 */
function estimateCols(options: Option[]): number {
  if (options.length < 2) return 1
  const lens = options.map((o) => String(o.label || "").replace(/\s+/g, "").length)
  const maxLen = Math.max(...lens)
  const avgLen = lens.reduce((a, b) => a + b, 0) / lens.length
  const widest = Math.max(maxLen, avgLen * 1.2)
  if (options.length === 4) {
    if (widest <= 10) return 4
    if (widest <= 24) return 2
    return 1
  }
  if (widest <= 8) return Math.min(options.length, 4)
  if (widest <= 20) return Math.min(options.length, 2)
  return 1
}

function useOptionColumns(options: Option[], deps: unknown[]) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const measureRef = useRef<HTMLDivElement | null>(null)
  const [cols, setCols] = useState(() => estimateCols(options))

  const measureWidest = useCallback(() => {
    const box = measureRef.current
    if (!box) return 0
    const items = Array.from(box.querySelectorAll<HTMLElement>("[data-measure-item]"))
    if (!items.length) return 0
    // +10px 余量：FieldLabel 的 padding/gap、字距等都会吃掉几个像素，
    // 不留余量会出现「差一点点就换行」甚至单词溢出选框
    return Math.max(...items.map((el) => el.offsetWidth)) + CONTROL_W + 10
  }, [])

  const widestByWidth = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return 1
    const avail = wrap.clientWidth
    const widest = measureWidest()
    if (!avail || !widest) return 1
    return CANDIDATES.find((n) => n <= options.length && n * widest + (n - 1) * GAP <= avail) ?? 1
  }, [measureWidest, options.length])

  // 首帧：按宽度粗定列数
  useLayoutEffect(() => {
    setCols(widestByWidth())
  }, [widestByWidth, ...deps])

  // 渲染后：多列时若任一选项换行，降一档（4 → 2 → 1）
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || cols <= 1) return
    const labels = Array.from(wrap.querySelectorAll<HTMLElement>("[data-opt-label]"))
    const wrapped = labels.some(
      (el) => isWrapped(el) || el.scrollWidth > el.clientWidth + 1   // 换行 或 单词溢出选框
    )
    if (wrapped) {
      setCols((prev) => (prev >= 4 ? 2 : 1))
    }
  })

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => setCols(widestByWidth()))
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [widestByWidth])

  return { wrapRef, measureRef, cols }
}

export function ChoiceQuestion({ type, options, onChange, value, columns }: ChoiceQuestionProps) {
  const [selected, setSelected] = useState<string[]>(value ?? [])
  const components = useMDXComponents()
  const auto = useOptionColumns(options, [type])
  const { wrapRef, measureRef } = auto
  const cols = columns && columns > 0 ? Math.min(columns, options.length || columns) : auto.cols

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
              <FieldContent className="min-w-0">
                <div data-opt-label className="min-w-0">{renderOptionLabel(option)}</div>
              </FieldContent>
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
