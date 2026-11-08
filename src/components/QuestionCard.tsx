'use client'

import { useState, useEffect } from 'react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ProgressCircle } from "@/components/ui/progress-circle"
import { Users, FileText, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import useSession from '@/lib/use-session'

interface QuestionCardProps {
  id: string
  title: string
  imageUrl?: string
  subject: string
  questionType: string
  year?: number
  source: string
  tags: string[]
  completedCount?: number
  correctCount?: number
  totalQuestions?: number
  totalScore?: number
}

// 主观题（按得分率而不是「正确题数」统计）：作文/阅读表达，生物·历史·地理·政治的大题（*-fill），
// 以及数学解答题 / 物理计算题（整题一条 text 单题）/ 物理实验题（与生物同构，逐空 AI 判分）。
// 理科大题与生物同构：小问都是主观题、按采分点判分，「正确题数」没有意义。
const subjectiveTypes = ["reading-expression", "阅读表达", "en-writing", "chinese-essay", "chinese-micro-writing", "biology-fill", "history-fill", "geography-fill", "politics-fill", "physics-fill", "math-solve", "physics-solve"];

function isSubjective(questionType: string): boolean {
  return subjectiveTypes.includes(questionType);
}

export function QuestionCard({
  id,
  title,
  imageUrl,
  subject,
  questionType,
  year,
  source,
  tags,
  completedCount = 0,
  correctCount = 0,
  totalQuestions = 0,
  totalScore = 0,
}: QuestionCardProps) {
  const { session } = useSession()
  const [userStats, setUserStats] = useState<{ correctNum: number; totalNum: number; score: number | null } | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      if (!session.userid) return

      try {
        const response = await fetch(
          // userId 由服务端从登录会话读取，前端不再传递
          `/api/submissions/group/stats?groupIds=${id}`
        )
        if (!response.ok) return
        const result = await response.json()
        if (result.success && result.data[id]) {
          setUserStats(result.data[id])
        }
      } catch (error) {
        console.error('Failed to fetch submission stats:', error)
      }
    }

    fetchStats()
  }, [session.userid, id])

  const displayCorrectCount = userStats?.correctNum ?? correctCount
  const displayTotalNum = userStats?.totalNum ?? totalQuestions
  const subjective = isSubjective(questionType)
  const displayScore = subjective
    ? (userStats?.score ?? 0)
    : displayCorrectCount
  const displayTotal = subjective
    ? (userStats?.score != null ? totalScore : 0)
    : displayTotalNum

  return (
    <Card className="relative mx-auto w-full max-w-sm pt-0">
      {/* 图片区域 */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={imageUrl || `https://picsum.photos/seed/${id}/400/300`}
          alt={title}
          className="aspect-video w-full object-cover"
          loading="lazy"
        />
      </div>

      <CardHeader>
        <CardAction>
          <ProgressCircle
            correct={displayScore}
            total={displayTotal}
          />
        </CardAction>
        <CardTitle className="line-clamp-1">
          {title}
        </CardTitle>

        <CardDescription className="flex gap-2">
          <span className="line-clamp-1">
            {source} {year && `· ${year}年`}
          </span>
          
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{completedCount}</span>
          </div>
        </CardDescription>
      </CardHeader>
      
      <CardFooter>
        {/* 按钮区域 */}
        <div className="flex gap-2 w-full">
          <Link href={`/question/${id}`} className="w-full">
            <Button className="w-full">
              开始练习
            </Button>
          </Link>
          <Link href={`/question/${id}/review`} className="w-full">
            <Button variant="outline" className="w-full">
              回顾/学习
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}