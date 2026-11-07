"use client"

// 题库列表里的封面缩略图（40×24）
//
// 用原生 <img>：这么小的图没必要走 next/image 的按需优化；加载失败（封面文件被删 /
// 外链失效 / 预览环境没同步封面目录）时回退成灰块，而不是浏览器默认的破图图标。

import * as React from "react"

interface CoverThumbProps {
  src: string | null
  /** 题组标题，用作 img alt */
  title: string
}

export function CoverThumb({ src, title }: CoverThumbProps) {
  const [failed, setFailed] = React.useState(false)

  if (!src || failed) {
    return (
      <span
        aria-hidden
        title={src ? "封面加载失败（文件缺失或外链失效）" : "未配封面"}
        className="inline-block h-6 w-10 rounded border border-border bg-muted"
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 缩略图用原生 img，见组件注释
    <img
      src={src}
      alt={title}
      width={40}
      height={24}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-6 w-10 rounded border border-border object-cover"
    />
  )
}
