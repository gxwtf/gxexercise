import { FileText } from "lucide-react"
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
    year: string
    subject: string
    onStart?: (id: string) => void
}

export function TestCard({
    id,
    title,
    type,
    year,
    subject,
    onStart
}: TestCardProps) {
    return (
        <Item variant="outline" className="w-full">
            <ItemMedia variant="icon">
                <FileText className="w-5 h-5 text-muted-foreground" />
            </ItemMedia>
            <ItemContent>
                <ItemTitle className="text-base font-semibold mb-1">
                    {title}
                </ItemTitle>
                <ItemDescription className="flex gap-1">
                    <Badge variant="destructive" className="text-xs">
                        {type}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                        {year}
                    </Badge>
                </ItemDescription>
            </ItemContent>
            <ItemActions>
                <Button
                    variant="default"
                    onClick={() => onStart?.(id)}
                >
                    开始练习
                </Button>
            </ItemActions>
        </Item>
    )
}