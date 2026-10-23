'use client'

import { useRef, useCallback } from 'react'
import { ChoiceField } from '@/components/question/ChoiceField'
import { AnswerQuestion } from '@/components/question/AnswerQuestion'
import { ReadingLayout } from '@/components/question-group/ReadingLayout'
import { QuestionSection } from '@/components/QuestionSection'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents, MathInput2Provider, InputDefaultValuesContext } from '@/mdx-components'
import { useAnswer } from './AnswerContext'

interface ProblemQuestion {
  id: string
  stem: string
  stemMdx?: MDXRemoteSerializeResult | null
  type: 'single' | 'multiple' | 'input' | 'text'
  subStem?: string
  options?: Array<{ id: string; label: string; labelMdx?: MDXRemoteSerializeResult | null }>
}

interface ProblemProps {
  questions: ProblemQuestion[]
  mdxSource?: MDXRemoteSerializeResult | null
  language?: 'zh' | 'en'
  minHeight?: string
  indentParagraphs?: boolean
  startQuestionNumber?: number
  showWordCount?: boolean
  /** side=左右两栏（左文章右题目）；inline=材料与题目同在主区域，不设阅读区 */
  articleLayout?: 'side' | 'inline'
  /** 图片版题目：内容列铺满有效宽度（不限制 max-w-4xl、内边距更小） */
  fullWidth?: boolean
  /** 内容列靠左（去掉 mx-auto 居中），宽度限制保持不变 */
  alignLeft?: boolean
}

export default function Problem({
  questions,
  mdxSource,
  language = 'zh',
  minHeight,
  indentParagraphs = true,
  startQuestionNumber,
  showWordCount = false,
  articleLayout = 'side',
  fullWidth = false,
  alignLeft = false,
}: ProblemProps) {
  const { setAnswer, answers } = useAnswer()
  const components = useMDXComponents()
  const inputValuesRef = useRef<Record<string, Record<number, string>>>({})

  const textQuestions = questions.filter(q => q.type === 'text')

  const onChoiceChange = (questionId: string, selected: string[]) => {
    const answer = selected.length === 1 ? selected[0] : selected.join(',')
    setAnswer(questionId, { answer })
  }

  const onInputChange = useCallback((questionId: string, index: number, value: string) => {
    if (!inputValuesRef.current[questionId]) {
      inputValuesRef.current[questionId] = {}
    }
    inputValuesRef.current[questionId][index] = value
    const values = Object.values(inputValuesRef.current[questionId]).sort()
    setAnswer(questionId, { answer: values.join(',') })
  }, [setAnswer])

  const hasArticle = !!mdxSource
  const isSingleTextQuestion = !hasArticle && questions.length === 1 && textQuestions.length === 1

  const segments: Array<{ type: 'choice'; questions: ProblemQuestion[]; startIndex: number } | { type: 'input' | 'text'; question: ProblemQuestion; index: number }> = []
  let i = 0
  while (i < questions.length) {
    const q = questions[i]
    if (q.type === 'single' || q.type === 'multiple') {
      const group: ProblemQuestion[] = []
      const startIndex = i
      while (i < questions.length && (questions[i].type === 'single' || questions[i].type === 'multiple')) {
        group.push(questions[i])
        i++
      }
      segments.push({ type: 'choice', questions: group, startIndex })
    } else {
      segments.push({ type: q.type as 'input' | 'text', question: q, index: i })
      i++
    }
  }

  const body = (
    <>
      {segments.map((seg) => {
        if (seg.type === 'choice') {
          return (
            <ChoiceField
              key={seg.questions[0].id}
              questions={seg.questions as any}
              startIndex={(startQuestionNumber ?? 1) - 1 + seg.startIndex}
              onChange={onChoiceChange}
            />
          )
        }
        if (seg.type === 'input') {
          const question = seg.question
          const savedAnswer = answers[question.id]?.content.answer as string | undefined
          const inputDefaults: Record<string, string> = {}
          if (savedAnswer) {
            const parts = savedAnswer.split(',')
            parts.forEach((p, i) => { inputDefaults[String(i)] = p })
          }
          return (
            <div key={question.id} className="space-y-3">
              <div className="flex items-baseline space-x-2">
                <span className="shrink-0 text-lg font-medium leading-7">{(startQuestionNumber ?? 1) + seg.index}.</span>
                <div className="flex-1">
                  <div className="text-lg font-medium text-foreground">
                    {question.stemMdx ? (
                      <InputDefaultValuesContext.Provider value={inputDefaults}>
                        <MathInput2Provider onInputChange={(idx, val) => onInputChange(question.id, idx, val)}>
                          <MDXRemote {...question.stemMdx} components={components} />
                        </MathInput2Provider>
                      </InputDefaultValuesContext.Provider>
                    ) : (
                      <p>{question.stem}</p>
                    )}
                  </div>
                  {question.subStem && (
                    <p className="mt-2 text-lg text-muted-foreground italic">{question.subStem}</p>
                  )}
                </div>
              </div>
            </div>
          )
        }
        return (
          <AnswerQuestion
            key={seg.question.id}
            question={seg.question}
            index={(startQuestionNumber ?? 1) + seg.index}
            language={language}
            minHeight={minHeight}
            showWordCount={showWordCount}
            showIndex={!!startQuestionNumber || !isSingleTextQuestion}
          />
        )
      })}
    </>
  )

  if (hasArticle && articleLayout === 'inline') {
    // 材料与题目都在主区域：不设左右两栏的阅读区（名著等题型）
    return (
      <div className="bg-background font-question lg:h-full lg:overflow-hidden">
        <div className="flex flex-col lg:h-full lg:flex-row">
          <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto">
            <QuestionSection>
              <div className="prose max-w-none dark:prose-invert">
                <MDXRemote {...mdxSource!} components={components} />
              </div>
              {body}
            </QuestionSection>
          </div>
        </div>
      </div>
    )
  }

  if (hasArticle) {
    return (
      <ReadingLayout
        mdxSource={mdxSource!}
        indentParagraphs={indentParagraphs}
        startQuestionNumber={startQuestionNumber}
      >
        {body}
      </ReadingLayout>
    )
  }

  return (
    <div className="bg-background font-question lg:h-full lg:overflow-hidden">
      <div className="flex flex-col lg:h-full lg:flex-row">
        <div
          className={
            fullWidth
              ? "flex-1 w-full p-3 sm:p-4 overflow-y-auto max-w-none"
              : alignLeft
                ? "flex-1 p-6 overflow-y-auto max-w-4xl"
                : "flex-1 p-6 overflow-y-auto max-w-4xl mx-auto"
          }
        >
          <QuestionSection>
            {body}
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}