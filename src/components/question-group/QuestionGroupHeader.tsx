'use client'

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, FileDown, Send } from 'lucide-react';
import useSession from '@/lib/use-session';
import { useRouter } from 'next/navigation';
import { useAlertContext } from '@/components/alert-provider';
import { useAnswer } from './AnswerContext';

interface QuestionGroupHeaderProps {
  title: string;
  questionGroupId: string;
  questionCount?: number;
  score?: number | null;
}

export default function QuestionGroupHeader({ title, questionGroupId, questionCount, score }: QuestionGroupHeaderProps) {
  const [seconds, setSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { session } = useSession();
  const router = useRouter();
  const { showAlert } = useAlertContext();
  const { getAllAnswers } = useAnswer();

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 记录「进入做题页之前的那一页」：回顾页的返回按钮会直接回到它
  useEffect(() => {
    try {
      const cur = window.location.pathname + window.location.search;
      let entry = "";
      const from = document.referrer || "";
      if (from) {
        const u = new URL(from);
        const p = u.pathname + u.search;
        if (u.origin === window.location.origin && !u.pathname.includes("/review") && p !== cur) entry = p;
      }
      if (!entry) entry = sessionStorage.getItem("list_url") || "";
      if (entry && entry !== cur) sessionStorage.setItem(`practice_entry_${questionGroupId}`, entry);
    } catch {}
  }, [questionGroupId]);

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
      showAlert({ type: 'destructive', title: '请先登录' })
      router.push(`/login?back=/question/${questionGroupId}`)
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
          // userId 由服务端从登录会话读取，前端不再传递
          questionGroupId,
          questionSubmissions,
          duration: seconds,
        }),
      });

      if (response.ok) {
        await response.json();
        // 用 replace 覆盖做题页的历史记录：这样在回顾页按返回（浏览器或按钮）都直接回到列表页
        router.replace(`/question/${questionGroupId}/review/1`);
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
    <header className="sticky top-0 z-50 bg-background border-b">
      <div className="flex items-center justify-between h-16 px-6">
        <h1 className="text-xl font-semibold text-foreground truncate">
          {title}{questionCount != null ? `（共${questionCount}小题${score != null ? `；共${score}分` : ""}）` : ""}
        </h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="font-mono text-sm font-medium">{formatTime(seconds)}</span>
          </div>

          {/* 导出「纸质作答卷」PDF：无答案、按考试卷版式留白（不是分析报告） */}
          <Button variant="outline" asChild className="flex items-center gap-2">
            <a href={`/question/${questionGroupId}/paper/pdf`} download title="导出空白作答卷 PDF（无答案，可打印后手写作答）" aria-label="导出空白作答卷 PDF">
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">导出空白卷</span>
            </a>
          </Button>

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