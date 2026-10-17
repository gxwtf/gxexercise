import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { serialize } from "next-mdx-remote/serialize"
import remarkMath from "remark-math"
import remarkGfm from "remark-gfm"
import rehypeKatex from "rehype-katex"
import { EssayReport } from "./EssayReport"

interface PageProps {
  params: Promise<{ id: string; questionIndex: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function escapeLatexBraces(content: string): string {
  let result = ""
  let inTag = 0
  let inMath = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (ch === "$" && inTag === 0) {
      inMath = !inMath
      result += ch
    } else if (ch === "<") {
      inTag++
      result += ch
    } else if (ch === ">") {
      inTag = Math.max(0, inTag - 1)
      result += ch
    } else if (ch === "{" && inTag === 0 && !inMath) {
      result += "\\{"
    } else if (ch === "}" && inTag === 0 && !inMath) {
      result += "\\}"
    } else {
      result += ch
    }
  }
  return result
}

/** 文件名里不能出现的字符统一清掉，「另存为 PDF」会以 <title> 作为默认文件名 */
function safeFileName(name: string): string {
  return (name || "英语作文").replace(/[\\/:*?"<>|\r\n\t]/g, "").trim().slice(0, 80) || "英语作文"
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  try {
    const group = await prisma.questionGroup.findUnique({ where: { id }, select: { title: true } })
    return { title: `${safeFileName(group?.title || "英语作文")} - 英语作文批改报告` }
  } catch {
    return { title: "英语作文批改报告" }
  }
}

/** 单篇作文的批改报告：题目 / 原稿 / 评分与批改 / 修改稿，用于导出 PDF */
export default async function EssayReportPage({ params, searchParams }: PageProps) {
  const { id, questionIndex } = await params
  const sp = await searchParams
  const wantedQuestionId = (Array.isArray(sp.q) ? sp.q[0] : sp.q) || ""
  // questionIndex 在 URL 里是 1 基
  const requestedIndex = Math.max(0, (Number.parseInt(questionIndex, 10) || 1) - 1)

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) {
    redirect(`/login?back=/question/${id}/review/${questionIndex}/report`)
  }

  const questionGroup = await prisma.questionGroup.findUnique({
    where: { id },
    include: {
      groupItems: { include: { question: true }, orderBy: { orderIndex: "asc" } },
    },
  })
  if (!questionGroup) notFound()

  // 优先用 ?q=<questionId> 精确定位；没有的话按题序，再兜底到最后一道题，
  // 避免「题序越界」这种写法差异直接把报告页判成 404
  const items = questionGroup.groupItems
  const item =
    (wantedQuestionId ? items.find((it) => it.question.id === wantedQuestionId) : undefined) ??
    items[requestedIndex] ??
    items[0]
  if (!item) notFound()
  const question = item.question
  const index = items.findIndex((it) => it.question.id === question.id)

  const submission = await prisma.questionSubmission.findFirst({
    where: { userId: session.userid, questionId: question.id, gradingStatus: "graded" },
    orderBy: { createdAt: "desc" },
  })

  const mdxOptions = {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [rehypeKatex],
  }

  const safeSerialize = async (text?: string | null) => {
    if (!text || !text.trim()) return null
    try {
      return await serialize(escapeLatexBraces(text), { mdxOptions })
    } catch {
      return null
    }
  }

  const feedback = (submission?.aiFeedback ?? null) as Record<string, unknown> | null
  const userAnswer = ((submission?.content as { answer?: string } | null)?.answer ?? "").trim()

  const [stemMdx, answerMdx, overallCommentMdx, lineCorrectionsMdx, correctionsMdx, betterExpressionsMdx, modelEssayMdx] =
    await Promise.all([
      safeSerialize(question.content),
      safeSerialize(userAnswer),
      safeSerialize((feedback?.overallComment as string) ?? null),
      safeSerialize((feedback?.lineCorrections as string) ?? null),
      safeSerialize((feedback?.corrections as string) ?? null),
      safeSerialize((feedback?.betterExpressions as string) ?? null),
      safeSerialize((feedback?.modelEssay as string) ?? null),
    ])

  return (
    <EssayReport
      title={questionGroup.title || "英语作文"}
      questionType={questionGroup.questionType}
      questionIndex={index + 1}
      stemMdx={stemMdx}
      answerMdx={answerMdx}
      overallCommentMdx={overallCommentMdx}
      lineCorrectionsMdx={lineCorrectionsMdx}
      correctionsMdx={correctionsMdx}
      betterExpressionsMdx={betterExpressionsMdx}
      modelEssayMdx={modelEssayMdx}
      subScores={(feedback?.subScores as Record<string, number> | undefined) ?? null}
      score={submission?.score ?? null}
      maxScore={question.score ?? null}
      feedbackText={(feedback?.feedback as string) ?? null}
      generatedAt={new Date().toLocaleString("zh-CN", { hour12: false })}
    />
  )
}
