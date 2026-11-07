import { prisma } from "@/lib/prisma"
import { normalizeQuestionMdx } from "@/lib/mdx-text"
import { notFound, redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { serialize } from 'next-mdx-remote/serialize'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import { TestPaperPractice } from "./TestPaperPractice"
import { AnswerProvider } from "@/components/question-group/AnswerContext"
import { trimSharedMaterialContents, usesSharedMaterial } from "@/lib/shared-material"

function escapeLatexBraces(input: string): string {
  input = normalizeQuestionMdx(input)
  // <br> 必须自闭合（MDX 会报 "Expected a closing tag for <br>"，语文表格里常见）
  const content = input.replace(/<br\s*\/?>/gi, '<br />')
  let result = ''
  let inTag = 0
  let inMath = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (ch === '$' && inTag === 0) {
      inMath = !inMath
      result += ch
    } else if (ch === '<') {
      if (inMath) {
        result += ch // 公式里的 < 是关系符
      } else if (/^<\/?[A-Za-z][A-Za-z0-9-]*(\s[^<>]*)?\/?>/.test(content.slice(i))) {
        inTag++
        result += ch
      } else {
        result += '&lt;'
      }
    } else if (ch === '>') {
      if (inMath) {
        result += ch
      } else if (inTag > 0) {
        inTag = Math.max(0, inTag - 1)
        result += ch
      } else {
        result += '&gt;'
      }
    } else if (ch === '{' && inTag === 0 && !inMath) {
      result += '\\{'
    } else if (ch === '}' && inTag === 0 && !inMath) {
      result += '\\}'
    } else {
      result += ch
    }
  }
  return result
}

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function TestPaperPracticePage({ params }: PageProps) {
  const { id } = await params

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) {
    redirect(`/login?back=/test-paper/${id}`)
  }

  const mdxOptions = {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [rehypeKatex],
  }

  const testPaper = await prisma.testPaper.findUnique({
    where: { id },
    include: {
      paperItems: {
        orderBy: { orderIndex: "asc" },
      },
    },
  })

  if (!testPaper) {
    notFound()
  }

  const groupIds = testPaper.paperItems.map((item) => item.itemId)

  const questionGroups = await prisma.questionGroup.findMany({
    where: { id: { in: groupIds } },
    include: {
      groupItems: {
        include: { question: true },
        orderBy: { orderIndex: "asc" },
      },
    },
  })

  const groupMap = new Map(questionGroups.map((g) => [g.id, g]))
  const orderedGroups = groupIds.map((gid) => groupMap.get(gid)).filter(Boolean) as typeof questionGroups

  let questionOffset = 1
  const groupsData = await Promise.all(
    orderedGroups.map(async (group) => {
      const startNumber = questionOffset
      const questionCount = group.groupItems.length
      questionOffset += questionCount

      let contentMdx = null
      if (group.content) {
        try {
          const escaped = escapeLatexBraces(group.content)
          contentMdx = await serialize(escaped, { mdxOptions })
        } catch {}
      }

      // 同材料选择题：后续题里重复的材料前缀只在显示时裁掉
      const displayStems = usesSharedMaterial(group.questionType)
        ? trimSharedMaterialContents(group.groupItems.map((item) => item.question.content))
        : group.groupItems.map((item) => item.question.content ?? "")

      const questions = await Promise.all(
        group.groupItems.map(async (item, qi) => {
          const displayStem: string = displayStems[qi] ?? (item.question.content ?? "")
          let stemMdx = null
          if (displayStem) {
            try {
              const escaped = escapeLatexBraces(displayStem)
              stemMdx = await serialize(escaped, { mdxOptions })
            } catch {}
          }

          const options = (item.question.options || []) as Array<{ id: string; label: string }>
          const optionsWithMdx = await Promise.all(
            options.map(async (opt) => {
              try {
                const escaped = escapeLatexBraces(opt.label)
                const labelMdx = await serialize(escaped, { mdxOptions })
                return { ...opt, labelMdx }
              } catch {
                return { ...opt, labelMdx: null }
              }
            })
          )

          let type = 'single'
          if (item.question.questionType === 'input' || item.question.questionType === 'input2') {
            type = 'input'
          } else if (item.question.questionType === 'text') {
            type = 'text'
          } else if (item.question.questionType === 'multiple') {
            type = 'multiple'
          }

          return {
            id: item.question.id,
            stem: displayStem,
            stemMdx,
            type: type as 'single' | 'multiple' | 'input' | 'text',
            options: optionsWithMdx,
            answer: item.question.answer || '',
          }
        })
      )

      return {
        id: group.id,
        title: group.title,
        questionType: group.questionType,
        category: group.category,
        content: group.content,
        contentMdx,
        questions,
        startQuestionNumber: startNumber,
        score: group.score,
        answerMode: group.answerMode,
      }
    })
  )

  return (
    <AnswerProvider storageKey={`test-paper-${id}`}>
      <TestPaperPractice
        testPaperId={id}
        testPaperTitle={testPaper.title}
        testPaperDuration={testPaper.duration}
        groupsData={groupsData}
      />
    </AnswerProvider>
  )
}