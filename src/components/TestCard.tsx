import { FileText, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
    return (
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
                        window.open(`/test-paper/${id}`, "_blank")
                    }}
                >
                    开始练习
                </Button>
            </ItemActions>
        </Item>
    )
}