'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { withCurrentFilters } from '@/lib/keep-filters';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import BaseHeader from '@/components/layout/BaseHeader';
import { subjects, subjectToRoute } from '@/constants/subjects';
import useSession from '@/lib/use-session';

function SubjectLinks({ mobile }: { mobile: boolean }) {
  const router = useRouter();
  // 换学科时带上「点击这一刻」地址栏里的筛选；清除筛选后自然不再带
  const go = (href: string) => router.push(withCurrentFilters(href));
  const onClick = (href: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    go(href);
  };

  return (
    <>
      {subjects.map((subject) => {
        const href = `/questions/${subjectToRoute[subject]}`;
        return mobile ? (
          <Link key={subject} href={href} onClick={onClick(href)} className="text-sm font-medium hover:text-primary pl-4">
            {subject}
          </Link>
        ) : (
          <DropdownMenuItem key={subject} asChild>
            <Link href={href} onClick={onClick(href)}>
              {subject}
            </Link>
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

export default function Header() {
  const { session } = useSession();

  const leftContent = (
    <div className="flex items-center space-x-8">
      <Link href="/" className="shrink-0 whitespace-nowrap text-xl font-bold">
        广学题库
      </Link>
      <nav className="hidden md:flex items-center space-x-6">
        <Link href="/" className="text-sm font-medium hover:text-primary">
          首页
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto p-0 text-sm font-medium hover:text-primary flex items-center gap-1">
              题库
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <SubjectLinks mobile={false} />
          </DropdownMenuContent>
        </DropdownMenu>
        <Link href="/leaderboard" className="text-sm font-medium hover:text-primary">
          广学榜
        </Link>
        {session.isLoggedIn && session.admin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto p-0 text-sm font-medium hover:text-primary flex items-center gap-1">
                管理
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link href="/admin/submissions">全部作答记录</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="https://account.gxwtf.cn/admin/users">用户管理</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Link href="https://gxwtf.cn/home" className="text-sm font-medium hover:text-primary">
          前往竞赛题库
        </Link>
      </nav>
    </div>
  );

  const mobileMenuContent = (
    <nav className="flex flex-col space-y-4">
      <Link
        href="/"
        className="text-sm font-medium hover:text-primary"
      >
        首页
      </Link>
      <div className="flex flex-col space-y-3">
        <span className="text-sm font-medium text-muted-foreground">题库</span>
        <SubjectLinks mobile />
      </div>
      <Link href="/leaderboard" className="text-sm font-medium hover:text-primary">
        广学榜
      </Link>
      {session.isLoggedIn && session.admin && (
        <>
          <Link
            href="/admin/submissions"
            className="text-sm font-medium hover:text-primary"
          >
            全部作答记录
          </Link>
          <Link
            href="https://account.gxwtf.cn/admin/users"
            className="text-sm font-medium hover:text-primary"
          >
            用户管理
          </Link>
        </>
      )}
      <Link
        href="https://gxwtf.cn/home"
        className="text-sm font-medium hover:text-primary"
      >
        前往竞赛题库
      </Link>
    </nav>
  );

  return (
    <BaseHeader
      mobileMenuContent={mobileMenuContent}
    >
      {leftContent}
    </BaseHeader>
  );
}
