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
import { Users, FileText } from 'lucide-react'

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
            correct={correctCount}
            total={totalQuestions}
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
          <Button className="flex-1">
            开始练习
          </Button>
          <Button variant="outline" className="flex-1">
            回顾/学习
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}