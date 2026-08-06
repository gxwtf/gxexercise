"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MDXRemoteSerializeResult } from "next-mdx-remote"
import { Button } from "@/components/ui/button"
import { Clock, ChevronLeft, ChevronRight, Send } from "lucide-react"
import useSession from "@/lib/use-session"
import { useAnswer } from "@/components/question-group/AnswerContext"
import { QuestionSection } from "@/components/QuestionSection"
import Problem from "@/components/question-group/Problem"
import Grammar from "@/components/question-group/grammar"
import SevenChooseFive from "@/components/question-group/seven-choose-five"

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
  const [seconds, setSeconds] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { session } = useSession()
  const router = useRouter()
  const { getAllAnswers } = useAnswer()

  const totalGroups = groupsData.length
  const currentGroup = groupsData[currentGroupIndex]
  const isFirstGroup = currentGroupIndex === 0
  const isLastGroup = currentGroupIndex === totalGroups - 1

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handlePrev = useCallback(() => {
    if (currentGroupIndex > 0) {
      setCurrentGroupIndex((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [currentGroupIndex])

  const handleNext = useCallback(() => {
    if (currentGroupIndex < totalGroups - 1) {
      setCurrentGroupIndex((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [currentGroupIndex, totalGroups])

  const handleSubmit = useCallback(async () => {
    if (!session.userid) {
      alert("请先登录")
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
    <div className="min-h-screen bg-background">
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

      <div className="pb-20">{renderGroup()}</div>
    </div>
  )
}