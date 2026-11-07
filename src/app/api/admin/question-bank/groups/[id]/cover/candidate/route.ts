// POST /api/admin/question-bank/groups/[id]/cover/candidate —— 选用一张「候选封面」
//
// 背景：封面由流水线（article-cover）按 OpenCLIP 相关度生成 5 张候选，存进
// `.cache/cover/<groupId>.candidates.json`。分数最高的那张不一定最合适，管理员需要能在
// 页面上逐张看、挑任意一张（不限于第一名）。
//
// 安全与一致性约定：
//   * 只接受 { rank }，图片地址从本地缓存里按序号取 —— 绝不接受请求里传来的任意 URL（防 SSRF）；
//   * 下载层再限制 https + 域名白名单 + ≤8MB；
//   * 下载 → 转 JPG 写 COVERS_DIR（与上传共用 writeCoverJpg），文件写入在事务外；
//   * 事务内更新 imageUrl + 写审计日志（action=pick-cover，记 rank / 来源）。
import { NextResponse } from "next/server"
import { requireQuestionBankEditor } from "@/lib/question-bank-auth"
import { prisma } from "@/lib/prisma"
import { buildFieldChanges, getRequestIp, writeAdminEditLog } from "@/lib/admin-edit-log"
import { findCoverCandidate, readCoverCandidates } from "@/lib/cover-candidates"
import { COVER_ID_RE, fetchRemoteCoverImage, writeCoverJpg } from "@/lib/cover-image"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function errorJson(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireQuestionBankEditor()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!COVER_ID_RE.test(id)) return errorJson("题组不存在", 404)

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return errorJson("请求体解析失败", 400)
  }
  const rank = typeof body.rank === "number" ? body.rank : Number(body.rank)
  if (!Number.isInteger(rank) || rank < 1 || rank > 50) return errorJson("候选序号不合法", 400)

  const group = await prisma.questionGroup.findUnique({
    where: { id },
    select: { id: true, title: true, imageUrl: true },
  })
  if (!group) return errorJson("题组不存在", 404)

  const candidates = await readCoverCandidates(id)
  if (!candidates) return errorJson("该题组还没有生成候选封面", 404)

  const candidate = findCoverCandidate(candidates, rank)
  if (!candidate) return errorJson("候选封面不存在（可能重新生成过）", 404)

  // 下载 + 转 JPG（失败不动库、不动旧封面）
  let image: { buffer: Buffer }
  try {
    image = await fetchRemoteCoverImage(candidate.imageUrl)
  } catch (error) {
    console.error("候选封面下载失败:", error)
    return errorJson(error instanceof Error ? error.message : "候选封面下载失败", 502)
  }
  try {
    await writeCoverJpg(id, image.buffer)
  } catch (error) {
    console.error("候选封面转换失败:", error)
    return errorJson("候选封面转换失败，请换一张重试", 500)
  }

  const imageUrl = `/api/covers/${id}.jpg`
  try {
    await prisma.$transaction(async (tx) => {
      await tx.questionGroup.update({ where: { id }, data: { imageUrl } })
      const changes = buildFieldChanges(group, { imageUrl }, ["imageUrl"])
      await writeAdminEditLog(tx, {
        adminId: auth.userId,
        adminName: auth.session.username || null,
        action: "pick-cover",
        targetType: "group",
        targetId: id,
        targetLabel: group.title,
        groupId: id,
        groupTitle: group.title,
        // 地址没变（同名覆盖）时 changes 为空，但操作本身仍要留痕；
        // 选了第几号候选 / 出处放在 summary 里，界面上单独展示
        changes: Object.keys(changes).length ? changes : null,
        summary: `选用候选封面 #${candidate.rank}${
          candidate.score !== null ? ` · 相关度 ${candidate.score}` : ""
        }${candidate.sourceUrl ? ` · ${candidate.sourceUrl}` : ""}`,
        ip: getRequestIp(request),
      })
    })
  } catch (error) {
    console.error("候选封面入库失败:", error)
    return errorJson("封面保存失败", 500)
  }

  return NextResponse.json({
    success: true,
    data: { imageUrl, rank: candidate.rank, score: candidate.score },
  })
}
