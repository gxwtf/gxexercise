"use client"

import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ProgressCircle } from "@/components/ui/progress-circle"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Clock } from "lucide-react"

interface QuestionSubResult {
  questionId: string
  questionNumber: number
  questionIndex: number
  isCorrect: boolean | null
}

interface GroupResult {
  id: string
  groupSubmissionId: string
  title: string
  questionType: string
  score: number | null
  maxScore: number | null
  correctNum: number | null
  totalNum: number | null
  isCorrect: boolean | null
  hasUnreviewed: boolean
  hasWrong: boolean
  allCorrect: boolean
  questionSubmissions: QuestionSubResult[]
}

interface SubmissionHistoryItem {
  id: string
  score: number | null
  submittedAt: Date | null
}

interface TestPaperResultProps {
  testPaperId: string
  testPaperTitle: string
  totalScore: number | null
  totalDuration: number | null
  totalScoreMax: number | null
  groupResults: GroupResult[]
  submissionHistory?: SubmissionHistoryItem[]
  currentSubmissionId?: string
}

export function TestPaperResult({
  testPaperId,
  testPaperTitle,
  totalScore,
  totalDuration,
  totalScoreMax,
  groupResults,
  submissionHistory = [],
  currentSubmissionId,
}: TestPaperResultProps) {
  const router = useRouter()

  const formatTime = (totalSeconds: number | null) => {
    if (totalSeconds == null) return "-"
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    if (hours > 0) {
      return `${hours}小时${minutes}分${secs}秒`
    }
    if (minutes > 0) {
      return `${minutes}分${secs}秒`
    }
    return `${secs}秒`
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "-"
    const d = new Date(date)
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-6">{testPaperTitle}</h1>

          <div className="flex items-center justify-center gap-12 mb-6">
            <div className="flex flex-col items-center gap-2">
              <ProgressCircle
                correct={totalScore ?? 0}
                total={totalScoreMax ?? 100}
                size={96}
                strokeWidth={8}
                fontSize="text-lg"
              />
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="text-xl font-semibold">{formatTime(totalDuration)}</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3">
            <h2 className="text-lg font-semibold">答题记录详情</h2>
          </div>

          <div className="space-y-4">
            {groupResults.map((group, groupIndex) => (
              <div key={group.id}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground font-medium w-6">{groupIndex + 1}</span>
                    <span className="font-medium">{group.title}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {group.maxScore != null && group.maxScore > 0 && (
                      <div className="w-20 h-1.5 rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-all bg-blue-500"
                          style={{ width: `${Math.min(((group.score ?? 0) / group.maxScore) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                    <span>
                      <span className="font-medium text-foreground">{group.score ?? "-"}</span> / {group.maxScore ?? group.totalNum ?? "-"}
                    </span>
                    {group.hasUnreviewed && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                        评阅中
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-9">
                  {group.questionSubmissions.map((qs) => {
                    const isCorrect = qs.isCorrect
                    return (
                      <div
                        key={qs.questionId}
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-1 cursor-pointer hover:opacity-80 transition-opacity",
                          isCorrect === true
                            ? "bg-green-100 border-green-500 text-green-700 dark:bg-green-950 dark:border-green-400 dark:text-green-300"
                            : isCorrect === false
                              ? "bg-red-100 border-red-500 text-red-700 dark:bg-red-950 dark:border-red-400 dark:text-red-300"
                              : "bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-950 dark:border-amber-400 dark:text-amber-300"
                        )}
                        onClick={() => router.push(`/question/${group.id}/review/${qs.questionIndex}`)}
                      >
                        {qs.questionNumber}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {groupResults.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                暂无记录
              </div>
            )}
          </div>
        </div>

        {submissionHistory.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-3">练习记录</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">序号</TableHead>
                  <TableHead className="text-center">得分</TableHead>
                  <TableHead className="text-right">答题时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissionHistory.map((sub, index) => {
                  const isCurrent = sub.id === currentSubmissionId
                  return (
                    <TableRow
                      key={sub.id}
                      className={cn(
                        "cursor-pointer transition-colors h-14",
                        isCurrent ? "bg-muted hover:bg-muted/80" : "hover:bg-muted/50"
                      )}
                      onClick={() => router.push(`/test-paper/${testPaperId}/result/${sub.id}`)}
                    >
                      <TableCell className="font-medium">
                        {isCurrent && <span className="text-xs text-muted-foreground mr-1">★</span>}
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{sub.score ?? "-"}</span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(sub.submittedAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}