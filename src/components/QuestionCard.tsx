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
import { useRouter } from 'next/navigation'
import { useAlertContext } from '@/components/alert-provider'

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
}

const defaultImageUrl = 'https://neeko-copilot.bytedance.net/api/text2image?prompt=education%20learning%20exam%20question%20abstract%20blue%20gradient&image_size=square'

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
}: QuestionCardProps) {
  const { session } = useSession()
  const router = useRouter()
  const { showAlert } = useAlertContext()
  const [userStats, setUserStats] = useState<{ correctNum: number; totalNum: number } | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      if (!session.userid) return

      try {
        const response = await fetch(
          `/api/submissions/group/stats?userId=${session.userid}&groupIds=${id}`
        )
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

  return (
    <Card className="relative mx-auto w-full max-w-sm pt-0">
      {/* 图片区域 */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={imageUrl || defaultImageUrl}
          alt={title}
          className="aspect-video w-full object-cover"
          loading="lazy"
        />
      </div>

      <CardHeader>
        <CardAction>
          <ProgressCircle
            correct={displayCorrectCount}
            total={displayTotalNum}
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
          <Link
            href={`/question/${id}`}
            className="w-full"
            target="_blank"
            onClick={(e) => {
              if (!session.isLoggedIn) {
                e.preventDefault()
                showAlert({ type: 'destructive', title: '请先登录' })
                router.push(`/login?back=/question/${id}`)
              }
            }}
          >
            <Button className="w-full">
              开始练习
            </Button>
          </Link>
          <Link href={`/question/${id}/review`} className="w-full" target="_blank">
            <Button variant="outline" className="w-full">
              回顾/学习
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}