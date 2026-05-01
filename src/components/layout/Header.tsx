'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';

const subjects = ['数学', '语文', '英语', '物理', '化学'];

// 定义每个学科的动态导航按钮
const subjectNavItems: Record<string, { 
  navButtons: { label: string; href: string }[];
}> = {
  数学: {
    navButtons: [
      { label: '代数', href: '/math/algebra' },
      { label: '几何', href: '/math/geometry' },
      { label: '函数', href: '/math/function' },
      { label: '概率统计', href: '/math/probability' },
      { label: '微积分', href: '/math/calculus' },
    ],
  },
  语文: {
    navButtons: [
      { label: '诗词鉴赏', href: '/chinese/poetry' },
      { label: '阅读理解', href: '/chinese/reading' },
      { label: '作文素材', href: '/chinese/writing' },
      { label: '文言文', href: '/chinese/classical' },
      { label: '现代文', href: '/chinese/modern' },
    ],
  },
  英语: {
    navButtons: [
      { label: '完形填空', href: '/english/cloze' },
      { label: '语法填空', href: '/english/grammar' },
      { label: '阅读', href: '/english/reading' },
      { label: '七选五', href: '/english/seven-choose-five' },
      { label: '阅读表达', href: '/english/reading-expression' },
      { label: '作文', href: '/english/writing' },
    ],
  },
  物理: {
    navButtons: [
      { label: '力学', href: '/physics/mechanics' },
      { label: '电磁学', href: '/physics/electromagnetism' },
      { label: '热学', href: '/physics/thermodynamics' },
      { label: '光学', href: '/physics/optics' },
      { label: '实验题', href: '/physics/experiment' },
    ],
  },
  化学: {
    navButtons: [
      { label: '化学方程式', href: '/chemistry/equations' },
      { label: '有机化学', href: '/chemistry/organic' },
      { label: '无机化学', href: '/chemistry/inorganic' },
      { label: '实验操作', href: '/chemistry/experiment' },
      { label: '元素周期', href: '/chemistry/periodic' },
    ],
  },
};

export default function Header() {
  const currentUser = {
    name: 'Demo User',
    role: 'admin',
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subject, setSubject] = useState('英语'); // 默认英语

  const currentNavItems = subjectNavItems[subject];

  return (
    <header className="sticky top-0 z-50 w-full bg-background">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center">
          {/* 移动端菜单按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="flex lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* Logo */}
          <Link href="/" className="hidden lg:flex items-center">
            <span className="text-xl font-bold text-foreground">广学题库</span>
          </Link>

          {/* 学科选择器 */}
          <div className="ml-6 min-w-[160px]">
            <Combobox items={subjects} value={subject} onValueChange={(value) => value && setSubject(value)}>
              <ComboboxInput placeholder="选择学科" />
              <ComboboxContent>
                <ComboboxEmpty>暂无匹配学科。</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          {/* 动态导航按钮 */}
          <nav className="ml-6 hidden flex-1 items-center gap-2 lg:flex">
            {currentNavItems.navButtons.map((item, index) => (
              <Button
                key={index}
                asChild
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-sm"
              >
                <Link href={item.href}>
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>

          {/* 右侧功能区域 */}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {currentUser.name} ({currentUser.role})
            </span>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-4 w-4" />
                  <span className="sr-only">用户菜单</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link href="/dashboard/1">个人信息</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/settings">设置</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 移动端菜单 */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t pt-4 pb-4">
            <nav className="flex flex-col gap-3">
              {currentNavItems.navButtons.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className="text-sm font-medium hover:text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}