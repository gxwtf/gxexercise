"use client"

// 题组编辑页的客户端容器：三个板块（基本信息 / 题组正文 / 小题）+ 右侧（概览 / 最近修改 / 须知）
//
// 板块切换只切显示、不卸载内容：小题卡片各自持有草稿，切板块不能把没保存的修改丢掉，
// 所以三个面板都保持挂载，用 hidden 控制可见性。
//
// 题组级草稿（基本信息 + 正文）放在这里，统一算 diff / 统一保存；小题各自独立保存。

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ExternalLink, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { EditorTabs } from "@/components/admin/question-bank/EditorTabs"
import { GroupMetaForm } from "@/components/admin/question-bank/GroupMetaForm"
import { GroupContentForm } from "@/components/admin/question-bank/GroupContentForm"
import { QuestionEditorCard } from "@/components/admin/question-bank/QuestionEditorCard"
import { CoverField } from "@/components/admin/question-bank/CoverField"
import { EditHistoryList } from "@/components/admin/question-bank/EditHistoryList"
import type {
  CoverCandidateSetView,
  EditLogView,
  GroupEditorGroup,
  GroupEditorQuestion,
  GroupFormValues,
} from "@/components/admin/question-bank/types"
import {
  GROUP_BASIC_KEYS,
  GROUP_CONTENT_KEYS,
  GROUP_FORM_KEYS,
  pickChangedFields,
  validateGroupDraft,
} from "@/components/admin/question-bank/form-utils"
import { questionTypeLabel } from "@/lib/question-bank-meta"
import { formatDateTime } from "@/lib/submission-records"

interface QuestionGroupEditorProps {
  group: GroupEditorGroup
  questions: GroupEditorQuestion[]
  logs: EditLogView[]
  /** 生成脚本产出的候选封面（没有缓存时为 null） */
  coverCandidates: CoverCandidateSetView | null
}

type EditorTabValue = "basic" | "content" | "questions"

function toGroupValues(group: GroupEditorGroup): GroupFormValues {
  return {
    title: group.title,
    subject: group.subject,
    category: group.category,
    questionType: group.questionType,
    grade: group.grade,
    source: group.source,
    score: group.score,
    answerMode: group.answerMode,
    tags: [...group.tags],
    imageUrl: group.imageUrl,
    content: group.content,
  }
}

/** 接口返回的题组 → 表单值（null 统一转空串） */
function fromApiGroup(raw: Record<string, unknown>, fallback: GroupEditorGroup): GroupFormValues {
  return {
    title: String(raw.title ?? fallback.title),
    subject: String(raw.subject ?? fallback.subject),
    category: String(raw.category ?? fallback.category),
    questionType: String(raw.questionType ?? fallback.questionType),
    grade: raw.grade == null ? "" : String(raw.grade),
    source: String(raw.source ?? fallback.source),
    score: typeof raw.score === "number" ? raw.score : Number(raw.score ?? fallback.score),
    answerMode: String(raw.answerMode ?? fallback.answerMode),
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag)) : [...fallback.tags],
    imageUrl: raw.imageUrl == null ? "" : String(raw.imageUrl),
    content: String(raw.content ?? fallback.content),
  }
}

/** 用基线值覆盖草稿里的指定字段（板块级「重置」） */
function restoreFields(
  before: GroupFormValues,
  draft: GroupFormValues,
  keys: readonly (keyof GroupFormValues)[],
): GroupFormValues {
  const next = { ...draft }
  for (const key of keys) {
    const value = before[key]
    // @ts-expect-error 同一字段的基线值类型与草稿一致（字符串 / 数字 / 字符串数组）
    next[key] = Array.isArray(value) ? [...value] : value
  }
  return next
}

export function QuestionGroupEditor({ group, questions, logs, coverCandidates }: QuestionGroupEditorProps) {
  const router = useRouter()
  const [draft, setDraft] = React.useState<GroupFormValues>(() => toGroupValues(group))
  const [saving, setSaving] = React.useState(false)
  const [syncKey, setSyncKey] = React.useState(0)
  const [activeTab, setActiveTab] = React.useState<EditorTabValue>("basic")
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    () => new Set(questions.length > 0 ? [questions[0].id] : []),
  )
  const [dirtyQuestionIds, setDirtyQuestionIds] = React.useState<Set<string>>(new Set())

  const basicChanges = pickChangedFields(group, draft, GROUP_BASIC_KEYS)
  const contentChanges = pickChangedFields(group, draft, GROUP_CONTENT_KEYS)
  const basicDirty = Object.keys(basicChanges).length > 0
  const contentDirty = Object.keys(contentChanges).length > 0
  const groupDirty = basicDirty || contentDirty
  const anyDirty = groupDirty || dirtyQuestionIds.size > 0

  // 有未保存改动时，关闭 / 刷新页面给浏览器一个确认（20 道小题手改一次不容易）
  React.useEffect(() => {
    if (!anyDirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [anyDirty])

  // 小题卡片用回调上报脏状态；保持回调稳定，避免每键重渲染整棵树
  const handleQuestionDirty = React.useCallback((questionId: string, isDirty: boolean) => {
    setDirtyQuestionIds((prev) => {
      if (prev.has(questionId) === isDirty) return prev
      const next = new Set(prev)
      if (isDirty) next.add(questionId)
      else next.delete(questionId)
      return next
    })
  }, [])

  const updateDraft = (patch: Partial<GroupFormValues>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  /** 板块级重置：只把本板块字段恢复成服务端基线，其他板块的草稿不动 */
  const resetBasic = () => {
    setDraft((prev) => restoreFields(group, prev, GROUP_BASIC_KEYS))
    setSyncKey((key) => key + 1)
  }
  const resetContent = () => {
    setDraft((prev) => restoreFields(group, prev, GROUP_CONTENT_KEYS))
  }

  const saveGroup = async () => {
    const problem = validateGroupDraft(draft)
    if (problem) {
      toast.error(problem)
      return
    }
    const changed = pickChangedFields(group, draft, GROUP_FORM_KEYS)
    if (Object.keys(changed).length === 0) {
      toast.info("题组信息没有改动")
      return
    }
    // 空年级 / 空封面在库里是 null / 空串
    const body: Record<string, unknown> = { ...changed }
    if ("grade" in body) body.grade = draft.grade.trim() ? draft.grade : null
    if ("imageUrl" in body) body.imageUrl = draft.imageUrl.trim()

    setSaving(true)
    try {
      const response = await fetch(`/api/admin/question-bank/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error || `保存失败（${response.status}）`)
      }
      setDraft(fromApiGroup(json.data.group as Record<string, unknown>, group))
      setSyncKey((key) => key + 1)
      toast.success("题组信息已保存")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  const expandAll = () => setExpandedIds(new Set(questions.map((question) => question.id)))
  const collapseAll = () => setExpandedIds(new Set())

  const totalSavedScore = questions.reduce((sum, question) => sum + question.values.score, 0)
  const dirtyQuestionCount = dirtyQuestionIds.size

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
      {/* 徽标行与板块切换横跨整行（col-span-full），这样下面右侧「题组概览」的卡片顶边
          才能和左侧「题组信息」卡片顶边对齐（否则它会对齐到徽标行） */}
      <div className="col-span-full flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{draft.subject}</Badge>
        <Badge variant="secondary">{draft.category || "未分类"}</Badge>
        <Badge variant="outline">{questionTypeLabel(draft.questionType)}</Badge>
        <span className="text-xs text-muted-foreground">
          {questions.length} 道小题 · 题组分值 {draft.score}
        </span>
        {anyDirty ? <Badge variant="secondary">有未保存的改动</Badge> : null}
      </div>

      <div className="col-span-full">
        <EditorTabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as EditorTabValue)}
          tabs={[
            { value: "basic", label: "基本信息", dirty: basicDirty },
            { value: "content", label: "题组正文", dirty: contentDirty },
            {
              value: "questions",
              label: "小题",
              badge: String(questions.length),
              dirty: dirtyQuestionCount > 0,
            },
          ]}
        />
      </div>

      <div className="min-w-0 space-y-4">
        {/* 三个板块都保持挂载（hidden 切换），避免切走时丢掉小题卡片里的草稿 */}
        <div className={activeTab === "basic" ? "block" : "hidden"} role="tabpanel" aria-label="基本信息">
          <GroupMetaForm
            values={draft}
            onChange={updateDraft}
            onSave={saveGroup}
            onReset={resetBasic}
            saving={saving}
            dirty={basicDirty}
            syncKey={syncKey}
            coverSlot={
              <CoverField
                groupId={group.id}
                imageUrl={draft.imageUrl}
                candidates={coverCandidates}
                onChange={(imageUrl) => updateDraft({ imageUrl })}
                disabled={saving}
              />
            }
          />
        </div>

        <div className={activeTab === "content" ? "block" : "hidden"} role="tabpanel" aria-label="题组正文">
          <GroupContentForm
            content={draft.content}
            onChange={(content) => updateDraft({ content })}
            onSave={saveGroup}
            onReset={resetContent}
            saving={saving}
            dirty={contentDirty}
          />
        </div>

        <div className={activeTab === "questions" ? "block" : "hidden"} role="tabpanel" aria-label="小题">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">
                小题列表
                <span className="ml-2 text-sm font-normal text-muted-foreground">共 {questions.length} 题</span>
                {dirtyQuestionCount > 0 ? (
                  <span className="ml-2 text-xs font-normal text-brand">（{dirtyQuestionCount} 题未保存）</span>
                ) : null}
              </h2>
              {questions.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={expandAll}>
                    展开全部
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={collapseAll}>
                    收起全部
                  </Button>
                </div>
              ) : null}
            </div>

            {questions.length === 0 ? (
              <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                该题组下还没有关联小题。小题的增删 / 排序由导入脚本负责，本页面只修改已有小题的内容。
              </p>
            ) : (
              <div className="space-y-3">
                {questions.map((question, index) => (
                  <QuestionEditorCard
                    key={question.id}
                    question={question}
                    index={index}
                    subject={draft.subject}
                    expanded={expandedIds.has(question.id)}
                    onToggle={() =>
                      setExpandedIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(question.id)) next.delete(question.id)
                        else next.add(question.id)
                        return next
                      })
                    }
                    onDirtyChange={handleQuestionDirty}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>题组概览</CardTitle>
            <CardDescription className="break-all font-mono text-xs">{group.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">小题数</span>
              <span className="font-medium">{questions.length} 题</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">小题合计分</span>
              <span className="font-medium">{totalSavedScore} 分</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">创建时间</span>
              <span>{formatDateTime(new Date(group.createdAt))}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">最后更新</span>
              <span>{formatDateTime(new Date(group.updatedAt))}</span>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm" variant="outline" className="flex-1">
                <Link href={`/question/${group.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  前台预览
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="flex-1">
                <Link href={`/admin/questions/logs?q=${encodeURIComponent(group.title)}`}>修改记录</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近修改</CardTitle>
            <CardDescription>最近 15 条改动（题组 + 组内小题）。</CardDescription>
          </CardHeader>
          <CardContent>
            <EditHistoryList logs={logs} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Info className="size-4" />
              编辑须知
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>每次保存都会存档：管理员、时间、改了哪些字段、改动前后的内容。</p>
            <p>正文与题干直接编辑 Markdown 源码；公式用 $...$，填空占位用 &lt;Input&gt; 等私有标签。</p>
            <p>保存不影响已有作答记录，但改答案 / 选项 ID 会让历史作答的判分口径发生变化，请谨慎。</p>
            <p>改完建议点「前台预览」核对渲染效果。</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
