"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { FileText, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProgressCircle } from "@/components/ui/progress-circle"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import useSession from "@/lib/use-session"

interface GroupRowCardProps {
  id: string
  title: string
  questionType: string
  source: string
  tags: string[]
  score?: number | null
  completedCount?: number
  correctCount?: number
  totalQuestions?: number
  totalScore?: number
}

const subjectiveTypes = ["reading-expression", "阅读表达", "en-writing", "chinese-essay", "chinese-micro-writing"]
function isSubjective(t: string) {
  return subjectiveTypes.includes(t)
}

/**
 * 题组列表的「套卷样式」单行卡片：布局同套卷（横向 Item），
 * 但按钮与统计逻辑完全沿用原来的题组卡片（开始练习 / 回顾学习 + 进度圈）。
 */
export function GroupRowCard({
  id,
  title,
  questionType,
  source,
  tags,
  score,
  completedCount = 0,
  correctCount = 0,
  totalQuestions = 0,
  totalScore = 0,
}: GroupRowCardProps) {
  const { session } = useSession()
  const [userStats, setUserStats] = useState<{ correctNum: number; totalNum: number; score: number | null } | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      if (!session.userid) return
      try {
        const res = await fetch(`/api/submissions/group/stats?groupIds=${id}`)
        if (!res.ok) return
        const result = await res.json()
        if (result.success && result.data?.[id]) setUserStats(result.data[id])
      } catch {
        /* 忽略 */
      }
    }
    fetchStats()
  }, [session.userid, id])

  const displayCorrectCount = userStats?.correctNum ?? correctCount
  const displayTotalNum = userStats?.totalNum ?? totalQuestions
  const subjective = isSubjective(questionType)
  const displayScore = subjective ? (userStats?.score ?? 0) : displayCorrectCount
  const displayTotal = subjective ? (userStats?.score != null ? totalScore : 0) : displayTotalNum

  const year = tags?.find((t) => /^\d{4}$/.test(t))
  const grade = tags?.find((t) => t === "高一" || t === "高二" || t === "高三")
  const category = tags?.find((t) => ["一模", "二模", "期末", "上期末", "下期末", "真题", "模拟"].includes(t))

  return (
    <Item variant="outline" className="w-full">
      <ItemMedia variant="icon">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="mb-1 text-base font-semibold">{title}</ItemTitle>
        <ItemDescription className="flex flex-wrap items-center gap-1">
          <Badge variant="outline" className="text-xs">
            {category || source}
          </Badge>
          {year && (
            <Badge variant="secondary" className="text-xs">
              {year}年
            </Badge>
          )}
          {grade && (
            <Badge variant="outline" className="text-xs">
              {grade}
            </Badge>
          )}
          {score != null && score > 0 && (
            <Badge variant="outline" className="text-xs">
              {score}分
            </Badge>
          )}
          <span className="ml-1 flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="text-xs text-muted-foreground">{completedCount}</span>
          </span>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <ProgressCircle correct={displayScore} total={displayTotal} />
        <Button asChild>
          <Link href={`/question/${id}`}>开始练习</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/question/${id}/review`}>回顾/学习</Link>
        </Button>
      </ItemActions>
    </Item>
  )
}
