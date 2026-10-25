"use client"

import { FileText, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

interface GroupRowCardProps {
  id: string
  title: string
  questionType: string
  source: string
  tags: string[]
  score?: number | null
  questionCount?: number
  latestSubmissionId?: string | null
  submissionCount?: number
}

/**
 * 题组列表的「套卷样式」卡片：单行横向布局（图标 + 标题 + 标签 + 操作按钮），
 * 不带封面缩略图。数理化政等学科用这个替代原来的图卡。
 */
export function GroupRowCard({
  id,
  title,
  questionType,
  source,
  tags,
  score,
  questionCount,
  latestSubmissionId,
  submissionCount = 0,
}: GroupRowCardProps) {
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
          {questionCount != null && (
            <Badge variant="outline" className="text-xs">
              {questionCount}题
            </Badge>
          )}
          <span className="ml-1 flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="text-xs text-muted-foreground">{submissionCount}</span>
          </span>
          <span className="sr-only">{questionType}</span>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {latestSubmissionId && (
          <Button variant="outline" asChild>
            <a href={`/question/${id}/review`} target="_blank" rel="noreferrer">
              练习报告
            </a>
          </Button>
        )}
        <Button variant="outline" asChild>
          <a href={`/question/${id}/paper/pdf`} download>
            下载试卷
          </a>
        </Button>
        <Button variant="default" asChild>
          <a href={`/question/${id}`} target="_blank" rel="noreferrer">
            开始练习
          </a>
        </Button>
      </ItemActions>
    </Item>
  )
}
