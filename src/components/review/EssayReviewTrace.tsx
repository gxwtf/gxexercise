/**
 * 判分留痕（EssayReviewInternal）—— **仅管理员可见**，任何学生页面都不得引用本组件。
 *
 * 这里出现的 A/B/C/D/L 条款编号、命中条数、上限、扣分算式是**排查工具**，
 * 只在管理员页的折叠区里展示（默认收起）。学生侧对应的是 EssaySheet.tsx，
 * 它只拿 EssayReviewPublic，类型上就拿不到这些字段。
 */
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { EssayReviewInternal } from "@/lib/essay-review"

/** 一行「标签：值」 */
function TraceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words text-foreground">{children}</span>
    </div>
  )
}

/** 编号列表（A2 / B12 / L1…）：管理员看得懂，学生页面不出现 */
function HitBadges({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-muted-foreground">无</span>
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground"
        >
          {item}
        </span>
      ))}
    </span>
  )
}

export interface EssayReviewTraceProps {
  internal: EssayReviewInternal
  className?: string
}

export function EssayReviewTrace({ internal, className }: EssayReviewTraceProps) {
  const hitGroups: Array<[string, string[]]> = [
    ["A 级命中", internal.aHits ?? []],
    ["L 级命中", internal.lHits ?? []],
    ["B 级命中", internal.bHits ?? []],
    ["C 级命中", internal.cHits ?? []],
    ["D 级命中", internal.dHits ?? []],
  ]
  const evidence = Object.entries(internal.evidence ?? {}).filter(
    ([, value]) => typeof value === "string" && value.trim().length > 0
  )

  return (
    <details
      className={cn(
        "rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/20",
        className
      )}
    >
      <summary className="cursor-pointer text-xs font-medium text-amber-800 dark:text-amber-200">
        仅管理员可见 · 判分留痕
      </summary>
      <div className="mt-3 space-y-2">
        <TraceRow label="A7′ 档位">{internal.a7Band || "-"}</TraceRow>
        {hitGroups.map(([label, items]) => (
          <TraceRow key={label} label={label}>
            <HitBadges items={items} />
          </TraceRow>
        ))}
        <TraceRow label="上限">
          {(internal.caps ?? []).length === 0 ? (
            <span className="text-muted-foreground">未套上限</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {(internal.caps ?? []).map((cap) => (
                <span key={cap} className="rounded border border-border bg-background px-1.5 py-0.5 text-xs">
                  {cap}
                </span>
              ))}
            </span>
          )}
        </TraceRow>
        <TraceRow label="算式">
          <span className="block whitespace-pre-wrap break-all rounded border border-border bg-background px-2 py-1 font-mono text-xs">
            {internal.formula || "-"}
          </span>
        </TraceRow>
        {internal.coreConcept || internal.propositionType ? (
          <TraceRow label="题干还原">
            {[internal.coreConcept, internal.propositionType].filter(Boolean).join(" · ") || "-"}
          </TraceRow>
        ) : null}
        {evidence.length > 0 ? (
          <TraceRow label="命中证据">
            <span className="block space-y-1">
              {evidence.map(([code, sentence]) => (
                <span key={code} className="block">
                  <span className="font-mono text-xs text-muted-foreground">{code}</span>
                  {" "}
                  {sentence}
                </span>
              ))}
            </span>
          </TraceRow>
        ) : null}
        {internal.model || internal.elapsedMs != null ? (
          <TraceRow label="模型">
            {[internal.model, internal.elapsedMs != null ? `${internal.elapsedMs} ms` : null]
              .filter(Boolean)
              .join(" · ")}
          </TraceRow>
        ) : null}
      </div>
    </details>
  )
}
