"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

/** 重评范围：只重评本次作答 / 重评该题组的全部作答 */
type RegradeScope = "single" | "all"

export interface AdminRegradeButtonProps {
  /** 本次作答记录 id（QuestionGroupSubmission.id） */
  groupSubmissionId: string
  /** 所属题组 id（QuestionGroup.id）：重评「全部作答」时把它交给后端 */
  questionGroupId: string
  /** 题组名（套卷小节则为小节名），弹窗里指明重评对象 */
  title: string
  /** 本次作答的用户名，用于「只重评本次作答」的副标题 */
  userName: string
  /** 本次作答时间（已格式化），用于「只重评本次作答」的副标题 */
  time: string
  /** 该题组（含套卷里的同一小节）的作答总次数，用于「全部作答」的副标题 */
  totalCount: number
  className?: string
}

/** 后端 /api/admin/submissions/regrade 成功响应的 data 段 */
interface RegradeResult {
  groups?: unknown[]
  requeued?: number
  objectiveChanged?: number
  skipped?: number
  failed?: { id?: string; error?: string }[]
}

interface RegradeResponse {
  success?: boolean
  error?: string
  data?: RegradeResult
}

/** 选项行（整行可点：Label 内嵌 RadioGroupItem，点文字等于点单选框） */
const OPTION_CLASS =
  "flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3 font-normal transition-colors hover:bg-muted/60"
const OPTION_ACTIVE_CLASS = "border-brand/50 bg-brand/5 hover:bg-brand/10"
const OPTION_DISABLED_CLASS = "cursor-not-allowed opacity-60 hover:bg-muted/40"

/**
 * 管理员手动重评（答案 / 评分标准被改过之后使用）。
 *
 * 只暴露一个入口：确认弹窗里用单选项选择范围 —— 本次作答，或该题组的全部作答。
 * 客观题按题库里最新的参考答案重判；有批改提示词的主观题重新排队交 AI 批改，
 * 因此成功后除了立即 router.refresh()，若有主观题重新排队则 20 秒后再刷新一次。
 */
export function AdminRegradeButton({
  groupSubmissionId,
  questionGroupId,
  title,
  userName,
  time,
  totalCount,
  className,
}: AdminRegradeButtonProps) {
  const router = useRouter()
  const optionId = React.useId()
  const [open, setOpen] = React.useState(false)
  const [scope, setScope] = React.useState<RegradeScope>("single")
  const [submitting, setSubmitting] = React.useState(false)
  /** 有主观题重新排队时，稍后再刷新一次页面，等 AI 批改把 pending 改掉 */
  const [refreshLater, setRefreshLater] = React.useState(false)

  React.useEffect(() => {
    if (!refreshLater) return
    const timer = window.setTimeout(() => {
      router.refresh()
      setRefreshLater(false)
    }, 20_000)
    return () => window.clearTimeout(timer)
  }, [refreshLater, router])

  const changeOpen = (next: boolean) => {
    // 提交中不允许关闭弹窗（Esc / 点遮罩都会走到这里）
    if (submitting) return
    setOpen(next)
    // 每次打开都回到默认选项「只重评本次作答」
    if (next) setScope("single")
  }

  const regrade = async () => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/submissions/regrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          scope === "single" ? { groupSubmissionIds: [groupSubmissionId] } : { questionGroupId }
        ),
      })
      const json = (await res.json().catch(() => null)) as RegradeResponse | null
      if (!res.ok || !json?.success) {
        toast.error(json?.error || "重评失败")
        return
      }

      const data = json.data ?? {}
      const requeued = data.requeued ?? 0
      const objectiveChanged = data.objectiveChanged ?? 0
      const affected =
        Array.isArray(data.groups) && data.groups.length > 0
          ? data.groups.length
          : scope === "single"
            ? 1
            : totalCount

      const details: string[] = []
      if (objectiveChanged > 0) details.push(`客观题 ${objectiveChanged} 道更新`)
      if (requeued > 0) details.push(`${requeued} 道主观题已重新排队`)
      toast.success(
        details.length > 0
          ? `已重评 ${affected} 份作答：${details.join("、")}`
          : `已重评 ${affected} 份作答`
      )

      const failed = data.failed ?? []
      if (failed.length > 0) {
        const firstError = failed[0]?.error
        toast.error(
          `${failed.length} 份作答重评失败${firstError ? `：${firstError}` : ""}`
        )
      }

      setOpen(false)
      router.refresh()
      if (requeued > 0) setRefreshLater(true)
    } catch {
      toast.error("重评失败，请稍后重试")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-7 px-2", className)} disabled={submitting}>
          重评
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>重评</AlertDialogTitle>
          <AlertDialogDescription>
            客观题按题库里最新的参考答案重判；有批改提示词的主观题会重新排队交 AI
            批改（约 10–30 秒，期间显示「待批改」）。图片答案、数学解答题、物理计算题、语文作文不参与重评。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2">
          <div>
            <p className="text-sm font-medium">重评范围</p>
            <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground" title={title}>
              题组：{title}
            </p>
          </div>
          <RadioGroup
            value={scope}
            onValueChange={(value) => setScope(value === "all" ? "all" : "single")}
            disabled={submitting}
            aria-label="重评范围"
          >
            <Label
              htmlFor={`${optionId}-single`}
              className={cn(OPTION_CLASS, scope === "single" && OPTION_ACTIVE_CLASS)}
            >
              <RadioGroupItem
                id={`${optionId}-single`}
                value="single"
                className="mt-0.5"
                disabled={submitting}
              />
              <span className="grid min-w-0 gap-0.5">
                <span className="text-sm font-medium">只重评本次作答</span>
                <span className="text-xs break-words text-muted-foreground">
                  {userName} · {time}
                </span>
              </span>
            </Label>

            <Label
              htmlFor={`${optionId}-all`}
              className={cn(
                OPTION_CLASS,
                scope === "all" && OPTION_ACTIVE_CLASS,
                totalCount <= 0 && OPTION_DISABLED_CLASS
              )}
            >
              <RadioGroupItem
                id={`${optionId}-all`}
                value="all"
                className="mt-0.5"
                disabled={submitting || totalCount <= 0}
              />
              <span className="grid min-w-0 gap-0.5">
                <span className="text-sm font-medium">重评该题组的全部作答</span>
                <span className="text-xs break-words text-muted-foreground">
                  共 {totalCount} 次作答
                </span>
              </span>
            </Label>
          </RadioGroup>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // 阻止 Action 默认的「立即关闭弹窗」，等请求返回后再决定
              event.preventDefault()
              void regrade()
            }}
            disabled={submitting}
          >
            {submitting && <Loader2 className="animate-spin" />}
            {submitting ? "重评中…" : "开始重评"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
