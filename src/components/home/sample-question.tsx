"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * 首页「免登录试一道」：题目全部来自北京高考真题（`/api/home-sample`）。
 * 先选（不揭晓）→ 点「看看答案」才判分；判分前也能「换一道」。
 */

interface Sample {
  id: string
  subject: string
  topic: string
  prompt: string
  options: { id: string; label: string }[]
  analysisAvailable: boolean
  continueHref: string
}

interface GradeResult {
  correct: boolean
  correctOptionId: string
  analysis: string
  continueHref: string
}

type Status = "loading" | "idle" | "grading" | "done" | "error"

export default function SampleQuestion() {
  const [sample, setSample] = useState<Sample | null>(null)
  const [selected, setSelected] = useState<string>("")
  const [result, setResult] = useState<GradeResult | null>(null)
  const [status, setStatus] = useState<Status>("loading")
  const [error, setError] = useState<string>("")
  const alive = useRef(true)

  const load = useCallback(async () => {
    setStatus("loading")
    setError("")
    setSample(null)
    setSelected("")
    setResult(null)
    try {
      const res = await fetch("/api/home-sample", { cache: "no-store", headers: { Accept: "application/json" } })
      const data = await res.json()
      if (!alive.current) return
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "暂时取不到体验题")
        setStatus("error")
        return
      }
      setSample(data as Sample)
      setStatus("idle")
    } catch {
      if (!alive.current) return
      setError("网络不太顺，稍后再试一次。")
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [load])

  const submit = useCallback(async () => {
    if (!sample || !selected || status === "grading") return
    setStatus("grading")
    try {
      const res = await fetch("/api/home-sample", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: sample.id, selected }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "核对答案失败")
        setStatus("error")
        return
      }
      setResult(data as GradeResult)
      setStatus("done")
    } catch {
      setError("网络不太顺，稍后再试一次。")
      setStatus("error")
    }
  }, [sample, selected, status])

  const optionVariant = (id: string) => {
    if (status === "done" && result) {
      if (id === result.correctOptionId)
        return "border-green-500 bg-green-50 text-green-700 dark:border-green-400 dark:bg-green-950 dark:text-green-300"
      if (id === selected)
        return "border-red-500 bg-red-50 text-red-700 dark:border-red-400 dark:bg-red-950 dark:text-red-300"
      return "border-border text-muted-foreground"
    }
    if (id === selected) return "border-primary bg-accent text-accent-foreground"
    return "border-border bg-background text-foreground hover:bg-muted"
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            先做一道真题
            {sample && (
              <Badge variant="outline">
                {sample.subject} · {sample.topic}
              </Badge>
            )}
          </CardTitle>
          <span className="text-xs text-muted-foreground">不用登录，做完就能看答案与解析</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {status === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            <span className="size-3.5 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden="true" />
            正在准备一道体验题…
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">{error || "暂时取不到体验题。"}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RotateCcw aria-hidden="true" />
              再试一次
            </Button>
          </div>
        )}

        {sample && status !== "error" && (
          <>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">{sample.prompt}</p>

            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="选择你的答案">
              {sample.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelected(opt.id)}
                  disabled={status === "grading" || status === "done"}
                  aria-pressed={selected === opt.id}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${optionVariant(opt.id)}`}
                >
                  <span className="mt-0.5 shrink-0 font-medium">{opt.id}</span>
                  <span className="whitespace-pre-wrap">{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {status !== "done" ? (
                <>
                  <Button onClick={() => void submit()} disabled={!selected || status === "grading"}>
                    {status === "grading" ? "正在核对…" : "看看答案"}
                  </Button>
                  <Button variant="outline" onClick={() => void load()}>
                    <RotateCcw aria-hidden="true" />
                    换一道
                  </Button>
                  {!selected && <span className="text-xs text-muted-foreground">选一个选项再点「看看答案」</span>}
                </>
              ) : (
                <>
                  <Badge
                    variant="outline"
                    className={
                      result?.correct
                        ? "border-green-500 bg-green-50 text-green-700 dark:border-green-400 dark:bg-green-950 dark:text-green-300"
                        : "border-red-500 bg-red-50 text-red-700 dark:border-red-400 dark:bg-red-950 dark:text-red-300"
                    }
                  >
                    {result?.correct ? "答对了" : `正确答案 ${result?.correctOptionId}`}
                  </Badge>
                  <Button asChild>
                    <Link href={result?.continueHref ?? "/questions"}>
                      去题库继续练
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={() => void load()}>
                    <RotateCcw aria-hidden="true" />
                    换一道
                  </Button>
                </>
              )}
            </div>

            {status === "done" && result && (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {result.analysis ? "解析" : "说明"}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {result.analysis || "这道真题的原卷没有附解析，可以去题库里看答案与同类题。"}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
