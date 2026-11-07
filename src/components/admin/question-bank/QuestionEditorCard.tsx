"use client"

// 单道单题编辑器（题组下的一个 GroupItem）
//
// 折叠态只显示题号 / 题型 / 分值 / 题干摘要，展开后编辑题型、正文、选项、答案、解析等。
// 每道单题独立保存（PATCH /api/admin/question-bank/questions/[id]），保存后刷新服务端数据。

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, Loader2, RotateCcw, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { OptionsEditor } from "@/components/admin/question-bank/OptionsEditor"
import type { GroupEditorQuestion, QuestionFormValues } from "@/components/admin/question-bank/types"
import {
  QUESTION_FORM_KEYS,
  hasChanges,
  pickChangedFields,
  validateQuestionDraft,
} from "@/components/admin/question-bank/form-utils"
import { questionStemPreview, questionTypeLabel, questionTypeOptionsFor } from "@/lib/question-bank-meta"
import { categoriesBySubject } from "@/constants/subjects"

interface QuestionEditorCardProps {
  question: GroupEditorQuestion
  index: number
  /** 所属学科（决定「类别」的候选值） */
  subject: string
  expanded: boolean
  onToggle: () => void
  /** 通知父组件「这道题是否有未保存改动」，用于离开页面时提示 */
  onDirtyChange?: (questionId: string, dirty: boolean) => void
}

/** 复制一份草稿（数组要深拷贝，否则会和 props 共享引用） */
function cloneValues(values: QuestionFormValues): QuestionFormValues {
  return {
    ...values,
    tags: [...values.tags],
    options: values.options ? values.options.map((option) => ({ ...option })) : null,
  }
}

/** 接口返回的 Question → 表单值 */
function toFormValues(raw: Record<string, unknown>): QuestionFormValues {
  const rawOptions = Array.isArray(raw.options) ? raw.options : []
  const options = rawOptions
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const row = item as Record<string, unknown>
      return {
        id: row.id == null ? "" : String(row.id),
        label: row.label == null ? "" : String(row.label),
      }
    })
    .filter((item): item is { id: string; label: string } => Boolean(item))
  return {
    questionType: String(raw.questionType ?? ""),
    content: String(raw.content ?? ""),
    options: options.length ? options : null,
    answer: String(raw.answer ?? ""),
    analysis: raw.analysis == null ? "" : String(raw.analysis),
    score: typeof raw.score === "number" ? raw.score : Number(raw.score ?? 0),
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag)) : [],
    category: String(raw.category ?? ""),
    grade: raw.grade == null ? "" : String(raw.grade),
    year: typeof raw.year === "number" ? raw.year : null,
    source: String(raw.source ?? ""),
  }
}

export function QuestionEditorCard({
  question,
  index,
  subject,
  expanded,
  onToggle,
  onDirtyChange,
}: QuestionEditorCardProps) {
  const router = useRouter()
  const values = question.values
  const [draft, setDraft] = React.useState<QuestionFormValues>(() => cloneValues(values))
  const [saving, setSaving] = React.useState(false)
  const [syncKey, setSyncKey] = React.useState(0)
  const categoryListId = React.useId()

  const dirty = hasChanges(values, draft, QUESTION_FORM_KEYS)

  React.useEffect(() => {
    onDirtyChange?.(question.id, dirty)
  }, [dirty, question.id, onDirtyChange])

  const update = (patch: Partial<QuestionFormValues>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const reset = () => {
    setDraft(cloneValues(values))
    setSyncKey((key) => key + 1)
  }

  const save = async () => {
    const problem = validateQuestionDraft(draft)
    if (problem) {
      toast.error(problem)
      return
    }
    const changed = pickChangedFields(values, draft, QUESTION_FORM_KEYS)
    if (Object.keys(changed).length === 0) {
      toast.info("这道单题没有改动")
      return
    }

    // analysis / grade 清空时存成 null，和库里的可空字段一致
    const body: Record<string, unknown> = { ...changed }
    if ("analysis" in body) body.analysis = draft.analysis.trim() ? draft.analysis : null
    if ("grade" in body) body.grade = draft.grade.trim() ? draft.grade : null

    setSaving(true)
    try {
      const response = await fetch(`/api/admin/question-bank/questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error || `保存失败（${response.status}）`)
      }
      const saved = toFormValues(json.data.question as Record<string, unknown>)
      setDraft(saved)
      setSyncKey((key) => key + 1)
      toast.success(`第 ${index + 1} 题已保存`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  const typeOptions = questionTypeOptionsFor("question", draft.questionType)
  const categoryOptions = categoriesBySubject[subject] ?? []

  return (
    <div className="border-t border-border first:border-t-0">
      <div className={cn("py-3", expanded && "pb-1")}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full items-start gap-3 text-left"
        >
          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{questionTypeLabel(draft.questionType)}</Badge>
              <span className="text-xs text-muted-foreground">{draft.score} 分</span>
              {dirty ? <Badge variant="secondary">未保存</Badge> : null}
              {draft.answer.trim() ? null : (
                <Badge className="border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  未填答案
                </Badge>
              )}
            </span>
            <span className="line-clamp-1 block text-sm text-muted-foreground">
              {questionStemPreview(draft.content, 90)}
            </span>
          </span>
          {expanded ? (
            <ChevronUp className="mt-1 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </div>

      {expanded ? (
        <>
          <div className="space-y-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>题型</Label>
                <Select
                  value={draft.questionType}
                  onValueChange={(value) => update({ questionType: value })}
                  disabled={saving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择题型">{questionTypeLabel(draft.questionType)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`q-score-${question.id}`}>分值</Label>
                <Input
                  id={`q-score-${question.id}`}
                  type="number"
                  min={0}
                  max={300}
                  step={0.5}
                  value={draft.score}
                  onChange={(event) =>
                    update({ score: event.target.value === "" ? 0 : Number(event.target.value) })
                  }
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`q-year-${question.id}`}>年份</Label>
                <Input
                  id={`q-year-${question.id}`}
                  type="number"
                  min={1900}
                  max={2100}
                  value={draft.year ?? ""}
                  onChange={(event) =>
                    update({ year: event.target.value === "" ? null : Number(event.target.value) })
                  }
                  placeholder="如 2024"
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`q-category-${question.id}`}>类别</Label>
                <Input
                  id={`q-category-${question.id}`}
                  list={categoryListId}
                  value={draft.category}
                  onChange={(event) => update({ category: event.target.value })}
                  placeholder="如：阅读"
                  maxLength={100}
                  disabled={saving}
                />
                <datalist id={categoryListId}>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`q-grade-${question.id}`}>年级</Label>
                <Input
                  id={`q-grade-${question.id}`}
                  value={draft.grade}
                  onChange={(event) => update({ grade: event.target.value })}
                  placeholder="如：高三"
                  maxLength={50}
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`q-source-${question.id}`}>来源</Label>
                <Input
                  id={`q-source-${question.id}`}
                  value={draft.source}
                  onChange={(event) => update({ source: event.target.value })}
                  placeholder="如：2024北京海淀高三一模"
                  maxLength={200}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`q-tags-${question.id}`}>标签</Label>
              <TagsInput
                key={syncKey}
                id={`q-tags-${question.id}`}
                value={draft.tags}
                onChange={(tags) => update({ tags })}
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`q-content-${question.id}`}>题干（Markdown）</Label>
                <span className="text-xs text-muted-foreground">{draft.content.length} 字</span>
              </div>
              <Textarea
                id={`q-content-${question.id}`}
                value={draft.content}
                onChange={(event) => update({ content: event.target.value })}
                rows={10}
                className="min-h-[12rem] font-mono text-[13px] leading-6"
                placeholder="题干正文；填空用 <Input> / <Input2> / <ClozeBlank>，公式用 $...$"
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <Label>选项</Label>
              <OptionsEditor
                value={draft.options}
                onChange={(options) => update({ options })}
                disabled={saving}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`q-answer-${question.id}`}>答案</Label>
                  <span className="text-xs text-muted-foreground">{draft.answer.length} 字</span>
                </div>
                <Textarea
                  id={`q-answer-${question.id}`}
                  value={draft.answer}
                  onChange={(event) => update({ answer: event.target.value })}
                  rows={4}
                  className="min-h-20"
                  placeholder="选择题填选项字母（如 C）；填空题填答案；主观题可写参考答案"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  判分口径由题型决定：选择题忽略大小写；语法填空 / 选词填空区分大小写。
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`q-analysis-${question.id}`}>解析</Label>
                  <span className="text-xs text-muted-foreground">{draft.analysis.length} 字</span>
                </div>
                <Textarea
                  id={`q-analysis-${question.id}`}
                  value={draft.analysis}
                  onChange={(event) => update({ analysis: event.target.value })}
                  rows={4}
                  className="min-h-20"
                  placeholder="解析正文（Markdown，可留空）"
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pb-4 pt-3">
            <p className="text-xs text-muted-foreground">
              {dirty ? "这道单题有未保存的改动。" : "没有未保存的改动。"}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={reset} disabled={!dirty || saving}>
                <RotateCcw />
                重置
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {saving ? "保存中…" : `保存第 ${index + 1} 题`}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
