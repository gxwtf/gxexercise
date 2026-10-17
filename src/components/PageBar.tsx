"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

/** 计算页码窗口：首页/末页固定，当前页左右各 span 个，中间用省略号 */
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
  onPageChange: (page: number) => void
  /** 可选：显示总数信息，如"共 222 条" */
  totalItems?: number
  pageSize?: number
  /** 条目单位，默认"条" */
  unit?: string
  className?: string
  /** 是否显示「第 x/y 页」文字 */
  showLabel?: boolean
}

/**
 * 通用页码条：基于 shadcn Pagination。
 * 移动端自动隐藏「上一页/下一页」文字，只留箭头，避免横向溢出。
 */
export function PageBar({
  page,
  pageCount,
  onPageChange,
  totalItems,
  pageSize,
  unit = "条",
  className,
  showLabel = true,
}: PageBarProps) {
  if (pageCount <= 1) return null

  const go = (p: number) => {
    const next = Math.min(Math.max(1, p), pageCount)
    if (next !== page) onPageChange(next)
  }

  const window = getPageWindow(page, pageCount, pageCount > 7 ? 1 : 3)

  return (
    <div className={cn("mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between", className)}>
      {showLabel && (
        <p className="text-xs text-muted-foreground sm:text-sm">
          {typeof totalItems === "number" && (
            <span>
              共 {totalItems} {unit}
              {" · "}
            </span>
          )}
          第 {page} / {pageCount} 页
          {pageSize ? `（每页 ${pageSize} 条）` : ""}
        </p>
      )}

      <Pagination className="mx-0 w-auto justify-center sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={() => go(page - 1)} disabled={page <= 1} aria-disabled={page <= 1} />
          </PaginationItem>

          {window.map((item, idx) =>
            item === "ellipsis" ? (
              <PaginationItem key={`e-${idx}`} className="hidden sm:block">
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  isActive={item === page}
                  onClick={() => go(item)}
                  aria-label={`第 ${item} 页`}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            )
          )}

          <PaginationItem>
            <PaginationNext onClick={() => go(page + 1)} disabled={page >= pageCount} aria-disabled={page >= pageCount} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
