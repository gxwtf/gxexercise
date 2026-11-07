"use client"

// 题组封面：展示当前封面 → 选图上传（服务端转 JPG 压缩）→ 也可手填外链地址 / 移除封面。
//
// 封面约定见 plan.md 第 3 节：imageUrl = /api/covers/<groupId>.jpg，文件在 COVERS_DIR；
// 上传接口会直接写库并记审计日志，所以这里上传成功后只需同步本地预览并刷新页面数据。

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Image as ImageIcon, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface CoverUploaderProps {
  groupId: string
  /** 当前封面地址（来自父组件的草稿，上传成功后会回填） */
  imageUrl: string
  onChange: (imageUrl: string) => void
  disabled?: boolean
}

export function CoverUploader({ groupId, imageUrl, onChange, disabled }: CoverUploaderProps) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [file, setFile] = React.useState<File | null>(null)
  const [localPreview, setLocalPreview] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)

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
      if (!response.ok || !json.success) {
        throw new Error(json.error || `上传失败（${response.status}）`)
      }
      onChange(json.data.imageUrl as string)
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

  const remove = async () => {
    setRemoving(true)
    try {
      const response = await fetch(`/api/admin/question-bank/groups/${groupId}/cover`, { method: "DELETE" })
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error || `移除失败（${response.status}）`)
      }
      onChange("")
      toast.success("封面已移除")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除失败，请稍后重试")
    } finally {
      setRemoving(false)
    }
  }

  const preview = localPreview ?? (imageUrl.trim() || null)

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
        {preview ? (
          // 封面图来源自托管 / 外链，尺寸不固定，这里用原生 img 而不是 next/image
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="题组封面预览" className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageIcon className="size-6" />
            <span className="text-xs">还没有封面</span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cover-file">上传封面</Label>
        {/* 原生 file input 的「Choose File / No file chosen」各浏览器文案不统一，藏起来用按钮触发 */}
        <input
          ref={inputRef}
          id="cover-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" asChild disabled={disabled || uploading}>
            <label htmlFor="cover-file" className="cursor-pointer">
              <Upload />
              选择图片
            </label>
          </Button>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={file?.name}>
            {file ? file.name : "未选择文件"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          支持 JPG / PNG / WebP，≤8MB；服务端会转成 JPG 并压到 1600px 内。
        </p>
        <Button type="button" size="sm" className="w-full" onClick={upload} disabled={!file || uploading || disabled}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
          {uploading ? "上传中…" : "上传并替换封面"}
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cover-url">封面地址</Label>
        <Input
          id="cover-url"
          value={imageUrl}
          onChange={(event) => onChange(event.target.value)}
          placeholder="/api/covers/<groupId>.jpg 或 https://…"
          className="font-mono text-xs"
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">留空表示没有封面（前台会用占位图）。改地址后仍需保存题组信息。</p>
      </div>

      {imageUrl ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" size="sm" variant="ghost" className="w-full text-destructive hover:text-destructive" disabled={removing || disabled}>
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
  )
}
