"use client"

import { MDXRemote, MDXRemoteSerializeResult } from "next-mdx-remote"
import { useMDXComponents } from "@/mdx-components"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, FileText, BookOpen, Layers } from "lucide-react"
import { useRouter } from "next/navigation"

interface TestPaperInfoProps {
  id: string
  title: string
  subject: string
  source: string
  year: number | null
  grade: string | null
  totalScore: number | null
  duration: number | null
  descriptionMdx: MDXRemoteSerializeResult | null
  groupCount: number
}

export function TestPaperInfo({
  id,
  title,
  subject,
  source,
  year,
  grade,
  totalScore,
  duration,
  descriptionMdx,
  groupCount,
}: TestPaperInfoProps) {
  const components = useMDXComponents()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold">{title}</h1>
          </div>

          <div className="flex flex-wrap gap-1 mb-6">
            <Badge variant="destructive" className="text-xs">{source}</Badge>
            {year && <Badge variant="secondary" className="text-xs">{year}年</Badge>}
            {grade && <Badge variant="outline" className="text-xs">{grade}</Badge>}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">题型组数</div>
                <div className="font-semibold">{groupCount} 组</div>
              </div>
            </div>
            {totalScore != null && (
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">总分</div>
                  <div className="font-semibold">{totalScore} 分</div>
                </div>
              </div>
            )}
            {duration != null && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">考试时长</div>
                  <div className="font-semibold">{duration} 分钟</div>
                </div>
              </div>
            )}
          </div>

          {descriptionMdx && (
            <div className="prose dark:prose-invert max-w-none mb-6 p-4 rounded-lg bg-muted/30">
              <MDXRemote {...descriptionMdx} components={components} />
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={() => router.push(`/test-paper/${id}/practice`)}
          >
            开始练习
          </Button>
        </div>
      </div>
    </div>
  )
}