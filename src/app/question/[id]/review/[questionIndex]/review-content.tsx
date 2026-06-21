"use client"

import * as React from "react"
import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote"
import { useMDXComponents } from "@/mdx-components"
import { Separator } from "@/components/ui/separator"
import { QuestionSwitcher, type QuestionSwitcherItem } from "@/components/review/QuestionSwitcher"
import { ChoiceReview } from "@/components/review/ChoiceReview"
import { SubmissionHistoryTable, type SubmissionHistoryItem } from "@/components/review/SubmissionHistoryTable"
import { QuestionSection } from "@/components/QuestionSection"

interface ReviewContentData {
    questionGroup: {
        id: string
        title: string
    }
    articleMdx: MDXRemoteSerializeResult | null
    stemMdx: MDXRemoteSerializeResult | null
    analysisMdx: MDXRemoteSerializeResult | null
    questionSwitcherItems: QuestionSwitcherItem[]
    currentQuestion: {
        id: string
        questionType: string
    }
    options: Array<{ id: string; label: string }>
    correctAnswer: string
    userAnswer: string | null
    isCorrect: boolean | null
    currentIndex: number
    historyItems: SubmissionHistoryItem[]
    correctRate: number | null
}

interface ReviewContentProps {
    data: ReviewContentData
    basePath: string
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
        userAnswer,
        isCorrect,
        currentIndex,
        historyItems,
        correctRate,
    } = data

    const correctRateDisplay = correctRate != null ? `${Math.round(correctRate * 100)}%` : "-"
    const displayUserAnswer = userAnswer ? userAnswer.toUpperCase() : null
    const displayCorrectAnswer = correctAnswer.toUpperCase()

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
                <div className="flex-1 overflow-y-auto p-6">
                    <article
                        className="max-w-4xl mx-auto"
                        style={{ fontFamily: '"Times New Roman", serif' }}
                    >
                        {articleMdx ? (
                            <MDXRemote {...articleMdx} components={components} />
                        ) : (
                            <p className="text-muted-foreground">暂无文章内容</p>
                        )}
                    </article>
                </div>

                <Separator orientation="vertical" />

                <div className="flex-1 p-6 overflow-y-auto">
                    <QuestionSwitcher
                        questions={questionSwitcherItems}
                        currentIndex={currentIndex}
                        basePath={basePath}
                    />

                    <QuestionSection>
                        {stemMdx ? (
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-medium">{currentIndex}.</span>
                                <div className="text-lg font-medium">
                                    <MDXRemote {...stemMdx} components={components} />
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

                    <div className="mt-6 mb-6 p-4 rounded-lg bg-muted/50">
                        <p className="text-base">
                            我的作答：
                            <span className={isCorrect ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                {displayUserAnswer ?? "未作答"}
                            </span>
                            {"  "}正确答案：
                            <span className="text-green-600 font-medium">{displayCorrectAnswer}</span>
                            {"  "}正确率：
                            <span className="font-medium">{correctRateDisplay}</span>
                        </p>
                    </div>

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
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}