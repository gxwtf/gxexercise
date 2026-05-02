import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, FileText, Calendar, ExternalLink, Tag } from 'lucide-react'
import { subjectColors, questionTypeColors } from '@/constants/questionTypes'

interface QuestionCardProps {
  id: string
  title: string
  imageUrl?: string
  subject: string
  questionType: string
  year?: number
  source: string
  tags: string[]
}

const defaultImageUrl = 'https://neeko-copilot.bytedance.net/api/text2image?prompt=education%20learning%20exam%20question%20abstract%20blue%20gradient&image_size=square'

export function QuestionCard({
  title,
  imageUrl,
  subject,
  questionType,
  year,
  source,
  tags,
}: QuestionCardProps) {
  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <div className="relative h-40 overflow-hidden bg-muted">
        <img
          src={imageUrl || defaultImageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      <CardContent className="p-4">
        <h3 className="text-lg font-semibold text-card-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors duration-200">
          {title}
        </h3>

        <div className="flex flex-wrap gap-2 mb-3">
          <Badge className={`flex items-center gap-1 ${subjectColors[subject] || 'bg-secondary text-secondary-foreground'}`}>
            <BookOpen className="w-3 h-3" />
            {subject}
          </Badge>

          <Badge className={`flex items-center gap-1 ${questionTypeColors[questionType as keyof typeof questionTypeColors] || 'bg-secondary text-secondary-foreground'}`}>
            <FileText className="w-3 h-3" />
            {questionType}
          </Badge>

          {year && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {year}年
            </Badge>
          )}

          <Badge variant="outline" className="flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />
            {source}
          </Badge>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1 text-xs"
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}