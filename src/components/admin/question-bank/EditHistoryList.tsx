// 修改记录（审计日志）列表：谁、什么时候、改了哪个对象、动了哪些字段、前后各是什么
//
// 既用在编辑页右侧的「最近修改」，也会被修改记录页复用（那边日志更多、筛选项在页面层）。

import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/submission-records"
import {
  ADMIN_EDIT_ACTION_LABELS,
  ADMIN_EDIT_TARGET_LABELS,
  EDIT_FIELD_LABELS,
} from "@/lib/question-bank-meta"
import type { EditLogFieldChange, EditLogView } from "@/components/admin/question-bank/types"

interface EditHistoryListProps {
  logs: EditLogView[]
  /** 空状态文案 */
  emptyText?: string
  /** 是否显示「对象」一行（编辑页里对象是当前题组/小题，可以省） */
  showTarget?: boolean
}

function fieldLabel(field: string): string {
  return EDIT_FIELD_LABELS[field] ?? field
}

/** 把 before/after 展示成一行；长文本只显示首行 + 长度，完整内容在 <details> 里 */
function previewLine(change: EditLogFieldChange, side: "before" | "after"): string {
  const value = change[side]
  if (value === null || value === "") return "（空）"
  const firstLine = value.split("\n")[0] ?? ""
  if (firstLine.length > 60) return `${firstLine.slice(0, 60)}…`
  return firstLine
}

function lengthText(change: EditLogFieldChange, side: "before" | "after"): string {
  const length = side === "before" ? change.beforeLength : change.afterLength
  return length !== undefined ? `（共 ${length} 字）` : ""
}

export function EditHistoryList({ logs, emptyText, showTarget = false }: EditHistoryListProps) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyText ?? "还没有修改记录；第一次保存后会在这里留下存档。"}
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border/60">
      {logs.map((log) => {
        const fields = log.changes ? Object.keys(log.changes) : []
        return (
          <li key={log.id} className="space-y-1.5 py-2.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{ADMIN_EDIT_ACTION_LABELS[log.action] ?? log.action}</Badge>
              <span className="text-xs text-muted-foreground">{formatDateTime(new Date(log.createdAt))}</span>
              <span className="text-xs text-muted-foreground">
                · {log.adminName || `#${log.adminId}`}
                {log.adminName ? <span className="ml-0.5">#{log.adminId}</span> : null}
              </span>
            </div>

            {showTarget ? (
              <p className="text-xs text-muted-foreground">
                {ADMIN_EDIT_TARGET_LABELS[log.targetType] ?? log.targetType}
                {log.groupTitle && log.targetType === "question" ? ` · 所属题组：${log.groupTitle}` : ""}
              </p>
            ) : null}

            <p className="line-clamp-2 text-sm leading-snug" title={log.targetLabel}>
              {log.targetLabel}
            </p>

            {fields.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1">
                  {fields.map((field) => (
                    <Badge key={field} variant="secondary" className="font-normal">
                      {fieldLabel(field)}
                    </Badge>
                  ))}
                </div>
                <details className="group text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none hover:text-foreground">查看改动前后</summary>
                  <dl className="mt-1 space-y-1.5">
                    {fields.map((field) => {
                      const change = log.changes![field]
                      return (
                        <div key={field} className="rounded-md border border-border bg-muted/30 p-2">
                          <dt className="font-medium text-foreground">{fieldLabel(field)}</dt>
                          <dd className="mt-1 space-y-1">
                            <p className="break-all">
                              <span className="text-muted-foreground">改前：</span>
                              {previewLine(change, "before")}
                              {lengthText(change, "before")}
                            </p>
                            <p className="break-all">
                              <span className="text-muted-foreground">改后：</span>
                              {previewLine(change, "after")}
                              {lengthText(change, "after")}
                            </p>
                            <details className="mt-1">
                              <summary className="cursor-pointer select-none hover:text-foreground">
                                展开原文（最多 800 字预览）
                              </summary>
                              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-background/60 p-2 text-[11px] leading-relaxed">
                                {change.after ?? "（空）"}
                              </pre>
                            </details>
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                </details>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">无字段级改动（例如仅替换了封面文件）。</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
