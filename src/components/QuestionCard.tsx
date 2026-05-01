import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, FileText, Calendar, ExternalLink, Tag } from 'lucide-react'

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

const subjectColors: Record<string, string> = {
  '数学': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  '语文': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  '英语': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  '物理': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  '化学': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  '生物': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  '历史': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  '地理': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  '政治': 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
}

const typeColors: Record<string, string> = {
  '选择题': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  '填空题': 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  '解答题': 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
  '证明题': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  '计算题': 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
}

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

          <Badge className={`flex items-center gap-1 ${typeColors[questionType] || 'bg-secondary text-secondary-foreground'}`}>
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
