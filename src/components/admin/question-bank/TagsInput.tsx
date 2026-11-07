"use client"

// 标签输入：文本框里用逗号分隔，下方实时显示解析后的标签（去空白 / 去重）
//
// 注意：内部维护输入框文本，避免「输入逗号就被规范化掉」的光标跳动；
// 外部需要重置（保存成功 / 点重置）时由父组件换 key 重新挂载。

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { parseTagsInput, tagsToInput } from "@/components/admin/question-bank/form-utils"

interface TagsInputProps {
  id?: string
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
}

export function TagsInput({ id, value, onChange, placeholder, disabled }: TagsInputProps) {
  const [text, setText] = React.useState(() => tagsToInput(value))

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    setText(next)
    onChange(parseTagsInput(next))
  }

  return (
    <div className="space-y-1.5">
      <Input
        id={id}
        value={text}
        onChange={handleChange}
        placeholder={placeholder ?? "用逗号分隔，如：英语, 高三, 海淀"}
        disabled={disabled}
      />
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">还没有标签；标签用于题库筛选与搜索。</p>
      )}
    </div>
  )
}
