import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { sessionOptions, type SessionData } from "@/lib/iron"
import { serialize } from 'next-mdx-remote/serialize'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import { TestPaperInfo } from "./TestPaperInfo"

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function TestPaperPage({ params }: PageProps) {
  const { id } = await params

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userid) {
    redirect(`/login?back=/test-paper/${id}`)
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

  const mdxOptions = {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [rehypeKatex],
  }

  let descriptionMdx = null
  if (testPaper.description) {
    try {
      descriptionMdx = await serialize(testPaper.description, { mdxOptions })
    } catch {}
  }

  return (
    <TestPaperInfo
      id={testPaper.id}
      title={testPaper.title}
      subject={testPaper.subject}
      source={testPaper.source}
      year={testPaper.year}
      grade={testPaper.grade}
      totalScore={testPaper.totalScore}
      duration={testPaper.duration}
      descriptionMdx={descriptionMdx}
      groupCount={testPaper.paperItems.length}
    />
  )
}