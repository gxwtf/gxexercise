'use client'

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, FileDown, Send, ChevronLeft } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import useSession from '@/lib/use-session';
import { useRouter } from 'next/navigation';
import { useAlertContext } from '@/components/alert-provider';
import { useAnswer, hasAnyAnswer } from './AnswerContext';
import { readListUrl, readPracticeEntry, rememberPracticeEntry, resolveBackTarget } from '@/lib/practice-entry';

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
  const { getAllAnswers, answers } = useAnswer();
  // 只有真的填过东西才弹「放弃作答」确认；一进来就返回不拦人
  const dirty = hasAnyAnswer(answers);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 「进入做题页之前的那一页」：列表页点卡片时已经按题组 id 记好了（含 ?year=2020 这类筛选条件），
  // 这里只在没记到时用最近一次列表页地址兜底（比如直接输网址进来），不再用 document.referrer
  // ——客户端路由跳转下 referrer 永远停在整页加载那一页，会把来路记错。
  useEffect(() => {
    if (readPracticeEntry(questionGroupId)) return;
    const listUrl = readListUrl();
    const cur = window.location.pathname + window.location.search;
    if (listUrl && listUrl !== cur) rememberPracticeEntry(questionGroupId, listUrl);
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

  // 放弃作答并返回：回到「进入做题页之前的那一页」（保留列表页的筛选条件）
  const handleQuit = useCallback(() => {
    const target = resolveBackTarget(questionGroupId)
    if (target.type === 'back') router.back()
    else router.push(target.url)
  }, [router, questionGroupId])

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
        <div className="flex min-w-0 items-center gap-2">
          {dirty ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="shrink-0 gap-1 px-2" title="放弃作答并返回">
                  <ChevronLeft className="size-4" />
                  返回
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确定放弃本次作答？</AlertDialogTitle>
                  <AlertDialogDescription>
                    返回后，当前未提交的作答不会保存。已提交的记录不受影响。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>继续作答</AlertDialogCancel>
                  <AlertDialogAction onClick={handleQuit}>放弃并返回</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button variant="ghost" size="sm" className="shrink-0 gap-1 px-2" title="返回" onClick={handleQuit}>
              <ChevronLeft className="size-4" />
              返回
            </Button>
          )}
          <h1 className="truncate text-xl font-semibold text-foreground">
            {title}{questionCount != null ? `（共${questionCount}小题${score != null ? `；共${score}分` : ""}）` : ""}
          </h1>
        </div>

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