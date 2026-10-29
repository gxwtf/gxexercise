"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, FileDown, FileText } from "lucide-react"
import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote"
import { useMDXComponents, MathInput2Provider } from "@/mdx-components"
import { Separator } from "@/components/ui/separator"
import { QuestionSwitcher, type QuestionSwitcherItem } from "@/components/review/QuestionSwitcher"
import { ChoiceReview } from "@/components/review/ChoiceReview"
import { SubmissionHistoryTable, type SubmissionHistoryItem } from "@/components/review/SubmissionHistoryTable"
import { QuestionSection } from "@/components/QuestionSection"
import { EnglishReading, ClozeContext } from "@/components/article/english-reading"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { QueueStatus } from "@/components/review/QueueStatus"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { excellentCriteriaText } from "@/lib/excellent-answer-rules"
import Link from "next/link"

interface ReviewContentData {
    questionGroup: {
        id: string
        title: string
        questionType: string
        category: string
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
    allBlankCorrect?: Record<string, boolean>
    currentSubmissionId: string | null
    isSubjective: boolean
    userScore: number | null
    questionScore: number
    avgScore: number | null
    excellentAnswers: ExcellentAnswerView[]
    shareAsExcellent: boolean | null
    aiFeedback: string | null
    enWritingFeedback: Record<string, unknown> | null
    enWritingSubMaxes: { contentMax: number; languageMax: number; structureMax: number } | null
    overallCommentMdx: MDXRemoteSerializeResult | null
    lineCorrectionsMdx: MDXRemoteSerializeResult | null
    correctionsMdx: MDXRemoteSerializeResult | null
    betterExpressionsMdx: MDXRemoteSerializeResult | null
    modelEssayMdx: MDXRemoteSerializeResult | null
}

interface ExcellentAnswerView {
    id: string
    userId: number
    userName: string
    score: number
    maxScore: number
    answer: string
    answerMdx: MDXRemoteSerializeResult | null
    isMine: boolean
}

interface ReviewContentProps {
    data: ReviewContentData
    basePath: string
}

/** 返回：优先回到「进入做题页之前的那一页」（做题页会记在 sessionStorage 里），否则退回上一页 */
function useGoBack(groupId?: string) {
    const router = useRouter()
    return React.useCallback(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = groupId ? sessionStorage.getItem(`practice_entry_${groupId}`) : null
                if (saved) {
                    router.push(saved)
                    return
                }
            } catch {
                /* 忽略 */
            }
            if (window.history.length > 1) {
                router.back()
                return
            }
        }
        router.push("/")
    }, [router, groupId])
}

function getQuestionCategory(questionType: string, groupType: string): "choice" | "fill" | "essay" {
    if (questionType === "single" || questionType === "multiple" || questionType === "choice") return "choice"
    const combined = `${questionType} ${groupType}`
    if (combined.includes("选择") || combined.includes("七选五") || (groupType === "math-choice" || groupType === "physics-choice" || groupType === "chemistry-choice" || groupType === "biology-choice")) return "choice"
    if (combined.includes("填空") || combined.includes("语法") || combined.includes("grammar") || combined.includes("input2") || groupType === "word-choice" || groupType === "math-fill") return "fill" 
    if (groupType === "biology-fill") return "fill"
    if (combined.includes("解答") || combined.includes("阅读表达") || combined.includes("reading-expression") || combined.includes("写作") || combined.includes("en-writing")) return "essay"
    if (groupType === "chinese-reading") {
        if (questionType === "input" || questionType === "input2") return "fill"
        if (questionType === "text") return "essay"
    }
    if (groupType === "politics" && questionType === "text") return "essay"
    if (groupType === "chinese-essay" || groupType === "chinese-micro-writing") return "essay"
    return "choice"
}

export function ReviewContent({ data, basePath }: ReviewContentProps) {
    const components = useMDXComponents()
    const goBack = useGoBack(data.questionGroup.id)
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
        allBlankCorrect,
        isSubjective,
        userScore,
        questionScore,
        avgScore,
        excellentAnswers,
        shareAsExcellent,
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
    const isMathType = ["math-fill", "math-choice", "physics-choice", "chemistry-choice", "biology-choice"].includes(questionGroup.questionType)
    const isWordChoice = questionGroup.questionType === "word-choice"
    // 名著阅读：没有阅读区，材料直接排在题目上方
    const isNamedBook = questionGroup.category === "名著"
    const showArticlePanel = !isEnWriting && !isMathType && !isWordChoice && !isNamedBook && !!articleMdx
    const hasMultipleQuestions = questionSwitcherItems.length > 1
    const correctRateDisplay = correctRate != null ? `${Math.round(correctRate * 100)}%` : "-"
    const isPending = gradingStatus === "pending"
    // 微写作/大作文暂时不判分；没作答的主观题也不该显示「评阅中」
    const isSkipped = gradingStatus === "skipped"

    const displayUserAnswer = userAnswer
        ? (isChoiceType ? userAnswer.toUpperCase() : userAnswer)
        : null
    const hasAnswer = !!(displayUserAnswer && displayUserAnswer.trim())
    const displayCorrectAnswer = isChoiceType ? correctAnswer.toUpperCase() : correctAnswer

    const usesBlanks = ["seven-choose-five", "cloze", "grammar", "en-reading", "reading-expression", "word-choice", "biology-fill"].includes(questionGroup.questionType)

    return (
        <div className="h-screen overflow-hidden bg-background">
            <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
                <div className="flex h-14 items-center gap-2 px-3 sm:px-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 gap-1 px-2"
                        onClick={() => goBack()}
                    >
                        <ChevronLeft className="size-4" />
                        返回
                    </Button>
                    <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">
                        {questionGroup.title} - 学习回顾
                    </h1>
                    {/* 主入口：整组分析报告（全部小题 + 我的作答 + 正确答案 + 解析 + AI 批改） */}
                    <Button asChild size="sm" className="shrink-0" title="导出本题组的整份分析报告 PDF">
                        <a href={`/question/${questionGroup.id}/review/pdf`}>
                            <FileDown className="size-4" />
                            <span className="hidden sm:inline">导出题组分析报告</span>
                            <span className="sm:hidden">整组报告</span>
                        </a>
                    </Button>
                    {/* 次要入口：单题分析报告（只含当前这道题），功能保留 */}
                    <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="shrink-0 gap-1 text-muted-foreground"
                        title="仅导出当前这道题的分析报告 PDF"
                        aria-label="导出当前这道题的分析报告 PDF"
                    >
                        <a href={`${basePath}/${currentIndex}/pdf`}>
                            <FileText className="size-4" />
                            <span className="hidden md:inline">单题 PDF</span>
                        </a>
                    </Button>
                </div>
            </header>
            <div className="flex" style={{ height: "calc(100vh - 56px)" }}>
                {showArticlePanel && (
                    <>
                        <div className="flex-1 overflow-y-auto p-6">
                            <EnglishReading
                                indentParagraphs
                                startQuestionNumber={1}
                                blanks={allUserBlanks}
                                options={options}
                                correctBlanks={allCorrectBlanks}
                                blankCorrectness={allBlankCorrect}
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
                        {isNamedBook && articleMdx ? (
                            <div className="mb-2">
                                <MDXRemote {...articleMdx} components={components} />
                            </div>
                        ) : null}
                        {stemMdx ? (
                            <div
                                className={
                                    questionGroup.questionType === "chemistry-image"
                                        ? "qimage-full flex items-start gap-1"
                                        : "flex items-baseline gap-1"
                                }
                            >
                                {hasMultipleQuestions && (
                                    <span
                                        className={
                                            questionGroup.questionType === "chemistry-image"
                                                ? "shrink-0 text-lg font-medium leading-none pt-[2px]"
                                                : "text-lg font-medium"
                                        }
                                    >
                                        {currentIndex}.
                                    </span>
                                )}
                                <div
                                    className={
                                        questionGroup.questionType === "chemistry-image"
                                            ? "mt-[3px] min-w-0 flex-1 text-lg font-medium font-question"
                                            : "text-lg font-medium font-question"
                                    }
                                >
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
                                            {isSkipped ? (
                                                <span className="text-muted-foreground">不判分</span>
                                            ) : !hasAnswer ? (
                                                <span className="text-muted-foreground">未作答</span>
                                            ) : isPending || isCorrect === null ? (
                                                <span className="text-amber-700 dark:text-amber-400">评阅中</span>
                                            ) : (
                                                <>{userScore ?? "-"} / {questionScore}</>
                                            )}
                                        </span>
                                        {"  "}平均得分：
                                        <span className="font-medium">
                                            {avgScore != null ? `${avgScore.toFixed(1)} / ${questionScore}` : "-"}
                                        </span>
                                    </p>
                                    {shareAsExcellent != null && data.currentSubmissionId && hasAnswer && (
                                        <div className="mt-3 border-t border-border pt-3">
                                            <ExcellentShareToggle
                                                submissionId={data.currentSubmissionId}
                                                initialAllowed={shareAsExcellent}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                            <Tabs defaultValue={userAnswerMdx ? "my-answer" : "reference-answer"}>
                                <TabsList>
                                    {userAnswerMdx && (
                                    <TabsTrigger value="my-answer">我的作答</TabsTrigger>
                                )}
                                <TabsTrigger value="reference-answer">参考答案</TabsTrigger>
                                {isSubjective && (
                                    <TabsTrigger value="excellent-answers">
                                        优秀解答{excellentAnswers.length > 0 ? `（${excellentAnswers.length}）` : ""}
                                    </TabsTrigger>
                                )}
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
                                    {isPending && data.currentSubmissionId && (
                                        <QueueStatus submissionIds={[data.currentSubmissionId]} />
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
                                {isSubjective && (
                                    <TabsContent value="excellent-answers">
                                        <ExcellentAnswersPanel
                                            answers={excellentAnswers}
                                            groupType={questionGroup.questionType}
                                        />
                                    </TabsContent>
                                )}
                            </Tabs>
                        </div>
                    ) : (
                        <div className="mt-6 mb-6 p-4 rounded-lg bg-muted/50">
                            {isSubjective ? (
                                <>
                                <p className="text-base">
                                    我的作答：
                                    <span className="font-medium text-foreground">{displayUserAnswer ?? "未作答"}</span>
                                    {"  "}得分：
                                    <span className="font-medium">
                                        {isSkipped ? (
                                            <span className="text-muted-foreground">不判分</span>
                                        ) : !hasAnswer ? (
                                            <span className="text-muted-foreground">未作答</span>
                                        ) : isPending || userScore == null ? (
                                            <span className="text-amber-700 dark:text-amber-400">评阅中</span>
                                        ) : (
                                            <>{userScore} / {questionScore}</>
                                        )}
                                    </span>
                                    {"  "}平均得分：
                                    <span className="font-medium">
                                        {avgScore != null ? `${avgScore.toFixed(1)} / ${questionScore}` : "-"}
                                    </span>
                                </p>
                                {shareAsExcellent != null && data.currentSubmissionId && hasAnswer && (
                                    <div className="mt-3 border-t border-border pt-3">
                                        <ExcellentShareToggle
                                            submissionId={data.currentSubmissionId}
                                            initialAllowed={shareAsExcellent}
                                        />
                                    </div>
                                )}
                                </>
                            ) : (
                            <p className="text-base">
                                我的作答：
                                <span className={isCorrect === null ? "text-muted-foreground font-medium" : isCorrect ? "text-green-700 dark:text-green-400 font-medium" : "text-red-700 dark:text-red-400 font-medium"}>
                                    {displayUserAnswer ?? "未作答"}
                                </span>
                                {"  "}正确答案：
                                <span className="text-green-700 dark:text-green-400 font-medium">{displayCorrectAnswer}</span>
                                {"  "}正确率：
                                <span className="font-medium">{correctRateDisplay}</span>
                                {"  "}平均得分：
                                <span className="font-medium">
                                    {avgScore != null ? `${avgScore.toFixed(1)} / ${questionScore}` : "-"}
                                </span>
                            </p>
                            )}
                        </div>
                    )}

                    {isSubjective && category !== "essay" && (
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-3">优秀解答</h3>
                            <ExcellentAnswersPanel
                                answers={excellentAnswers}
                                groupType={questionGroup.questionType}
                            />
                        </div>
                    )}

                    {analysisMdx ? (
                        <>
                            <h3 className="text-lg font-semibold mb-3">题目解析</h3>
                            <QuestionSection>
                                <div className="prose dark:prose-invert max-w-none font-question">
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
                            maxScore={questionScore}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

/** 每条优秀解答：作者、得分、作答内容 */
function ExcellentAnswersPanel({
    answers,
    groupType,
}: {
    answers: ExcellentAnswerView[]
    groupType: string
}) {
    const components = useMDXComponents()

    if (answers.length === 0) {
        return (
            <QuestionSection>
                <p className="text-sm text-muted-foreground">
                    暂无优秀解答。达到优秀标准（{excellentCriteriaText(groupType)}）且同学允许展示的作答会出现在这里。
                </p>
            </QuestionSection>
        )
    }

    const formatScore = (value: number) => Math.round(value * 10) / 10

    return (
        <div className="space-y-4">
            {answers.map((answer, index) => (
                <QuestionSection key={answer.id}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                {index + 1}
                            </span>
                            <span className="truncate text-base font-medium text-foreground">{answer.userName}</span>
                            {answer.isMine && <Badge variant="secondary">我的</Badge>}
                        </div>
                        <span className="text-sm text-muted-foreground">
                            得分 <span className="font-semibold text-foreground">{formatScore(answer.score)}</span>
                            <span> / {formatScore(answer.maxScore)}</span>
                        </span>
                    </div>
                    <div className="prose dark:prose-invert max-w-none font-question">
                        {answer.answerMdx ? (
                            <MDXRemote {...answer.answerMdx} components={components} />
                        ) : (
                            <p className="whitespace-pre-wrap">{answer.answer}</p>
                        )}
                    </div>
                </QuestionSection>
            ))}
        </div>
    )
}

/** 是否允许本次作答以「优秀解答」展示给其他同学 */
function ExcellentShareToggle({
    submissionId,
    initialAllowed,
}: {
    submissionId: string
    initialAllowed: boolean
}) {
    const router = useRouter()
    const [allowed, setAllowed] = React.useState(initialAllowed)
    const [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        setAllowed(initialAllowed)
        setError(null)
    }, [initialAllowed, submissionId])

    const handleChange = React.useCallback(async (checked: boolean) => {
        const previous = allowed
        setAllowed(checked)
        setSaving(true)
        setError(null)
        try {
            const res = await fetch(`/api/submissions/${submissionId}/excellent`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ allowed: checked }),
            })
            if (!res.ok) throw new Error("保存失败")
            // 让「优秀解答」列表按最新设置刷新
            router.refresh()
        } catch {
            setAllowed(previous)
            setError("保存失败，请稍后重试")
        } finally {
            setSaving(false)
        }
    }, [allowed, submissionId, router])

    return (
        <div className="space-y-1">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox
                    checked={allowed}
                    disabled={saving}
                    onCheckedChange={(value) => handleChange(value === true)}
                    className="mt-0.5"
                />
                <span>
                    <span className="font-medium text-foreground">允许本次作答作为「优秀解答」展示给其他同学</span>
                    <span className="block text-xs text-muted-foreground">
                        默认允许。达到优秀标准的作答会按得分从高到低展示在本题回顾页，最多 3 条；可随时关闭。
                    </span>
                </span>
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    )
}
