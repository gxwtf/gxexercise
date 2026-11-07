"use client"

// 「题组正文」板块：阅读材料 / 语料 / 提示语，直接编辑 Markdown 源码。
//
// 与「基本信息」共用同一份题组草稿（QuestionGroupEditor 管），保存时按字段 diff 提交；
// 所以这里点保存会把基础信息里未保存的改动一起存掉，反之亦然。

import * as React from "react"
import { Loader2, RotateCcw, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface GroupContentFormProps {
  content: string
  onChange: (content: string) => void
  onSave: () => void
  onReset: () => void
  saving: boolean
  dirty: boolean
  disabled?: boolean
}

export function GroupContentForm({
  content,
  onChange,
  onSave,
  onReset,
  saving,
  dirty,
  disabled,
}: GroupContentFormProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">题组正文</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            题组的阅读材料 / 完形语料 / 提示语（Markdown + 公式 + 题库私有标签），前台渲染时作为整块的「材料」显示。
          </p>
        </div>
        {dirty ? <Badge variant="secondary">有未保存的改动</Badge> : <Badge variant="outline">已同步</Badge>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="group-content">Markdown 源码</Label>
          <span className="text-xs text-muted-foreground">{content.length} 字</span>
        </div>
        <Textarea
          id="group-content"
          value={content}
          onChange={(event) => onChange(event.target.value)}
          rows={20}
          className="min-h-[26rem] font-mono text-[13px] leading-6"
          placeholder={"阅读材料 / 语料 / 提示语…\n支持 Markdown、$公式$、<Input> 等题库私有标签。"}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          填空占位用 &lt;Input&gt; / &lt;Input2&gt; / &lt;ClozeBlank&gt;，公式用 $...$；
          原子题（完形 / 七选五等）正文里不要塞选项，选项在「单题」板块维护。
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          改完建议点右上角「前台预览」核对渲染；保存会记入修改记录。
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={!dirty || saving || disabled}>
            <RotateCcw />
            重置
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={!dirty || saving || disabled}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {saving ? "保存中…" : "保存正文"}
          </Button>
        </div>
      </div>
    </section>
  )
}
