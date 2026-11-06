"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, RotateCcw, Sparkles } from "lucide-react"

/**
 * 首页「免登录试一道」。
 *
 * 交互刻意做成两段：先选（不揭晓）→ 点「看看答案」才提交，避免一选中就泄底。
 * 数据全部来自 `/api/home-sample`：取题时不下发答案，判分也只在服务端做。
 */

interface Sample {
  id: string
  subject: string
  topic: string
  prompt: string
  options: { id: string; label: string }[]
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

  const optionClass = (id: string) => {
    const base =
      "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-base transition-colors"
    if (status === "done" && result) {
      if (id === result.correctOptionId)
        return `${base} border-green-500 bg-green-50 text-green-700 dark:border-green-400 dark:bg-green-950 dark:text-green-300`
      if (id === selected)
        return `${base} border-red-500 bg-red-50 text-red-700 dark:border-red-400 dark:bg-red-950 dark:text-red-300`
      return `${base} border-border bg-card text-muted-foreground`
    }
    if (id === selected) return `${base} border-brand bg-accent text-accent-foreground`
    return `${base} border-border bg-card text-card-foreground hover:border-brand/60 hover:bg-accent/60`
  }

  return (
    <section
      id="sample"
      className="mx-auto w-full max-w-5xl scroll-mt-20 px-6 py-14"
      aria-labelledby="sample-title"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-brand">
            <Sparkles className="size-4" aria-hidden="true" />
            先体验，再决定
          </p>
          <h2 id="sample-title" className="text-2xl font-bold text-foreground sm:text-3xl">
            不用登录，先做一道真题
          </h2>
        </div>
        {sample && (
          <p className="text-sm text-muted-foreground">
            取自{sample.subject} · {sample.topic}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-7">
        {status === "loading" && (
          <div className="flex items-center gap-3 text-muted-foreground" role="status" aria-live="polite">
            <span className="size-4 animate-spin rounded-full border-2 border-border border-t-brand" aria-hidden="true" />
            正在准备一道体验题…
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground">{error || "暂时取不到体验题。"}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              再试一次
            </button>
          </div>
        )}

        {sample && status !== "error" && (
          <>
            <p className="whitespace-pre-wrap text-lg leading-relaxed text-foreground">{sample.prompt}</p>

            <div className="mt-5 grid gap-2 sm:grid-cols-2" role="group" aria-label="选择你的答案">
              {sample.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={optionClass(opt.id)}
                  aria-pressed={selected === opt.id}
                  disabled={status === "grading" || status === "done"}
                  onClick={() => setSelected(opt.id)}
                >
                  <span className="mt-0.5 shrink-0 rounded-md border border-border bg-muted/50 px-1.5 text-sm font-semibold text-foreground">
                    {opt.id}
                  </span>
                  <span className="whitespace-pre-wrap">{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {status !== "done" && (
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!selected || status === "grading"}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {status === "grading" ? "正在核对…" : "看看答案"}
                </button>
              )}
              {status !== "done" && !selected && (
                <span className="text-sm text-muted-foreground">选一个选项，再点「看看答案」。</span>
              )}
              {status === "done" && result && (
                <>
                  <p
                    className={
                      result.correct
                        ? "text-base font-semibold text-green-700 dark:text-green-400"
                        : "text-base font-semibold text-red-700 dark:text-red-400"
                    }
                  >
                    {result.correct ? "答对了。" : `正确答案是 ${result.correctOptionId}。`}
                  </p>
                  <Link
                    href={result.continueHref}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  >
                    去题库继续练
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    换一道
                  </button>
                </>
              )}
            </div>

            {status === "done" && result?.analysis && (
              <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
                <p className="mb-1 text-sm font-semibold text-foreground">解析</p>
                <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">{result.analysis}</p>
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        体验题只用文字题干与标准解析；正式练习需要广学账号，作答与记录都会保存。
      </p>
    </section>
  )
}
