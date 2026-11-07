"use client"

// 题组信息表单：标题 / 学科 / 类别 / 题型 / 年级 / 来源 / 分值 / 作答模式 / 标签 / 正文（Markdown）
//
// 纯展示 + 受控组件：草稿状态、保存、重置都在 QuestionGroupEditor 里，
// 这样页面标题、右侧概览都能跟着草稿实时变化。

import * as React from "react"
import { Loader2, RotateCcw, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TagsInput } from "@/components/admin/question-bank/TagsInput"
import type { GroupFormValues } from "@/components/admin/question-bank/types"
import { ANSWER_MODE_META, questionTypeLabel, questionTypeOptionsFor } from "@/lib/question-bank-meta"
import { categoriesBySubject, subjects } from "@/constants/subjects"

interface GroupMetaFormProps {
  values: GroupFormValues
  onChange: (patch: Partial<GroupFormValues>) => void
  onSave: () => void
  onReset: () => void
  saving: boolean
  dirty: boolean
  /** 保存成功 / 重置后 +1，用于重置 TagsInput 的输入框文本 */
  syncKey: number
  disabled?: boolean
}

export function GroupMetaForm({
  values,
  onChange,
  onSave,
  onReset,
  saving,
  dirty,
  syncKey,
  disabled,
}: GroupMetaFormProps) {
  const typeOptions = questionTypeOptionsFor("group", values.questionType)
  const categoryOptions = categoriesBySubject[values.subject] ?? []
  const categoryListId = React.useId()

  return (
    <Card>
      <CardHeader>
        <CardTitle>题组信息</CardTitle>
        <CardDescription>
          标题、标签、封面等元信息影响题库列表与筛选；正文是题组的阅读材料 / 语料（Markdown + 公式）。
        </CardDescription>
        <CardAction>
          {dirty ? (
            <Badge variant="secondary">有未保存的改动</Badge>
          ) : (
            <Badge variant="outline">已同步</Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="group-title">
            标题 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="group-title"
            value={values.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="如：2024 北京海淀高三一模 · 阅读理解 C 篇"
            maxLength={255}
            disabled={disabled}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="group-subject">学科</Label>
            <Select
              value={values.subject}
              onValueChange={(value) => onChange({ subject: value, category: "" })}
              disabled={disabled}
            >
              <SelectTrigger id="group-subject" className="w-full">
                <SelectValue placeholder="选择学科">{values.subject || undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="group-category">类别</Label>
            <Input
              id="group-category"
              list={categoryListId}
              value={values.category}
              onChange={(event) => onChange({ category: event.target.value })}
              placeholder="选择或直接输入"
              maxLength={100}
              disabled={disabled}
            />
            <datalist id={categoryListId}>
              {categoryOptions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="group-type">题型</Label>
            <Select
              value={values.questionType}
              onValueChange={(value) => onChange({ questionType: value })}
              disabled={disabled}
            >
              <SelectTrigger id="group-type" className="w-full">
                <SelectValue placeholder="选择题型">{questionTypeLabel(values.questionType)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">决定前台用哪套作答与排版组件，改动前请确认。</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="group-answer-mode">作答模式</Label>
            <Select
              value={values.answerMode}
              onValueChange={(value) => onChange({ answerMode: value })}
              disabled={disabled}
            >
              <SelectTrigger id="group-answer-mode" className="w-full">
                <SelectValue placeholder="选择作答模式">
                  {ANSWER_MODE_META.find((option) => option.value === values.answerMode)?.label ?? values.answerMode}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ANSWER_MODE_META.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">「任选一题」用于作文二选一 / 微写作三选一。</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="group-grade">年级</Label>
            <Input
              id="group-grade"
              value={values.grade}
              onChange={(event) => onChange({ grade: event.target.value })}
              placeholder="如：高三"
              maxLength={50}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-source">来源</Label>
            <Input
              id="group-source"
              value={values.source}
              onChange={(event) => onChange({ source: event.target.value })}
              placeholder="如：2024北京海淀高三一模"
              maxLength={200}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-score">题组分值</Label>
            <Input
              id="group-score"
              type="number"
              min={0}
              max={300}
              step={0.5}
              value={values.score}
              onChange={(event) => onChange({ score: event.target.value === "" ? 0 : Number(event.target.value) })}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="group-tags">标签</Label>
          <TagsInput
            key={syncKey}
            id="group-tags"
            value={values.tags}
            onChange={(tags) => onChange({ tags })}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="group-content">题组正文（Markdown）</Label>
            <span className="text-xs text-muted-foreground">{values.content.length} 字</span>
          </div>
          <Textarea
            id="group-content"
            value={values.content}
            onChange={(event) => onChange({ content: event.target.value })}
            rows={14}
            className="min-h-[18rem] font-mono text-[13px] leading-6"
            placeholder="阅读材料 / 语料 / 提示语…&#10;支持 Markdown、$公式$、<Input> 等题库私有标签。"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            直接编辑 Markdown 源码；填空占位用 &lt;Input&gt; / &lt;Input2&gt; / &lt;ClozeBlank&gt;，公式用 $...$。
            保存后可在「前台预览」里核对渲染效果。
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {dirty ? "改动尚未保存；保存会记入修改记录（管理员 + 时间 + 字段改动）。" : "没有未保存的改动。"}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={!dirty || saving || disabled}>
            <RotateCcw />
            重置
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={!dirty || saving || disabled}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {saving ? "保存中…" : "保存题组信息"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
