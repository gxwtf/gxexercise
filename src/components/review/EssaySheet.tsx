/**
 * 语文大作文「AI 批阅单」（判分标准 v1.5，北京卷议论文）—— **学生可见** 的那一版。
 *
 * 口径（见 src/lib/essay-review.ts 顶部注释，属于硬性纪律）：
 *   学生只看到 分数 / 档位 / 分数段 / 判词 / 修改建议 / 字数（原稿由回顾页单独排版）。
 *   A/B/C/D/L 条款编号、命中条数、起点分、上限、扣分算式**一律不出现**。
 *   那些字段只存在于 EssayReviewInternal，留痕只在管理员页（EssayReviewTrace.tsx）。
 *
 * 本组件只接收 EssayReviewPublic —— 从类型上就拿不到 internal，所以这里**没有**
 * 任何「按等级 / 按条款」的渲染分支，也不可能把内部过程漏给学生。
 *
 * 另外两层兜底：
 *   1) 服务端下发前已用 toPublicEssayReview() 剥过一遍（internal 不会进 RSC 载荷）；
 *   2) 渲染前再过一遍 sanitizeEssaySuggestion()：模型偶尔会在建议里冒出「以争取 L1」
 *      这类编号 / 算式痕迹，挖掉后学生看到的只是一句人话。
 */
import { Info, ListChecks, PenLine, Sparkles } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  ESSAY_RUBRIC_VERSION,
  sanitizeEssaySuggestion,
  type EssayReviewPublic,
} from "@/lib/essay-review"

/**
 * 清洗一条要给学生看的文字：先挖掉条款编号 / 算式（契约里的 sanitizeEssaySuggestion），
 * 再收拾挖空后留下的空白（「， 那种」→「，那种」）。清洗成空串的条目由调用方丢弃。
 */
function cleanText(text: string): string {
  return sanitizeEssaySuggestion(text)
    .replace(/([，、；：])\s+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/** 分数显示：整数原样，小数留一位（库里可能存 38.5 这种重评后的值） */
function formatScore(value: number): string {
  if (!Number.isFinite(value)) return "-"
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10)
}

export interface EssaySheetProps {
  /** 学生可见部分（已由 toPublicEssayReview 剥过，不含任何 internal 字段） */
  review: EssayReviewPublic
  className?: string
}

/**
 * 一份学生能直接读的批阅单：大号分数 + 档位 + 判词 + 修改建议 + 最该动的地方。
 * 浅色 / 深色都只用语义 token（bg-card / text-foreground / text-muted-foreground / border-brand / bg-brand），
 * 手机宽度下靠 flex-wrap + break-words 自适应，不出现横向滚动。
 */
export function EssaySheet({ review, className }: EssaySheetProps) {
  // 兜底清洗（见文件头注释的第 2 条）：清洗后为空的条目直接丢掉，宁可少一条也不留半句空话
  const verdict = cleanText(review.verdict)
  const direction = cleanText(review.direction)
  const suggestions = review.suggestions
    .map((item) => cleanText(item))
    .filter((item) => item.length > 0)

  const maxScore = review.maxScore > 0 ? review.maxScore : 50
  const percent = Math.max(0, Math.min(100, Math.round((review.score / maxScore) * 100)))

  return (
    <Card className={cn("gap-3 overflow-hidden", className)}>
      <CardContent className="space-y-4 px-4 sm:px-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-brand" />
          <h3 className="text-sm font-semibold text-foreground">AI 批阅单</h3>
        </div>

        {/* 分数 + 档位 + 分数段 + 字数：一行读完，手机上自动折成两行 */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-semibold leading-none tabular-nums text-foreground">
              {formatScore(review.score)}
            </span>
            <span className="text-sm text-muted-foreground">/ {formatScore(maxScore)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge
              variant="outline"
              className="border-brand/40 bg-brand/10 text-xs font-semibold text-brand"
            >
              {review.band}
            </Badge>
            <span className="text-xs text-muted-foreground">分数段 {review.range}</span>
            {review.wordCount > 0 ? (
              <span className="text-xs text-muted-foreground">全文 {review.wordCount} 字</span>
            ) : null}
          </div>
        </div>

        {/* 只表示「得了多少分」，不带任何判分过程；细一点、淡一点，别抢判词的位置 */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-brand/70" style={{ width: `${percent}%` }} />
        </div>

        {verdict ? (
          <p className="text-base leading-relaxed text-foreground">{verdict}</p>
        ) : null}

        {suggestions.length > 0 ? (
          <>
            <Separator />
            <div>
              <h4 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ListChecks className="size-4 shrink-0 text-brand" />
                修改建议
              </h4>
              <ol className="space-y-2.5">
                {suggestions.map((item, index) => (
                  <li key={index} className="flex gap-2.5">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 break-words text-sm leading-relaxed text-foreground">
                      {item}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : null}

        {/* 「最该动的地方」：醒目但克制，只用一个品牌色左边线 + 极浅底色 */}
        {direction ? (
          <div className="rounded-r-lg border-l-2 border-brand bg-brand/5 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-brand">
              <PenLine className="size-3.5 shrink-0" />
              最该动的地方
            </p>
            <p className="mt-1 break-words text-sm leading-relaxed text-foreground">{direction}</p>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>AI 批阅仅供参考，以教师评分为准</span>
        <span>判分标准 {ESSAY_RUBRIC_VERSION}</span>
      </CardFooter>
    </Card>
  )
}

export interface EssaySkipNoticeProps {
  /** 后端写进 aiFeedback.feedback 的说明原文（如「这篇是记叙文……本次未评分。」） */
  text: string
  className?: string
}

/**
 * 「本次未评分」说明条（aiFeedback.essaySkipReason = "non-argumentative"）。
 *
 * v1.5 只适用于北京卷**议论文**；写到记叙文上时后端会跳过分、并给一句说明。
 * 这是**终态**：不要出现「稍后重试 / 批阅中」这类暗示，学生只需知道为什么没有分数。
 */
export function EssaySkipNotice({ text, className }: EssaySkipNoticeProps) {
  return (
    <Alert className={cn("border-border bg-muted/50", className)}>
      <Info className="text-muted-foreground" />
      <AlertTitle>本次未评分</AlertTitle>
      <AlertDescription>
        <p className="whitespace-pre-wrap break-words text-foreground">{text}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          记叙文暂不参与 AI 评分 · AI 批阅仅供参考，以教师评分为准
        </p>
      </AlertDescription>
    </Alert>
  )
}
