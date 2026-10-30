"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface QueueStatusProps {
  submissionIds: string[]
  /** 轮询间隔（毫秒） */
  interval?: number
  /** panel：独立提示条（回顾页「我的作答」页签）；inline：紧跟在「评阅中」后面的小字 */
  variant?: "panel" | "inline"
}

/**
 * AI 批改排队位次：每 5 秒刷新一次「前面还有多少份」，
 * 一旦判完自动刷新页面把结果刷出来。
 */
export function QueueStatus({ submissionIds, interval = 5000, variant = "panel" }: QueueStatusProps) {
  const router = useRouter()
  const [position, setPosition] = React.useState<number | null>(null)
  const [checking, setChecking] = React.useState(true)
  const key = submissionIds.join(",")

  React.useEffect(() => {
    if (!key) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      try {
        const res = await fetch(`/api/submissions/queue-position?ids=${encodeURIComponent(key)}`, { cache: "no-store" })
        const json = await res.json()
        if (cancelled) return
        const items = Object.values((json?.data ?? {}) as Record<string, { pending: boolean; position: number }>)
        const stillPending = items.filter((i) => i.pending)
        if (stillPending.length === 0) {
          setChecking(false)
          setPosition(null)
          // 判完了：刷新服务端数据，页面直接显示成绩与批改
          router.refresh()
          return
        }
        setPosition(Math.min(...stillPending.map((i) => i.position ?? 0)))
        setChecking(false)
        timer = setTimeout(tick, interval)
      } catch {
        if (!cancelled) timer = setTimeout(tick, interval * 2)
      }
    }

    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [key, interval, router])

    const text =
      checking || position === null ? (
        <span>AI 批阅中…</span>
      ) : position === 0 ? (
        <span>AI 正在批改你的这份作答，马上出结果…</span>
      ) : (
        <span>
          AI 批阅中 · 当前排队第 <span className="font-semibold">{position + 1}</span> 位
          <span className="text-muted-foreground">（前面还有 {position} 份）</span>
        </span>
      )

    if (variant === "inline") {
      return (
        <span className="ml-2 inline-flex items-center gap-1 align-baseline text-sm font-normal text-amber-700 dark:text-amber-300">
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
          {text}
        </span>
      )
    }

    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        {text}
      </div>
    )
}
