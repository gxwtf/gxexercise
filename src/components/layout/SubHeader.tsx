'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { withCurrentFilters } from '@/lib/keep-filters';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import BaseHeader from '@/components/layout/BaseHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { subjects, subjectToRoute, subjectNavItems, categoryToRoute } from '@/constants/subjects';

export default function SubHeader({
  subject,
}: Readonly<{
  subject: string;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  // 学科 slug 认不出来时（比如手输 /questions/英语）不能直接崩：导航按钮为空即可
  const currentNavItems = subjectNavItems[subject];
  const navButtons = currentNavItems?.navButtons ?? [];

  // 换学科 / 换题型时把「当前地址栏里的筛选」带过去（点清除之后地址栏干净，也就没有记忆了）
  const go = (href: string) => router.push(withCurrentFilters(href));
  
  // 获取当前选中的题型
  const getCurrentCategory = () => {
    if (!navButtons.length) return null;
    
    // 如果是学科首页，默认选中第一个题型
    if (pathname === `/questions/${subjectToRoute[subject]}`) {
      return navButtons[0].label;
    }
    
    // 从当前路径中提取题型
    for (const item of navButtons) {
      const categoryRoute = categoryToRoute[subject]?.[item.label];
      if (categoryRoute && pathname.includes(categoryRoute)) {
        return item.label;
      }
    }
    
    return null;
  };
  
  const currentCategory = getCurrentCategory();

  const leftContent = (
    <div className="flex items-center">
      <Link href="/" className="hidden shrink-0 items-center whitespace-nowrap lg:flex">
        <span className="whitespace-nowrap text-xl font-bold text-foreground">广学题库</span>
      </Link>

      {/* 学科选择：shadcn Select，只能手动选择 */}
      <div className="ml-4 shrink-0">
        <Select
          value={subject}
          onValueChange={(value) => {
            if (value && subjectToRoute[value]) {
              go(`/questions/${subjectToRoute[value]}`)
            }
          }}
        >
          <SelectTrigger size="sm" className="w-[104px]" aria-label="选择学科">
            <SelectValue placeholder="选择学科" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <nav className="ml-4 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap lg:flex">
        {navButtons.map((item, index) => {
          const isActive = item.label === currentCategory;
          return (
            <Button
              key={index}
              asChild
              variant="ghost"
              size="sm"
              className={`h-8 shrink-0 px-3 text-sm relative ${
                isActive 
                  ? 'text-brand font-medium' 
                  : 'text-foreground'
              }`}
            >
              <Link
                href={item.href}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  go(item.href);
                }}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand" />
                )}
              </Link>
            </Button>
          );
        })}
      </nav>
    </div>
  );

  const mobileMenuContent = (
    <nav className="flex flex-col gap-3">
      {navButtons.map((item, index) => {
        const isActive = item.label === currentCategory;
        return (
          <Link
            key={index}
            href={item.href}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              go(item.href);
            }}
            className={`text-sm font-medium ${
              isActive
                ? 'text-brand font-semibold underline underline-offset-4'
                : 'hover:text-primary'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
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