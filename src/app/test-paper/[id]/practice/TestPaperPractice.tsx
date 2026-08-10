"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MDXRemoteSerializeResult } from "next-mdx-remote"
import { Button } from "@/components/ui/button"
import { Clock, ChevronLeft, ChevronRight, Send, LayoutGrid } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import useSession from "@/lib/use-session"
import { useAlertContext } from "@/components/alert-provider"
import { useAnswer } from "@/components/question-group/AnswerContext"
import { QuestionSection } from "@/components/QuestionSection"
import Problem from "@/components/question-group/Problem"
import Grammar from "@/components/question-group/grammar"
import SevenChooseFive from "@/components/question-group/seven-choose-five"

const STORAGE_KEY = (id: string) => `exam_state_${id}`
const ANSWERS_KEY = (id: string) => `exam_answers_test-paper-${id}`

interface QuestionPracticeData {
  id: string
  stem: string
  stemMdx: MDXRemoteSerializeResult | null
  type: "single" | "multiple" | "input" | "text"
  options: Array<{ id: string; label: string; labelMdx: MDXRemoteSerializeResult | null }>
  answer: string
}

interface GroupPracticeData {
  id: string
  title: string
  questionType: string
  content: string | null
  contentMdx: MDXRemoteSerializeResult | null
  questions: QuestionPracticeData[]
  startQuestionNumber: number
  score: number | null
}

interface TestPaperPracticeProps {
  testPaperId: string
  testPaperTitle: string
  testPaperDuration: number | null
  groupsData: GroupPracticeData[]
}

export function TestPaperPractice({
  testPaperId,
  testPaperTitle,
  testPaperDuration,
  groupsData,
}: TestPaperPracticeProps) {
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
  const [timerStart, setTimerStart] = useState<number | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let startTime: number
    try {
      const saved = localStorage.getItem(STORAGE_KEY(testPaperId))
      if (saved) {
        const { startTime: savedStart, groupIndex: savedGroup } = JSON.parse(saved)
        if (typeof savedStart === "number") {
          startTime = savedStart
        } else {
          startTime = Date.now()
        }
        if (typeof savedGroup === "number" && savedGroup >= 0 && savedGroup < groupsData.length) {
          setCurrentGroupIndex(savedGroup)
        }
      } else {
        startTime = Date.now()
      }
    } catch {
      startTime = Date.now()
    }
    setTimerStart(startTime)
  }, [testPaperId, groupsData.length])
  const { session } = useSession()
  const router = useRouter()
  const { showAlert } = useAlertContext()
  const { getAllAnswers, answers } = useAnswer()

  const totalGroups = groupsData.length
  const currentGroup = groupsData[currentGroupIndex]
  const isFirstGroup = currentGroupIndex === 0
  const isLastGroup = currentGroupIndex === totalGroups - 1

  useEffect(() => {
    if (timerStart === null) return
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - timerStart) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [timerStart])

  useEffect(() => {
    if (timerStart === null) return
    try {
      localStorage.setItem(STORAGE_KEY(testPaperId), JSON.stringify({
        groupIndex: currentGroupIndex,
        startTime: timerStart,
      }))
    } catch {}
  }, [timerStart, testPaperId])

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const saveState = useCallback((targetGroupIndex?: number) => {
    const idx = targetGroupIndex ?? currentGroupIndex
    try {
      localStorage.setItem(STORAGE_KEY(testPaperId), JSON.stringify({
        groupIndex: idx,
        startTime: timerStart ?? Date.now(),
      }))
      const allAnswers = getAllAnswers()
      const answersRecord: Record<string, typeof allAnswers[number]> = {}
      for (const a of allAnswers) {
        answersRecord[a.questionId] = a
      }
      localStorage.setItem(ANSWERS_KEY(testPaperId), JSON.stringify(answersRecord))
    } catch {}
  }, [testPaperId, currentGroupIndex, timerStart, getAllAnswers])

  const handlePrev = useCallback(() => {
    if (currentGroupIndex > 0) {
      const target = currentGroupIndex - 1
      saveState(target)
      setCurrentGroupIndex(target)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [currentGroupIndex, saveState])

  const handleNext = useCallback(() => {
    if (currentGroupIndex < totalGroups - 1) {
      const target = currentGroupIndex + 1
      saveState(target)
      setCurrentGroupIndex(target)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [currentGroupIndex, totalGroups, saveState])

  const handleSubmit = useCallback(async () => {
    if (!session.userid) {
      showAlert({ type: 'destructive', title: '请先登录' })
      router.push(`/login?back=/test-paper/${testPaperId}`)
      return
    }

    setIsSubmitting(true)

    try {
      const allAnswers = getAllAnswers()

      const groupSubmissions = groupsData.map((group) => {
        const groupQuestions = group.questions
        const questionSubmissions = groupQuestions
          .map((q) => {
            const answer = allAnswers.find((a) => a.questionId === q.id)
            return {
              questionId: q.id,
              content: answer?.content || { answer: "" },
            }
          })

        return {
          questionGroupId: group.id,
          duration: Math.floor(seconds / totalGroups),
          questionSubmissions,
        }
      })

      const response = await fetch("/api/submissions/test-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.userid,
          testPaperId,
          duration: seconds,
          groupSubmissions,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        try { localStorage.removeItem(STORAGE_KEY(testPaperId)) } catch {}
        try { localStorage.removeItem(ANSWERS_KEY(testPaperId)) } catch {}
        router.push(`/test-paper/${testPaperId}/result/${result.submissionId}`)
      } else {
        const error = await response.json()
        alert(error.error || "提交失败")
      }
    } catch (error) {
      console.error("Submit error:", error)
      alert("提交失败")
    } finally {
      setIsSubmitting(false)
    }
  }, [session.userid, testPaperId, seconds, groupsData, getAllAnswers, router, totalGroups])

  const isQuestionAnswered = useCallback((questionId: string) => {
    const answer = answers[questionId]?.content.answer as string | undefined
    return answer != null && answer !== ""
  }, [answers])

  const handleJumpToGroup = useCallback((groupIndex: number) => {
    saveState(groupIndex)
    setCurrentGroupIndex(groupIndex)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [saveState])

  const renderGroup = () => {
    if (!currentGroup) return null

    const { questionType, contentMdx, questions, startQuestionNumber, content } = currentGroup

    if (questionType === "cloze") {
      return (
        <Problem
          questions={questions as any}
          mdxSource={contentMdx}
          language="en"
          indentParagraphs
          startQuestionNumber={startQuestionNumber}
        />
      )
    }

    if (questionType === "grammar") {
      return (
        <Grammar
          questions={questions as any}
          mdxSource={contentMdx!}
          startQuestionNumber={startQuestionNumber}
        />
      )
    }

    if (questionType === "word-choice") {
      return (
        <>
          {content && (
            <div className="max-w-4xl mx-auto px-6 mt-4">
              <QuestionSection>
                <div className="border-1 border-black p-4 text-lg">{content}</div>
              </QuestionSection>
            </div>
          )}
          <Problem
            questions={questions as any}
            language="en"
            startQuestionNumber={startQuestionNumber}
          />
        </>
      )
    }

    if (questionType === "chinese-dictation") {
      return (
        <Grammar
          questions={questions as any}
          mdxSource={contentMdx!}
          startQuestionNumber={startQuestionNumber}
        />
      )
    }

    if (questionType === "en-reading") {
      return (
        <Problem
          questions={questions as any}
          mdxSource={contentMdx}
          language="en"
          startQuestionNumber={startQuestionNumber}
        />
      )
    }

    if (questionType === "seven-choose-five") {
      return (
        <SevenChooseFive
          questions={questions as any}
          mdxSource={contentMdx!}
          startQuestionNumber={startQuestionNumber}
        />
      )
    }

    if (questionType === "reading-expression") {
      return (
        <Problem
          questions={questions as any}
          mdxSource={contentMdx}
          language="en"
          minHeight="min-h-20"
          startQuestionNumber={startQuestionNumber}
        />
      )
    }

    if (questionType === "en-writing") {
      return (
        <Problem
          questions={questions as any}
          language="en"
          minHeight="min-h-64"
          showWordCount
          startQuestionNumber={startQuestionNumber}
        />
      )
    }

    if (questionType === "chinese-micro-writing") {
      return (
        <Problem
          questions={questions as any}
          language="zh"
          showWordCount
          startQuestionNumber={startQuestionNumber}
        />
      )
    }

    if (questionType === "chinese-essay") {
      return (
        <Problem
          questions={questions as any}
          language="zh"
          minHeight="min-h-64"
          showWordCount
          startQuestionNumber={startQuestionNumber}
        />
      )
    }

    if (questionType === "math-fill") {
      return (
        <Problem
          questions={questions as any}
          language="zh"
          startQuestionNumber={startQuestionNumber}
        />
      )
    }

    if (questionType === "math-choice") {
      return (
        <Problem
          questions={questions as any}
          language="zh"
          startQuestionNumber={startQuestionNumber}
        />
      )
    }

    if (questionType === "chinese-reading") {
      return (
        <Problem
          questions={questions as any}
          mdxSource={contentMdx}
          language="zh"
          startQuestionNumber={startQuestionNumber}
        />
      )
    }

    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">题组: {currentGroup.title}</h1>
        <p>题型: {questionType}</p>
        <p>暂不支持的题型</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between h-16 px-6">
          <h1 className="flex items-center gap-3 text-xl font-semibold text-foreground truncate">
            <span className="truncate">{testPaperTitle}</span>
            {currentGroup && (
              <span className="text-muted-foreground text-sm font-normal whitespace-nowrap">
                {currentGroup.title}（共{currentGroup.questions.length}小题{currentGroup.score != null ? `；共${currentGroup.score}分` : ""}）
              </span>
            )}
          </h1>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-sm font-medium">{formatTime(seconds)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <LayoutGrid className="w-4 h-4" />
                    答题卡
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 max-h-96 overflow-y-auto" align="end">
                  <div className="space-y-3">
                    {groupsData.map((group, groupIndex) => {
                      const answeredCount = group.questions.filter((q) => isQuestionAnswered(q.id)).length
                      const totalCount = group.questions.length
                      return (
                        <div key={group.id}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-muted-foreground w-5">{groupIndex + 1}</span>
                            <span className="text-sm font-medium flex-1 truncate">{group.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {answeredCount}/{totalCount}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pl-7">
                            {group.questions.map((q, qi) => {
                              const answered = isQuestionAnswered(q.id)
                              return (
                                <button
                                  key={q.id}
                                  className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors cursor-pointer",
                                    answered
                                      ? "bg-blue-100 border-blue-400 text-blue-700 dark:bg-blue-950 dark:border-blue-400 dark:text-blue-300 hover:bg-blue-200"
                                      : "bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-200"
                                  )}
                                  onClick={() => {
                                    handleJumpToGroup(groupIndex)
                                  }}
                                >
                                  {qi + 1}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              {!isFirstGroup && (
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一题
                </Button>
              )}

              {isLastGroup ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "提交中..." : "提交"}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className="flex items-center gap-1"
                >
                  下一题
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">{renderGroup()}</div>
    </div>
  )
}