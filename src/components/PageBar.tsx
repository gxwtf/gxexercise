"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react"

/** 计算页码窗口：首尾固定 + 当前页左右 span 个 + 省略号 */
export function getPageWindow(current: number, pageCount: number, span = 1): (number | "ellipsis")[] {
  if (pageCount <= 0) return []
  const pages = new Set<number>([1, pageCount])
  for (let p = current - span; p <= current + span; p++) {
    if (p >= 1 && p <= pageCount) pages.add(p)
  }
  const sorted = Array.from(pages).sort((a, b) => a - b)
  const out: (number | "ellipsis")[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("ellipsis")
    out.push(p)
    prev = p
  }
  return out
}

export interface PageBarProps {
  /** 当前页，从 1 开始 */
  page: number
  pageCount: number
  /** 传了 hrefForPage 就用真实链接（服务端分页，最稳）；否则用回调（客户端分页） */
  hrefForPage?: (page: number) => string
  onPageChange?: (page: number) => void
  totalItems?: number
  pageSize?: number
  unit?: string
  className?: string
  showLabel?: boolean
}

const itemClass = (active: boolean) =>
  cn(
    // 不固定宽度：一位数是 8 的方形，两位数（10+）会自然变宽，不会压到相邻按钮
    buttonVariants({ variant: active ? "default" : "ghost", size: "default" }),
    "h-8 min-w-8 shrink-0 px-2 tabular-nums active:translate-y-0"
  )

/** 通用页码条：优先用链接跳转，避免依赖客户端状态；移动端自动收起文字 */
export function PageBar({
  page,
  pageCount,
  hrefForPage,
  onPageChange,
  totalItems,
  pageSize,
  unit = "条",
  className,
  showLabel = true,
}: PageBarProps) {
  if (pageCount <= 1) return null

  const linkMode = typeof hrefForPage === "function"
  const hrefOf = (p: number) => (hrefForPage ? hrefForPage(p) : "#")
  const go = (p: number) => {
    const next = Math.min(Math.max(1, p), pageCount)
    if (next !== page && onPageChange) onPageChange(next)
  }

  const windowItems = getPageWindow(page, pageCount, pageCount > 7 ? 1 : 3)
  const from = totalItems ? (page - 1) * (pageSize ?? 12) + 1 : undefined
  const to = totalItems && pageSize ? Math.min(page * pageSize, totalItems) : undefined

  const renderItem = (
    key: string,
    content: React.ReactNode,
    opts: { href?: string; onClick?: () => void; label: string; disabled?: boolean; active?: boolean }
  ) => {
    const className = cn(itemClass(Boolean(opts.active)), opts.label.includes("上一页") || opts.label.includes("下一页") ? "gap-1 px-2.5" : "")
    if (opts.disabled) {
      return (
        <li key={key}>
          <span aria-disabled className={cn(className, "pointer-events-none opacity-40")} aria-label={opts.label}>
            {content}
          </span>
        </li>
      )
    }
    return (
      <li key={key}>
        {linkMode ? (
          <Link href={opts.href ?? "#"} aria-label={opts.label} aria-current={opts.active ? "page" : undefined} className={className}>
            {content}
          </Link>
        ) : (
          <button type="button" onClick={opts.onClick} aria-label={opts.label} aria-current={opts.active ? "page" : undefined} className={className}>
            {content}
          </button>
        )}
      </li>
    )
  }

  return (
    <div className={cn("mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between", className)}>
      {showLabel && (
        <p className="text-xs text-muted-foreground sm:text-sm">
          {typeof totalItems === "number" && (
            <span>
              共 {totalItems} {unit}
              {from && to ? `（当前 ${from}–${to}）` : ""}
              {" · "}
            </span>
          )}
          第 {page} / {pageCount} 页
        </p>
      )}

      <nav role="navigation" aria-label="pagination" className="mx-0 flex w-auto justify-center sm:justify-end">
        <ul className="flex flex-row flex-wrap items-center justify-center gap-1">
          {renderItem("prev", <><ChevronLeftIcon className="size-4" /><span className="hidden sm:inline">上一页</span></>, {
            href: hrefOf(page - 1),
            onClick: () => go(page - 1),
            label: "上一页",
            disabled: page <= 1,
          })}

          {windowItems.map((item, idx) =>
            item === "ellipsis" ? (
              <li key={`e-${idx}`} className="hidden sm:block">
                <span aria-hidden className="flex size-8 items-center justify-center">
                  <MoreHorizontalIcon className="size-4" />
                </span>
              </li>
            ) : (
              renderItem(String(item), item, {
                href: hrefOf(item),
                onClick: () => go(item),
                label: `第 ${item} 页`,
                active: item === page,
              })
            )
          )}

          {renderItem("next", <><span className="hidden sm:inline">下一页</span><ChevronRightIcon className="size-4" /></>, {
            href: hrefOf(page + 1),
            onClick: () => go(page + 1),
            label: "下一页",
            disabled: page >= pageCount,
          })}
        </ul>
      </nav>
    </div>
  )
}
