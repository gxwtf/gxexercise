"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  const [onlyWrong, setOnlyWrong] = useState(false)

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

  const filteredGroups = useMemo(() => {
    if (!onlyWrong) return groupResults
    return groupResults.filter((g) => g.hasWrong || g.hasUnreviewed)
  }, [groupResults, onlyWrong])

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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">答题记录详情</h2>
            <Button
              variant={onlyWrong ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlyWrong(!onlyWrong)}
            >
              只看错题
            </Button>
          </div>

          <Table>
            <TableBody>
              {filteredGroups.map((group, index) => (
                <TableRow
                  key={group.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/question/${group.id}/review`)}
                >
                  <TableCell className="w-[60px] text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-medium">{group.title}</TableCell>
                  <TableCell className="w-[120px] text-center">
                    {group.hasUnreviewed ? (
                      <span className="inline-flex items-center h-12 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                        评阅中
                      </span>
                    ) : (
                      <ProgressCircle
                        correct={group.score ?? 0}
                        total={group.maxScore ?? group.totalNum ?? 0}
                        size={48}
                        strokeWidth={6}
                        fontSize="text-xs"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredGroups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    暂无记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
                        <ProgressCircle
                          correct={sub.score ?? 0}
                          total={totalScoreMax ?? 100}
                          size={52}
                          strokeWidth={4}
                          fontSize="text-xs"
                        />
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