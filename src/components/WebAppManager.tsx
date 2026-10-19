"use client"

import * as React from "react"
import { Download, X, Share } from "lucide-react"
import { Button } from "@/components/ui/button"

const DISMISS_KEY = "gxexercise-a2hs-dismissed"

/** 是否已经在「独立窗口」里运行（即已添加过主屏） */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function isWeChat(): boolean {
  if (typeof navigator === "undefined") return false
  return /MicroMessenger/i.test(navigator.userAgent)
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * 「添加到主屏幕」引导
 * - Android / Chrome / Edge：接住 beforeinstallprompt，显示按钮，点击直接弹系统安装框
 * - iOS Safari：没有安装 API，按步骤提示「分享 → 添加到主屏幕」
 * - 已在独立窗口运行、或用户点过「不再提示」→ 什么都不显示
 */
export function WebAppManager() {
  const [promptEvent, setPromptEvent] = React.useState<InstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(true)

  // 注册 Service Worker（可安装条件之一）
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
  }, [])

  React.useEffect(() => {
    let stored = false
    try {
      stored = localStorage.getItem(DISMISS_KEY) === "true"
    } catch {}
    setDismissed(stored)
    if (stored || isStandalone()) return

    // Android/Chrome：接住安装事件
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setPromptEvent(null)
      setShowIosHint(false)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)

    // iOS Safari：只能给操作指引（微信内置浏览器不支持添加主屏）
    if (isIos() && !isWeChat()) setShowIosHint(true)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const dismiss = React.useCallback(() => {
    setPromptEvent(null)
    setShowIosHint(false)
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, "true")
    } catch {}
  }, [])

  const install = React.useCallback(async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice?.catch(() => undefined)
    if (choice?.outcome === "accepted") setPromptEvent(null)
    else dismiss()
  }, [promptEvent, dismiss])

  if (dismissed || isStandalone()) return null
  if (!promptEvent && !showIosHint) return null

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96">
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-lg">
        <div className="flex items-start gap-3 p-3 sm:p-4">
          <div className="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
            <Download className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">添加到主屏幕</p>
            {promptEvent ? (
              <p className="mt-1 text-xs text-muted-foreground">
                把广学题库装到桌面，像 App 一样打开，做题更快。
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                点击下方的 <Share className="inline size-3.5 align-[-2px]" /> 分享按钮，
                选择「添加到主屏幕」即可。
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              {promptEvent && (
                <Button size="sm" onClick={install}>
                  立即添加
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={dismiss}>
                不再提示
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={dismiss}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
