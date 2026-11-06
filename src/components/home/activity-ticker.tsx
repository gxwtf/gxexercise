"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

/**
 * 「最近谁练了什么」的滚动一行（类似直播带货的「谁又下了一单」）。
 *
 * - 静态可用：默认显示第一条，坏了也只是不轮播；
 * - 每 5 秒换下一条，淡入淡出；`prefers-reduced-motion` 下不轮播（只显示第一条）；
 * - 整行可点，进对应套卷成绩页 / 题组回顾页。
 */
export interface ActivityItemView {
  id: string
  userName: string
  title: string
  href: string
  atLabel: string
  kindLabel: string
}

export default function ActivityTicker({ items }: { items: ActivityItemView[] }) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const count = items.length
  const reduceMotion = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  useEffect(() => {
    if (count < 2 || reduceMotion) return
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % count)
        setVisible(true)
      }, 220)
    }, 5000)
    return () => clearInterval(timer)
  }, [count, reduceMotion])

  if (!count) return null
  const item = items[index] ?? items[0]

  return (
    <p
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground"
      aria-live="off"
    >
      <span className="relative flex size-2 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex size-2 animate-ping rounded-full bg-brand opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-brand" />
      </span>
      <span>{item.atLabel}</span>
      <Link
        href={item.href}
        className={`inline-flex flex-wrap items-center gap-x-1.5 transition-opacity duration-200 hover:underline ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="font-medium text-foreground">{item.userName}</span>
        <span>做完了一份{item.kindLabel}</span>
        <span className="max-w-[22rem] truncate text-foreground">{item.title}</span>
      </Link>
    </p>
  )
}
