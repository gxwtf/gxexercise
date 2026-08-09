"use client"

import * as React from "react"
import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote"
import { useMDXComponents, MathInput2Provider } from "@/mdx-components"
import { Separator } from "@/components/ui/separator"
import { QuestionSwitcher, type QuestionSwitcherItem } from "@/components/review/QuestionSwitcher"
import { ChoiceReview } from "@/components/review/ChoiceReview"
import { SubmissionHistoryTable, type SubmissionHistoryItem } from "@/components/review/SubmissionHistoryTable"
import { QuestionSection } from "@/components/QuestionSection"
import { EnglishReading, ClozeContext } from "@/components/article/english-reading"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ReviewContentData {
    questionGroup: {
        id: string
        title: string
        questionType: string
    }
    articleMdx: MDXRemoteSerializeResult | null
    stemMdx: MDXRemoteSerializeResult | null
    analysisMdx: MDXRemoteSerializeResult | null
    questionSwitcherItems: QuestionSwitcherItem[]
    currentQuestion: {
        id: string
        questionType: string
    }
    options: Array<{ id: string; label: string; labelMdx?: MDXRemoteSerializeResult | null }>
    correctAnswer: string
    correctAnswerMdx: MDXRemoteSerializeResult | null
    userAnswer: string | null
    userAnswerMdx: MDXRemoteSerializeResult | null
    isCorrect: boolean | null
    gradingStatus: string | null
    currentIndex: number
    historyItems: SubmissionHistoryItem[]
    correctRate: number | null
    allUserBlanks: Record<string, string>
    allCorrectBlanks: Record<string, string>
    currentSubmissionId: string | null
    isSubjective: boolean
    userScore: number | null
    questionScore: number
    avgScore: number | null
    aiFeedback: string | null
    enWritingFeedback: Record<string, unknown> | null
    enWritingSubMaxes: { contentMax: number; languageMax: number; structureMax: number } | null
    overallCommentMdx: MDXRemoteSerializeResult | null
    lineCorrectionsMdx: MDXRemoteSerializeResult | null
    correctionsMdx: MDXRemoteSerializeResult | null
    betterExpressionsMdx: MDXRemoteSerializeResult | null
    modelEssayMdx: MDXRemoteSerializeResult | null
}

interface ReviewContentProps {
    data: ReviewContentData
    basePath: string
}

function getQuestionCategory(questionType: string, groupType: string): "choice" | "fill" | "essay" {
    if (questionType === "single" || questionType === "multiple" || questionType === "choice") return "choice"
    const combined = `${questionType} ${groupType}`
    if (combined.includes("选择") || combined.includes("七选五") || groupType === "math-choice") return "choice"
    if (combined.includes("填空") || combined.includes("语法") || combined.includes("grammar") || combined.includes("input2") || groupType === "word-choice" || groupType === "math-fill") return "fill"
    if (combined.includes("解答") || combined.includes("阅读表达") || combined.includes("reading-expression") || combined.includes("写作") || combined.includes("en-writing")) return "essay"
    if (groupType === "chinese-reading") {
        if (questionType === "input" || questionType === "input2") return "fill"
        if (questionType === "text") return "essay"
    }
    return "choice"
}

export function ReviewContent({ data, basePath }: ReviewContentProps) {
    const components = useMDXComponents()
    const {
        questionGroup,
        articleMdx,
        stemMdx,
        analysisMdx,
        questionSwitcherItems,
        currentQuestion,
        options,
        correctAnswer,
        correctAnswerMdx,
        userAnswer,
        userAnswerMdx,
        isCorrect,
        gradingStatus,
        currentIndex,
        historyItems,
        correctRate,
        allUserBlanks,
        allCorrectBlanks,
        isSubjective,
        userScore,
        questionScore,
        avgScore,
        aiFeedback,
        enWritingFeedback,
        enWritingSubMaxes,
        overallCommentMdx,
        lineCorrectionsMdx,
        correctionsMdx,
        betterExpressionsMdx,
        modelEssayMdx,
    } = data

    const category = getQuestionCategory(currentQuestion.questionType, questionGroup.questionType)
    const isChoiceType = category === "choice"
    const isEnWriting = questionGroup.questionType === "en-writing"
    const isMathType = questionGroup.questionType === "math-fill" || questionGroup.questionType === "math-choice"
    const isWordChoice = questionGroup.questionType === "word-choice"
    const hasMultipleQuestions = questionSwitcherItems.length > 1
    const correctRateDisplay = correctRate != null ? `${Math.round(correctRate * 100)}%` : "-"
    const isPending = gradingStatus === "pending"

    const displayUserAnswer = userAnswer
        ? (isChoiceType ? userAnswer.toUpperCase() : userAnswer)
        : null
    const displayCorrectAnswer = isChoiceType ? correctAnswer.toUpperCase() : correctAnswer

    const usesBlanks = ["seven-choose-five", "cloze", "grammar", "en-reading", "reading-expression", "word-choice"].includes(questionGroup.questionType)

    return (
        <div className="h-screen overflow-hidden bg-background">
            <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
                <div className="flex items-center h-14 px-6">
                    <h1 className="text-lg font-semibold text-foreground truncate">
                        {questionGroup.title} - 学习回顾
                    </h1>
                </div>
            </header>
            <div className="flex" style={{ height: "calc(100vh - 56px)" }}>
                {!isEnWriting && !isMathType && !isWordChoice && (
                    <>
                        <div className="flex-1 overflow-y-auto p-6">
                            <EnglishReading
                                indentParagraphs
                                startQuestionNumber={1}
                                blanks={allUserBlanks}
                                options={options}
                                correctBlanks={allCorrectBlanks}
                                reviewMode={usesBlanks}
                            >
                                {articleMdx ? (
                                    <MDXRemote {...articleMdx} components={components} />
                                ) : (
                                    <p className="text-muted-foreground">暂无文章内容</p>
                                )}
                            </EnglishReading>
                        </div>

                        <Separator orientation="vertical" />
                    </>
                )}

                <div className="flex-1 p-6 overflow-y-auto">
                    {hasMultipleQuestions && (
                        <QuestionSwitcher
                            questions={questionSwitcherItems}
                            currentIndex={currentIndex}
                            basePath={basePath}
                        />
                    )}

                    <QuestionSection>
                        {stemMdx ? (
                            <div className="flex items-baseline gap-1">
                                {hasMultipleQuestions && <span className="text-lg font-medium">{currentIndex}.</span>}
                                <div className="text-lg font-medium">
                                    <ClozeContext.Provider value={{ getNextQuestionNumber: () => 1, reviewMode: true }}>
                                        <MathInput2Provider disabled>
                                            <MDXRemote {...stemMdx} components={components} />
                                        </MathInput2Provider>
                                    </ClozeContext.Provider>
                                </div>
                            </div>
                        ) : null}

                        {options.length > 0 ? (
                            <ChoiceReview
                                options={options}
                                correctAnswer={correctAnswer}
                                userAnswer={userAnswer}
                            />
                        ) : null}
                    </QuestionSection>

                    {category === "essay" ? (
                        <div className="mt-6 mb-6">
                            {isSubjective && (
                                <div className="mb-4 p-4 rounded-lg bg-muted/50">
                                    <p className="text-base">
                                        得分：
                                        <span className="font-medium">
                                            {isPending ? (
                                                <span className="text-amber-600">评阅中</span>
                                            ) : isCorrect === null ? (
                                                <span className="text-amber-600">评阅中</span>
                                            ) : (
                                                <>{userScore ?? "-"} / {questionScore}</>
                                            )}
                                        </span>
                                        {"  "}平均得分：
                                        <span className="font-medium">
                                            {avgScore != null ? `${avgScore.toFixed(1)} / ${questionScore}` : "-"}
                                        </span>
                                    </p>
                                </div>
                            )}
                            <Tabs defaultValue={userAnswerMdx ? "my-answer" : "reference-answer"}>
                                <TabsList>
                                    {userAnswerMdx && (
                                    <TabsTrigger value="my-answer">我的作答</TabsTrigger>
                                )}
                                <TabsTrigger value="reference-answer">参考答案</TabsTrigger>
                            </TabsList>
                            {userAnswerMdx && (
                                <TabsContent value="my-answer">
                                    <QuestionSection>
                                        <div className="prose dark:prose-invert max-w-none">
                                            <MDXRemote {...userAnswerMdx} components={components} />
                                        </div>
                                    </QuestionSection>
                                    {isEnWriting && enWritingFeedback && !isPending ? (
                                        <EnWritingFeedbackSection
                                          feedback={enWritingFeedback}
                                          subMaxes={enWritingSubMaxes}
                                          overallCommentMdx={overallCommentMdx}
                                          lineCorrectionsMdx={lineCorrectionsMdx}
                                          correctionsMdx={correctionsMdx}
                                          betterExpressionsMdx={betterExpressionsMdx}
                                          modelEssayMdx={modelEssayMdx}
                                        />
                                    ) : (
                                        <>
                                            {aiFeedback && (
                                                <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">失分原因</p>
                                                    <p className="text-sm text-amber-700 dark:text-amber-300 whitespace-pre-wrap">{aiFeedback}</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {isPending && (
                                        <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">评阅中</p>
                                            <p className="text-sm text-blue-700 dark:text-blue-300">AI正在评阅你的作答，请稍后刷新页面查看结果。</p>
                                        </div>
                                    )}
                                </TabsContent>
                            )}
                                <TabsContent value="reference-answer">
                                    <QuestionSection>
                                        <div className="prose dark:prose-invert max-w-none">
                                            {correctAnswerMdx ? (
                                                <MDXRemote {...correctAnswerMdx} components={components} />
                                            ) : (
                                                <span className="text-muted-foreground">暂无参考答案</span>
                                            )}
                                        </div>
                                    </QuestionSection>
                                </TabsContent>
                            </Tabs>
                        </div>
                    ) : (
                        <div className="mt-6 mb-6 p-4 rounded-lg bg-muted/50">
                            <p className="text-base">
                                我的作答：
                                <span className={isCorrect === null ? "text-muted-foreground font-medium" : isCorrect ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                    {displayUserAnswer ?? "未作答"}
                                </span>
                                {"  "}正确答案：
                                <span className="text-green-600 font-medium">{displayCorrectAnswer}</span>
                                {"  "}正确率：
                                <span className="font-medium">{correctRateDisplay}</span>
                                {"  "}平均得分：
                                <span className="font-medium">
                                    {avgScore != null ? `${avgScore.toFixed(1)} / ${questionScore}` : "-"}
                                </span>
                            </p>
                        </div>
                    )}

                    {analysisMdx ? (
                        <>
                            <h3 className="text-lg font-semibold mb-3">题目解析</h3>
                            <QuestionSection>
                                <div className="prose dark:prose-invert max-w-none">
                                    <MDXRemote {...analysisMdx} components={components} />
                                </div>
                            </QuestionSection>
                        </>
                    ) : null}

                    <Separator className="my-6" />

                    <div>
                        <h3 className="text-lg font-semibold mb-3">作答记录</h3>
                        <SubmissionHistoryTable
                            submissions={historyItems}
                            questionIndex={currentIndex}
                            questionType={currentQuestion.questionType}
                            currentSubmissionId={data.currentSubmissionId ?? undefined}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

function EnWritingFeedbackSection({
  feedback,
  subMaxes,
  overallCommentMdx,
  lineCorrectionsMdx,
  correctionsMdx,
  betterExpressionsMdx,
  modelEssayMdx,
}: {
  feedback: Record<string, unknown>
  subMaxes: { contentMax: number; languageMax: number; structureMax: number } | null
  overallCommentMdx: MDXRemoteSerializeResult | null
  lineCorrectionsMdx: MDXRemoteSerializeResult | null
  correctionsMdx: MDXRemoteSerializeResult | null
  betterExpressionsMdx: MDXRemoteSerializeResult | null
  modelEssayMdx: MDXRemoteSerializeResult | null
}) {
  const components = useMDXComponents()
  const subScores = feedback.subScores as Record<string, number> | undefined

  const subScoreItems = [
    { key: "内容", max: subMaxes?.contentMax ?? 0, bg: "bg-blue-50 dark:bg-blue-950/30", bar: "bg-blue-500" },
    { key: "语言", max: subMaxes?.languageMax ?? 0, bg: "bg-emerald-50 dark:bg-emerald-950/30", bar: "bg-emerald-500" },
    { key: "结构", max: subMaxes?.structureMax ?? 0, bg: "bg-purple-50 dark:bg-purple-950/30", bar: "bg-purple-500" },
  ]

  return (
    <div className="mt-6 space-y-6 en-writing-feedback">
      <style>{`
        .en-writing-feedback .katex { font-size: 0.85em; }
      `}</style>
      {subScores && (
        <div>
          <h3 className="text-lg font-semibold mb-3">评分明细</h3>
          <QuestionSection>
            <div className="grid grid-cols-3 gap-3">
              {subScoreItems.map(({ key, max, bg, bar }) => {
                const score = subScores[key] ?? 0
                const pct = max > 0 ? Math.round((score / max) * 100) : 0
                return (
                  <div key={key} className={`rounded-lg p-4 ${bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-semibold text-foreground">{key}</span>
                      <span className="text-xl font-bold tabular-nums">{score}<span className="text-sm font-normal text-muted-foreground">/{max}</span></span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary">
                      <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </QuestionSection>
        </div>
      )}

      {overallCommentMdx && (
        <div>
          <h3 className="text-lg font-semibold mb-3">整体评价</h3>
          <QuestionSection>
            <div className="prose dark:prose-invert max-w-none">
              <MDXRemote {...overallCommentMdx} components={components} />
            </div>
          </QuestionSection>
        </div>
      )}

      {(lineCorrectionsMdx || correctionsMdx) && (
        <div>
          <h3 className="text-lg font-semibold mb-3">批改结果</h3>
          <QuestionSection>
            <div className="prose dark:prose-invert max-w-none">
              <MDXRemote {...(lineCorrectionsMdx || correctionsMdx!)} components={components} />
            </div>
          </QuestionSection>
        </div>
      )}

      {betterExpressionsMdx && (
        <div>
          <h3 className="text-lg font-semibold mb-3">更多表达</h3>
          <QuestionSection>
            <div className="prose dark:prose-invert max-w-none">
              <MDXRemote {...betterExpressionsMdx} components={components} />
            </div>
          </QuestionSection>
        </div>
      )}

      {modelEssayMdx && (
        <div>
          <h3 className="text-lg font-semibold mb-3">个性化范文</h3>
          <QuestionSection>
            <div className="prose dark:prose-invert max-w-none">
              <MDXRemote {...modelEssayMdx} components={components} />
            </div>
          </QuestionSection>
        </div>
      )}
    </div>
  )
}