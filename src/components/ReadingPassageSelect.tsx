"use client"

import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface ReadingSibling {
  id: string
  title: string
}

/**
 * 阅读篇目下拉：在题组练习页里直接切到同一套卷的其它篇（A/B/C/D 篇）。
 * 由服务端把同卷阅读题组（按试卷顺序）传进来。
 */
export function ReadingPassageSelect({ currentId, siblings }: { currentId: string; siblings: ReadingSibling[] }) {
  const router = useRouter()
  if (siblings.length < 2) return null
  const pos = siblings.findIndex((s) => s.id === currentId)
  if (pos < 0) return null
  const label = (i: number) => `${String.fromCharCode(65 + i)}篇`
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">阅读篇目</span>
      <Select value={currentId} onValueChange={(v) => router.push(`/question/${v}`)}>
        <SelectTrigger className="h-8 w-[180px] text-xs" aria-label="选择阅读篇目">
          <SelectValue placeholder="选择篇目" />
        </SelectTrigger>
        <SelectContent align="end">
          {siblings.map((s, i) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              {label(i)} · {s.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
