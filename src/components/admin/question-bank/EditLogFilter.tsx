"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface EditLogFilterProps {
  targetType: string
  keyword: string
  admin: string
}

/** 修改记录筛选：对象类型 + 关键词（对象/题组/管理员）+ 管理员用户名 */
export function EditLogFilter({ targetType, keyword, admin }: EditLogFilterProps) {
  const router = useRouter()
  const [type, setType] = React.useState(targetType)
  const [kw, setKw] = React.useState(keyword)
  const [adminQuery, setAdminQuery] = React.useState(admin)

  const push = (next: { targetType?: string; keyword?: string; admin?: string }) => {
    const t = next.targetType ?? type
    const k = next.keyword ?? kw
    const a = next.admin ?? adminQuery
    const params = new URLSearchParams()
    if (t && t !== "all") params.set("type", t)
    if (k.trim()) params.set("q", k.trim())
    if (a.trim()) params.set("admin", a.trim())
    const qs = params.toString()
    router.push(qs ? `/admin/questions/logs?${qs}` : "/admin/questions/logs")
  }

  const hasFilter = type !== "all" || kw.trim().length > 0 || adminQuery.trim().length > 0

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={type}
          onValueChange={(value) => {
            setType(value)
            push({ targetType: value })
          }}
        >
          <SelectTrigger size="sm" className="w-[124px]" aria-label="选择对象类型">
            {/* 直接给出文案：Radix 的 SelectValue 在选项没展开过时取不到 item 文本，会显示空白 */}
            <SelectValue placeholder="全部对象">
              <span className={type === "all" ? "text-muted-foreground" : undefined}>
                {type === "all" ? "全部对象" : type === "group" ? "题组" : "单题"}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部对象</SelectItem>
            <SelectItem value="group">题组</SelectItem>
            <SelectItem value="question">单题</SelectItem>
          </SelectContent>
        </Select>

        <form
          className="flex basis-full flex-wrap items-center gap-2 sm:flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            push({ keyword: kw, admin: adminQuery })
          }}
        >
          <Input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索对象名称 / 所属题组"
            className="h-9 w-full sm:w-64"
            aria-label="搜索对象名称或所属题组"
          />
          <Input
            value={adminQuery}
            onChange={(e) => setAdminQuery(e.target.value)}
            placeholder="管理员用户名"
            className="h-9 w-full sm:w-40"
            aria-label="按管理员用户名筛选"
          />
          <Button type="submit" size="sm">
            查询
          </Button>
        </form>

        {hasFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setType("all")
              setKw("")
              setAdminQuery("")
              router.push("/admin/questions/logs")
            }}
          >
            清除筛选
          </Button>
        )}
      </div>
    </div>
  )
}
