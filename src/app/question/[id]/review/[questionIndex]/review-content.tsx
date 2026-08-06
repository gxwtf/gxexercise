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
        currentIndex,
        historyItems,
        correctRate,
        allUserBlanks,
        allCorrectBlanks,
        isSubjective,
        userScore,
        questionScore,
        avgScore,
    } = data

    const category = getQuestionCategory(currentQuestion.questionType, questionGroup.questionType)
    const isChoiceType = category === "choice"
    const isEnWriting = questionGroup.questionType === "en-writing"
    const isMathType = questionGroup.questionType === "math-fill" || questionGroup.questionType === "math-choice"
    const isWordChoice = questionGroup.questionType === "word-choice"
    const hasMultipleQuestions = questionSwitcherItems.length > 1
    const correctRateDisplay = correctRate != null ? `${Math.round(correctRate * 100)}%` : "-"
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
                                            {isCorrect === null ? (
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