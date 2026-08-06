import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { serialize } from 'next-mdx-remote/serialize'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import { TestPaperPractice } from "./TestPaperPractice"
import { AnswerProvider } from "@/components/question-group/AnswerContext"

function escapeLatexBraces(content: string): string {
  let result = ''
  let inTag = 0
  let inMath = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (ch === '$' && inTag === 0) {
      inMath = !inMath
      result += ch
    } else if (ch === '<') {
      inTag++
      result += ch
    } else if (ch === '>') {
      inTag = Math.max(0, inTag - 1)
      result += ch
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

      const questions = await Promise.all(
        group.groupItems.map(async (item) => {
          let stemMdx = null
          if (item.question.content) {
            try {
              const escaped = escapeLatexBraces(item.question.content)
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
            stem: item.question.content,
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
        content: group.content,
        contentMdx,
        questions,
        startQuestionNumber: startNumber,
        score: group.score,
      }
    })
  )

  return (
    <AnswerProvider>
      <TestPaperPractice
        testPaperId={id}
        testPaperTitle={testPaper.title}
        testPaperDuration={testPaper.duration}
        groupsData={groupsData}
      />
    </AnswerProvider>
  )
}