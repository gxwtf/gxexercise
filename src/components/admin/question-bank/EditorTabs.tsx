"use client"

// 编辑页的板块切换条：样式对齐题库浏览页的题型导航（SubHeader）——
// 选中项用品牌红文字 + 底部 0.5 高亮条，未选中项悬停变品牌红。
//
// 纯受控组件：当前板块由 QuestionGroupEditor 管，切换不写 URL（保持页面内状态）。

import * as React from "react"
import { cn } from "@/lib/utils"

export interface EditorTabItem {
  value: string
  label: string
  /** 右侧小徽标，如小题数量 */
  badge?: string
  /** 该板块有未保存改动时显示红点 */
  dirty?: boolean
}

interface EditorTabsProps {
  tabs: EditorTabItem[]
  value: string
  onChange: (value: string) => void
}

export function EditorTabs({ tabs, value, onChange }: EditorTabsProps) {
  return (
    <div className="border-b border-border">
      <nav role="tablist" aria-label="编辑板块" className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap">
        {tabs.map((tab) => {
          const active = tab.value === value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={cn(
                "relative h-9 shrink-0 px-3 text-sm transition-colors hover:text-brand",
                active ? "font-medium text-brand" : "text-foreground",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {tab.label}
                {tab.badge ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                    {tab.badge}
                  </span>
                ) : null}
                {tab.dirty ? (
                  <span className="size-1.5 rounded-full bg-brand" aria-label="有未保存的改动" title="有未保存的改动" />
                ) : null}
              </span>
              {active ? <span className="absolute -bottom-px left-0 h-0.5 w-full bg-brand" /> : null}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
