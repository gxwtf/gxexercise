"use client"

import { useState, useEffect } from "react"
import { FileText, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Item,
    ItemActions,
    ItemContent,
    ItemMedia,
    ItemTitle,
    ItemDescription,
} from "@/components/ui/item"

interface TestCardProps {
    id: string
    title: string
    type: string
    year: number | null
    grade: string | null
    subject: string
    latestSubmissionId?: string | null
    submissionCount?: number
}

export function TestCard({
    id,
    title,
    type,
    year,
    grade,
    subject,
    latestSubmissionId,
    submissionCount = 0,
}: TestCardProps) {
    const [showResumeDialog, setShowResumeDialog] = useState(false)
    const [hasSavedData, setHasSavedData] = useState(false)

    useEffect(() => {
        try {
            const state = localStorage.getItem(`exam_state_${id}`)
            const answers = localStorage.getItem(`exam_answers_test-paper-${id}`)
            if (state || answers) {
                setHasSavedData(true)
            }
        } catch {}
    }, [id])

    const handleStart = () => {
        if (hasSavedData) {
            setShowResumeDialog(true)
        } else {
            window.open(`/test-paper/${id}`, "_blank")
        }
    }

    const handleResume = () => {
        window.open(`/test-paper/${id}/practice`, "_blank")
    }

    const handleRestart = () => {
        try { localStorage.removeItem(`exam_state_${id}`) } catch {}
        try { localStorage.removeItem(`exam_answers_test-paper-${id}`) } catch {}
        setHasSavedData(false)
        window.open(`/test-paper/${id}`, "_blank")
    }

    return (
        <>
            <Item
                variant="outline"
                className="w-full"
            >
                <ItemMedia variant="icon">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                </ItemMedia>
                <ItemContent>
                    <ItemTitle className="text-base font-semibold mb-1">
                        {title}
                    </ItemTitle>
                    <ItemDescription className="flex gap-1 items-center">
                        <Badge variant="destructive" className="text-xs">
                            {type}
                        </Badge>
                        {year && (
                            <Badge variant="secondary" className="text-xs">
                                {year}年
                            </Badge>
                        )}
                        {grade && (
                            <Badge variant="outline" className="text-xs">
                                {grade}
                            </Badge>
                        )}
                        <span className="flex items-center gap-1 ml-1">
                            <Users className="w-3 h-3" />
                            <span className="text-xs text-muted-foreground">{submissionCount}</span>
                        </span>
                    </ItemDescription>
                </ItemContent>
                <ItemActions>
                    {latestSubmissionId && (
                        <Button
                            variant="outline"
                            onClick={(e) => {
                                e.stopPropagation()
                                window.open(`/test-paper/${id}/result/${latestSubmissionId}`, "_blank")
                            }}
                        >
                            练习报告
                        </Button>
                    )}
                    <Button
                        variant="default"
                        onClick={(e) => {
                            e.stopPropagation()
                            handleStart()
                        }}
                    >
                        开始练习
                    </Button>
                </ItemActions>
            </Item>

            <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>有未完成的练习</AlertDialogTitle>
                        <AlertDialogDescription>
                            检测到您有未完成的作答记录，是否继续上次的答题？
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <Button variant="outline" onClick={handleRestart}>重新开始</Button>
                        <AlertDialogAction onClick={handleResume}>继续答题</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}