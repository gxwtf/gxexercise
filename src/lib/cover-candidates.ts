// 读取「候选封面」清单（只给服务端用）
//
// 封面由独立流水线 scripts/cover-from-group.ts 调 article-cover 生成，结果落在
// `.cache/cover/<groupId>.candidates.json`（5 张候选，带 OpenCLIP 相关度分数）。
// 这个模块把它读成界面/接口能用的结构；没有缓存或格式不对时返回 null（界面显示「暂无候选」）。
//
// 目录可用 COVERS_CACHE_DIR 覆盖；默认取进程工作目录下的 .cache/cover
//（生产是仓库根，dev 是 worktree 根）。

import { promises as fs } from "node:fs"
import path from "node:path"
import type { CoverCandidateSetView, CoverCandidateView } from "@/components/admin/question-bank/types"

export function coverCacheDir(): string {
  return process.env.COVERS_CACHE_DIR || path.join(process.cwd(), ".cache", "cover")
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** 读取并规范化某题组的候选封面；无缓存 / 无有效候选返回 null */
export async function readCoverCandidates(groupId: string): Promise<CoverCandidateSetView | null> {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(groupId)) return null

  let raw: string
  try {
    raw = await fs.readFile(path.join(coverCacheDir(), `${groupId}.candidates.json`), "utf8")
  } catch {
    return null
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }

  const list = Array.isArray(data.candidates) ? data.candidates : []
  const candidates: CoverCandidateView[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const imageUrl = asString(row.image_url)
    const thumbnailUrl = asString(row.thumbnail_url) ?? imageUrl
    // 只接受 https 图片（接口层还有域名白名单，这里先挡掉明显异常的）
    if (!imageUrl || !thumbnailUrl || !/^https:\/\//i.test(imageUrl)) continue
    const rank = asNumber(row.rank)
    if (rank === null || rank < 1) continue
    candidates.push({
      rank,
      score: asNumber(row.relevance_score),
      imageUrl,
      thumbnailUrl,
      width: asNumber(row.width),
      height: asNumber(row.height),
      attribution: asString(row.attribution),
      sourceUrl: asString(row.source_url),
      license: asString(row.license),
    })
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.rank - b.rank)
  return { writtenRank: asNumber(data.writtenRank), candidates }
}

/** 按序号取候选（接口层用，避免把任意 URL 传进来） */
export function findCoverCandidate(
  set: CoverCandidateSetView,
  rank: number,
): CoverCandidateView | null {
  return set.candidates.find((candidate) => candidate.rank === rank) ?? null
}
