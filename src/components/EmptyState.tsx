// 全站统一的空状态（Empty state）组件
//
// 样式对齐题库浏览页「未找到匹配的题目 / 尝试调整筛选条件或搜索关键词」那块：
// 居中图标 + 标题 + 说明，可选一个操作按钮。底层用 shadcn 的 Empty 组件，
// 各处只传不同的 icon / title / description，避免每个页面各写一套。

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

interface EmptyStateProps {
  /** lucide 图标元素（如 <SearchX />），会自动套进圆形/方形底 */
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** 可选操作（通常是 Button / Link） */
  action?: React.ReactNode
  /** 紧凑模式：侧栏、候选封面这类小区域用，字号与留白更小 */
  compact?: boolean
  className?: string
}

export function EmptyState({ icon, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <Empty className={cn(compact ? "gap-2 p-4" : "py-16", className)}>
      <EmptyHeader className={compact ? "gap-1.5" : undefined}>
        {icon ? (
          <EmptyMedia
            className={
              compact
                ? "mb-1 text-muted-foreground [&_svg]:size-6"
                : "mb-2 text-muted-foreground [&_svg]:size-12"
            }
          >
            {icon}
          </EmptyMedia>
        ) : null}
        <EmptyTitle className={compact ? "text-sm" : "text-lg font-medium"}>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription className={compact ? "text-xs" : "text-muted-foreground"}>
            {description}
          </EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent className={compact ? "text-xs" : undefined}>{action}</EmptyContent> : null}
    </Empty>
  )
}
