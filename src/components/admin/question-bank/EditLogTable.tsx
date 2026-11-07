import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { FieldChange } from "@/lib/admin-edit-log"
import {
  ADMIN_EDIT_ACTION_LABELS,
  ADMIN_EDIT_TARGET_LABELS,
  EDIT_FIELD_LABELS,
  GROUP_EDITABLE_FIELDS,
  QUESTION_EDITABLE_FIELDS,
} from "@/lib/question-bank-meta"

export interface EditLogRow {
  id: string
  /** 操作时间（已格式化） */
  time: string
  adminId: number
  adminName: string | null
  action: string
  targetType: string
  targetId: string
  targetLabel: string
  groupId: string | null
  groupTitle: string | null
  changes: Record<string, FieldChange> | null
}

/** 日志表里字段的展示顺序：沿用编辑页表单的字段顺序，未登记的字段排在最后 */
const FIELD_ORDER: string[] = Array.from(
  new Set<string>([...GROUP_EDITABLE_FIELDS, ...QUESTION_EDITABLE_FIELDS]),
)

const fieldRank = (field: string) => {
  const i = FIELD_ORDER.indexOf(field)
  return i < 0 ? FIELD_ORDER.length : i
}

/** 把 Json 列里取出来的 changes 收窄成 FieldChange 字典；脏数据/空对象一律当「没有字段级记录」 */
function normalizeChanges(raw: unknown): Record<string, FieldChange> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const out: Record<string, FieldChange> = {}
  for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue
    const entry = value as Record<string, unknown>
    out[field] = {
      before: typeof entry.before === "string" ? entry.before : null,
      after: typeof entry.after === "string" ? entry.after : null,
      ...(typeof entry.beforeLength === "number" ? { beforeLength: entry.beforeLength } : {}),
      ...(typeof entry.afterLength === "number" ? { afterLength: entry.afterLength } : {}),
    }
  }
  return Object.keys(out).length > 0 ? out : null
}

/** 长文本预览块：日志里每个字段最多 800 字，但换行很多时也要能滚起来 */
function ValuePreview({ value }: { value: string | null }) {
  return (
    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-muted/40 p-2 text-xs">
      {value ?? "（空）"}
    </pre>
  )
}

/** 字段级改动明细：逐字段并列「改动前 / 改动后」，长字段额外标出原始字数 */
function ChangesDetail({ changes }: { changes: Record<string, FieldChange> }) {
  const fields = Object.keys(changes).sort((a, b) => fieldRank(a) - fieldRank(b))
  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const entry = changes[field]
        const hasLength =
          typeof entry.beforeLength === "number" || typeof entry.afterLength === "number"
        return (
          <div key={field} className="space-y-1">
            <p className="text-xs font-medium">{EDIT_FIELD_LABELS[field] ?? field}</p>
            <div className="grid gap-1 sm:grid-cols-2">
              <div>
                <p className="mb-0.5 text-xs text-muted-foreground">改动前</p>
                <ValuePreview value={entry.before} />
              </div>
              <div>
                <p className="mb-0.5 text-xs text-muted-foreground">改动后</p>
                <ValuePreview value={entry.after} />
              </div>
            </div>
            {hasLength && (
              <p className="text-xs text-muted-foreground">
                共 {entry.beforeLength ?? 0} 字 → 共 {entry.afterLength ?? 0} 字
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * 修改记录表格：一行一次改动。
 * 详情用 <details> 就地展开（项目没有 dialog 组件，也不值得为此加弹窗）。
 */
export function EditLogTable({ rows }: { rows: EditLogRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">时间</TableHead>
            <TableHead className="w-[150px]">管理员</TableHead>
            <TableHead className="w-[110px]">动作</TableHead>
            <TableHead>对象</TableHead>
            <TableHead className="w-[180px]">改动字段</TableHead>
            <TableHead className="w-[96px]">详情</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const changes = normalizeChanges(row.changes)
            const fields = changes
              ? Object.keys(changes).sort((a, b) => fieldRank(a) - fieldRank(b))
              : []
            // 题组日志点进该题组；小题日志点进它所属的题组（没有所属题组就只能纯文本）
            const href =
              row.targetType === "group"
                ? `/admin/questions/${row.targetId}`
                : row.groupId
                  ? `/admin/questions/${row.groupId}`
                  : null
            return (
              <TableRow key={row.id} className="transition-colors hover:bg-muted/50">
                <TableCell className="whitespace-nowrap align-top text-muted-foreground">
                  {row.time}
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex flex-col gap-0.5">
                    <span className="block max-w-[140px] truncate">{row.adminName || "（未记录用户名）"}</span>
                    <span className="text-xs text-muted-foreground">#{row.adminId}</span>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant="secondary">{ADMIN_EDIT_ACTION_LABELS[row.action] ?? row.action}</Badge>
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      {ADMIN_EDIT_TARGET_LABELS[row.targetType] ?? row.targetType}
                    </span>
                    {href ? (
                      <Link href={href} className="block max-w-[360px] truncate font-medium hover:text-primary">
                        {row.targetLabel}
                      </Link>
                    ) : (
                      <span className="block max-w-[360px] truncate font-medium">{row.targetLabel}</span>
                    )}
                    {/* 小题日志回填所属题组；题组本身的日志再显示一遍就是重复信息 */}
                    {row.targetType === "question" && row.groupTitle ? (
                      <span className="max-w-[360px] truncate text-xs text-muted-foreground">
                        所属题组：{row.groupTitle}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  {fields.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {fields.map((field) => (
                        <Badge key={field} variant="outline">
                          {EDIT_FIELD_LABELS[field] ?? field}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {changes ? (
                    <details>
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        展开（{fields.length} 项）
                      </summary>
                      {/* 展开后内容会把这一列撑宽，容器已有 overflow-x-auto，窄屏下横向滚动查看 */}
                      <div className="mt-2 w-[min(78vw,680px)] rounded-md border border-border p-2">
                        <ChangesDetail changes={changes} />
                      </div>
                    </details>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
