'use client';

import Link from 'next/link';
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

export default function Header() {
  const { session } = useSession();

  const leftContent = (
    <div className="flex items-center space-x-8">
      <Link href="/" className="text-xl font-bold">
        广学五题坊
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
            {subjects.map((subject) => (
              <DropdownMenuItem key={subject} asChild>
                <Link href={`/questions/${subjectToRoute[subject]}`}>
                  {subject}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Link href="https://gxwtf.cn/game" className="text-sm font-medium hover:text-primary">
          游戏中心
        </Link>
        {session.isLoggedIn && session.admin && (
          <Link href="https://account.gxwtf.cn/admin/users" className="text-sm font-medium hover:text-primary">
            用户管理
          </Link>
        )}
        <Link href="https://gxwtf.cn/home" className="text-sm font-medium hover:text-primary">
          返回旧版主站
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
        {subjects.map((subject) => (
          <Link
            key={subject}
            href={`/questions/${subjectToRoute[subject]}`}
            className="text-sm font-medium hover:text-primary pl-4"
          >
            {subject}
          </Link>
        ))}
      </div>
      <Link
        href="https://gxwtf.cn/game"
        className="text-sm font-medium hover:text-primary"
      >
        游戏中心
      </Link>
      {session.isLoggedIn && session.admin && (
        <Link
          href="https://account.gxwtf.cn/admin/users"
          className="text-sm font-medium hover:text-primary"
        >
          用户管理
        </Link>
      )}
      <Link
        href="https://gxwtf.cn/home"
        className="text-sm font-medium hover:text-primary"
      >
        返回旧版主站
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
