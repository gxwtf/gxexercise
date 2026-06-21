import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users } from 'lucide-react';
import Link from "next/link";

interface GroupCardProps {
  id: string;
  title: string;
  content: string;
  subject: string;
  questionCount?: number;
  source: string;
  tags: string[];
}

export function GroupCard({
  id,
  title,
  content,
  questionCount,
  source,
  tags,
}: GroupCardProps) {
  const contentPreview = content.length > 100 ? content.substring(0, 100) + '...' : content;

  return (
    <Card className="w-full border-l-4 border-primary">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary">组题</span>
        </div>
        <CardTitle className="line-clamp-1">
          {title}
        </CardTitle>
        <CardDescription className="flex items-center gap-4 text-sm">
          <span>{source}</span>
          {questionCount !== undefined && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{questionCount} 道题</span>
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {contentPreview}
        </p>
        
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {tags.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 4}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Link href={`/question/${id}`} className="flex-1" target="_blank">
          <Button className="w-full">
            开始练习
          </Button>
        </Link>
        <Link href={`/question/${id}/review`} className="flex-1" target="_blank">
          <Button variant="outline" className="w-full">
            回顾/学习
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}