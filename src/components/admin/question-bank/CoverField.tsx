"use client"

// 封面区域（并入「题组信息」卡片）：
//   1) 当前封面预览；
//   2) 上传本地图片 / 手填外链 / 移除；
//   3) 「候选封面」——流水线生成的多张候选（按相关度排序），可以挑任意一张，
//      **不只是分数最高的那张**；选中后服务端下载 → 转 JPG → 存 COVERS_DIR，并记审计日志。
//
// 注意：候选只传 rank 给接口，图片地址由服务端从本地缓存里取（避免 SSRF）。

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Image as ImageIcon, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { CoverCandidateSetView } from "@/components/admin/question-bank/types"

interface CoverFieldProps {
  groupId: string
  /** 当前封面地址（来自题组草稿，上传 / 选用成功后回填） */
  imageUrl: string
  /** 生成脚本产出的候选封面（没有缓存时为 null） */
  candidates: CoverCandidateSetView | null
  onChange: (imageUrl: string) => void
  disabled?: boolean
}

export function CoverField({ groupId, imageUrl, candidates, onChange, disabled }: CoverFieldProps) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [file, setFile] = React.useState<File | null>(null)
  const [localPreview, setLocalPreview] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)
  const [pickingRank, setPickingRank] = React.useState<number | null>(null)
  const [pickedRank, setPickedRank] = React.useState<number | null>(null)
  // 封面文件名固定为 <groupId>.jpg，换图后地址不变 —— 用版本号把浏览器缓存顶掉
  const [previewVersion, setPreviewVersion] = React.useState(0)
  // 预览图加载失败（封面文件被删 / 外链失效 / 环境里没有同步封面目录）时给明确提示
  const [previewFailed, setPreviewFailed] = React.useState(false)

  // 选好文件先本地预览，确认后再上传
  React.useEffect(() => {
    if (!file) {
      setLocalPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setLocalPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const previewBase = imageUrl.trim()
  const preview = localPreview
    ?? (previewBase ? `${previewBase}${previewBase.includes("?") ? "&" : "?"}v=${previewVersion}` : null)

  React.useEffect(() => {
    setPreviewFailed(false)
  }, [preview])

  const upload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const body = new FormData()
      body.set("file", file)
      const response = await fetch(`/api/admin/question-bank/groups/${groupId}/cover`, {
        method: "POST",
        body,
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.error || `上传失败（${response.status}）`)
      onChange(json.data.imageUrl as string)
      setPreviewVersion((version) => version + 1)
      setPickedRank(null)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ""
      toast.success("封面已更新")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败，请稍后重试")
    } finally {
      setUploading(false)
    }
  }

  const pickCandidate = async (rank: number) => {
    setPickingRank(rank)
    try {
      const response = await fetch(`/api/admin/question-bank/groups/${groupId}/cover/candidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rank }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.error || `选用失败（${response.status}）`)
      onChange(json.data.imageUrl as string)
      setPreviewVersion((version) => version + 1)
      setPickedRank(rank)
      toast.success(`已选用候选封面 #${rank}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "选用失败，请稍后重试")
    } finally {
      setPickingRank(null)
    }
  }

  const remove = async () => {
    setRemoving(true)
    try {
      const response = await fetch(`/api/admin/question-bank/groups/${groupId}/cover`, { method: "DELETE" })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.error || `移除失败（${response.status}）`)
      onChange("")
      setPickedRank(null)
      toast.success("封面已移除")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除失败，请稍后重试")
    } finally {
      setRemoving(false)
    }
  }

  const busy = uploading || removing || pickingRank !== null

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label>封面</Label>
        <span className="text-xs text-muted-foreground">题组卡片图，影响题库列表的展示。</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-start">
        {/* 预览框固定 16:9 并 self-start：否则会被右侧更高的一列拉伸，图片下方留出一条灰边 */}
        <div className="aspect-video overflow-hidden rounded-lg border border-border bg-muted/40">
          {preview && !previewFailed ? (
            // 封面来源有自托管文件、外链、本地预览对象三种，尺寸不固定，这里用原生 img；
            // object-cover 默认按中心裁切（水平、垂直都居中）
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="题组封面预览"
              className="h-full w-full object-cover object-center"
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center text-muted-foreground">
              <ImageIcon className="size-6" />
              <span className="text-xs">
                {previewFailed ? "封面加载失败（文件缺失或外链失效）" : "还没有封面"}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <input
              ref={inputRef}
              id="cover-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled || busy}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" asChild disabled={disabled || busy}>
                <label htmlFor="cover-file" className="cursor-pointer">
                  <Upload />
                  选择图片
                </label>
              </Button>
              <Button type="button" size="sm" onClick={upload} disabled={!file || busy || disabled}>
                {uploading ? <Loader2 className="animate-spin" /> : null}
                {uploading ? "上传中…" : "上传并替换"}
              </Button>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={file?.name}>
                {file ? file.name : "未选择文件"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              支持 JPG / PNG / WebP，≤8MB；服务端转成 JPG 并压到 1600px 内。
            </p>
          </div>

          <div className="space-y-1">
            <Label>当前封面</Label>
            {/* 只读展示：封面只能通过上传 / 候选封面 / 移除来改（这三种都是立即写库并记日志），
                不需要手填地址，避免和「保存题组信息」的保存时机混淆 */}
            <p className="break-all font-mono text-xs text-muted-foreground">
              {imageUrl.trim() || "未设置（前台显示占位图）"}
            </p>
            <p className="text-xs text-muted-foreground">
              {imageUrl.startsWith("/api/covers/")
                ? "自托管文件（/api/covers/<题组 id>.jpg）"
                : imageUrl.trim()
                  ? "外链图片（生成流水线直接写入的图库地址）"
                  : "用上面的「选择图片」或下方候选封面设置，改完立即生效"}
            </p>
          </div>

          {imageUrl ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={removing || disabled}
                >
                  <X />
                  移除封面
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>移除这个题组的封面？</AlertDialogTitle>
                  <AlertDialogDescription>
                    会删除服务器上的封面文件（如果存在）并把 imageUrl 置空，前台将显示占位图。操作会记入修改记录。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    className="text-red-800 dark:text-red-300"
                    onClick={(event) => {
                      event.preventDefault()
                      void remove()
                    }}
                    disabled={removing}
                  >
                    {removing ? "移除中…" : "确认移除"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Label>候选封面</Label>
          <span className="text-xs text-muted-foreground">
            {candidates
              ? `${candidates.candidates.length} 张 · 按相关度排序，分数最高的不一定最合适，可任选`
              : "没有候选缓存"}
          </span>
        </div>

        {candidates ? (
          <>
            <p className="text-xs text-muted-foreground">
              选用时服务端会重新下载原图；如果某张的源站不可达（如 wikimedia 有时连不上），会提示失败，换一张即可。
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {candidates.candidates.map((candidate) => {
              const isWritten = candidates.writtenRank === candidate.rank
              const isPicked = pickedRank === candidate.rank
              const picking = pickingRank === candidate.rank
              return (
                <figure key={candidate.rank} className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="relative aspect-video bg-muted">
                    {/* 缩略图来自候选源站（pixabay / wikimedia）；源站不可达时露出占位图标，
                        仍可点「用这张」（服务端会重新下载，失败会提示） */}
                    <ImageIcon className="absolute inset-0 m-auto size-5 text-muted-foreground" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={candidate.thumbnailUrl}
                      alt={`候选封面 #${candidate.rank}`}
                      className="absolute inset-0 size-full object-cover"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.visibility = "hidden"
                      }}
                    />
                    <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] font-medium leading-none">
                      #{candidate.rank}
                    </span>
                    {candidate.score !== null ? (
                      <span className="absolute right-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground">
                        {candidate.score.toFixed(3)}
                      </span>
                    ) : null}
                    {isWritten || isPicked ? (
                      <span className="absolute bottom-1 left-1 rounded bg-brand px-1.5 py-0.5 text-[11px] leading-none text-primary-foreground">
                        {isPicked ? "已选用" : "生成时选用"}
                      </span>
                    ) : null}
                  </div>
                  <figcaption className="space-y-1.5 p-2">
                    <p className="line-clamp-1 text-[11px] text-muted-foreground" title={candidate.attribution ?? ""}>
                      {candidate.attribution ?? candidate.license ?? "—"}
                    </p>
                    <Button
                      type="button"
                      size="xs"
                      variant={isPicked ? "default" : "outline"}
                      className="w-full"
                      onClick={() => pickCandidate(candidate.rank)}
                      disabled={disabled || busy}
                    >
                      {picking ? <Loader2 className="animate-spin" /> : null}
                      {picking ? "下载中…" : isPicked ? "已选用" : "用这张"}
                    </Button>
                  </figcaption>
                </figure>
              )
            })}
            </div>
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            该题组还没有生成候选封面（<code>.cache/cover</code> 里没有记录）。可以用上面的方式上传，或让流水线跑一次
            <code> scripts/cover-from-group.ts --group {groupId}</code>。
          </p>
        )}
      </div>
    </div>
  )
}
