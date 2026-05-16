'use client'

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, Send } from 'lucide-react';
import useSession from '@/lib/use-session';
import { useRouter } from 'next/navigation';
import { useAnswer } from './AnswerContext';

interface QuestionGroupHeaderProps {
  title: string;
  questionGroupId: string;
}

export default function QuestionGroupHeader({ title, questionGroupId }: QuestionGroupHeaderProps) {
  const [seconds, setSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { session } = useSession();
  const router = useRouter();
  const { getAllAnswers } = useAnswer();

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = useCallback(async () => {
    if (!session.userid) {
      alert('Please login first');
      return;
    }

    setIsSubmitting(true);

    try {
      const questionSubmissions = getAllAnswers();

      const response = await fetch('/api/submissions/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.userid,
          questionGroupId,
          questionSubmissions,
          duration: seconds,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        router.push(`/practice-review/${result.submissionId}`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to submit');
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  }, [session.userid, questionGroupId, seconds, getAllAnswers, router]);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="flex items-center justify-between h-16 px-6">
        <h1 className="text-xl font-semibold text-foreground truncate max-w-md">
          {title}
        </h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="font-mono text-sm font-medium">{formatTime(seconds)}</span>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>
    </header>
  );
}