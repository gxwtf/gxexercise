"use client"

// 「基本信息」板块：标题 / 学科 / 类别 / 题型 / 作答模式 / 年级 / 来源 / 分值 / 标签
//
// 受控组件：草稿、保存、重置都在 QuestionGroupEditor 里（题组正文是同一份草稿的另一个板块），
// 保存时按字段 diff 提交，所以任一板块点保存都会把本页所有未保存的题组字段一起存好。

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
  /** 封面区域（并进同一张卡片，放在标签之后） */
  coverSlot?: React.ReactNode
  /** 题组分值：只读展示，由服务端从小题分值合计而来（取整） */
  derivedScore: number
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
  coverSlot,
  derivedScore,
}: GroupMetaFormProps) {
  const typeOptions = questionTypeOptionsFor("group", values.questionType)
  const categoryOptions = categoriesBySubject[values.subject] ?? []
  const categoryListId = React.useId()

  return (
    <Card>
      <CardHeader>
        <CardTitle>题组信息</CardTitle>
        <CardDescription>
          标题、分类、标签与封面等元信息决定题库列表与筛选里的展示。
        </CardDescription>
        <CardAction>
          {dirty ? <Badge variant="secondary">有未保存的改动</Badge> : <Badge variant="outline">已同步</Badge>}
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
            <Label htmlFor="group-score-readonly">题组分值</Label>
            {/* 只读：由小题分值自动合计（服务端在小题保存时重算），不在这里手改 */}
            <div
              id="group-score-readonly"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-input bg-muted/40 px-2.5 text-sm"
            >
              <span className="font-medium">{derivedScore} 分</span>
              <span className="text-xs text-muted-foreground">自动合计</span>
            </div>
            <p className="text-xs text-muted-foreground">由各小题分值合计（取整）；改单题分值在「小题」板块。</p>
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

        {coverSlot}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          保存会一并提交本页其他板块里未保存的题组字段，并记入修改记录。
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={!dirty || saving || disabled}>
            <RotateCcw />
            重置
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={!dirty || saving || disabled}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {saving ? "保存中…" : "保存基本信息"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
