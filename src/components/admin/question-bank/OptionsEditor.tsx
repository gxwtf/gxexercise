"use client"

// 选项编辑器：一行一个选项（ID + 内容），支持增删。
// 与数据库一致的形状是 [{ id, label }]：id 是学生作答里存的字母（a/b/c 或 A/B/C），
// **改 id 会影响已有作答的判分**，所以界面上保留可编辑并把提示写清楚。

import * as React from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { QuestionOption } from "@/components/admin/question-bank/types"

interface OptionsEditorProps {
  value: QuestionOption[] | null
  onChange: (next: QuestionOption[] | null) => void
  disabled?: boolean
}

/** 新增选项时猜一个 id：已有选项全是小写就用小写字母，否则用大写（英语完形 a/b/c、七选五 A-G） */
function nextOptionId(options: QuestionOption[]): string {
  const ids = options.map((o) => o.id.trim()).filter(Boolean)
  const allLower = ids.length > 0 && ids.every((id) => id === id.toLowerCase())
  const pool = allLower ? "abcdefghijklmnopqrstuvwxyz" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  for (const ch of pool) {
    if (!ids.includes(ch)) return ch
  }
  return String(ids.length + 1)
}

export function OptionsEditor({ value, onChange, disabled }: OptionsEditorProps) {
  if (!value) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">该题没有选项（填空 / 主观题通常不需要）。</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([{ id: "a", label: "" }])}
        >
          <Plus />
          添加选项
        </Button>
      </div>
    )
  }

  const update = (index: number, patch: Partial<QuestionOption>) => {
    onChange(value.map((option, i) => (i === index ? { ...option, ...patch } : option)))
  }

  const remove = (index: number) => {
    const next = value.filter((_, i) => i !== index)
    onChange(next.length ? next : null)
  }

  const add = () => {
    onChange([...value, { id: nextOptionId(value), label: "" }])
  }

  const ids = value.map((o) => o.id.trim())
  const duplicated = ids.some((id, i) => id !== "" && ids.indexOf(id) !== i)

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {value.map((option, index) => (
          <div key={index} className="flex items-start gap-2">
            <Input
              value={option.id}
              onChange={(event) => update(index, { id: event.target.value })}
              className="mt-0.5 w-14 shrink-0 font-mono text-center"
              aria-label={`选项 ${index + 1} 的 ID`}
              disabled={disabled}
            />
            <Textarea
              value={option.label}
              onChange={(event) => update(index, { label: event.target.value })}
              rows={2}
              className="min-h-16 flex-1"
              placeholder="选项内容（支持 Markdown / 公式）"
              aria-label={`选项 ${index + 1} 的内容`}
              disabled={disabled}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="mt-1 text-muted-foreground hover:text-destructive"
              onClick={() => remove(index)}
              aria-label={`删除选项 ${index + 1}`}
              disabled={disabled}
            >
              <X />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" size="sm" variant="outline" onClick={add} disabled={disabled || value.length >= 20}>
          <Plus />
          添加选项
        </Button>
        <p className="text-xs text-muted-foreground">
          共 {value.length} 个选项；选项 ID 是学生作答里保存的字母，改动会影响历史作答的判分。
        </p>
      </div>
      {duplicated && <p className="text-xs text-destructive">选项 ID 有重复，保存前请先改成唯一值。</p>}
    </div>
  )
}
