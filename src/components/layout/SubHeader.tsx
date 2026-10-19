'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const currentNavItems = subjectNavItems[subject];
  
  // 获取当前选中的题型
  const getCurrentCategory = () => {
    if (!currentNavItems?.navButtons?.length) return null;
    
    // 如果是学科首页，默认选中第一个题型
    if (pathname === `/questions/${subjectToRoute[subject]}`) {
      return currentNavItems.navButtons[0].label;
    }
    
    // 从当前路径中提取题型
    for (const item of currentNavItems.navButtons) {
      const categoryRoute = categoryToRoute[subject]?.[item.label];
      if (pathname.includes(categoryRoute)) {
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
              router.push(`/questions/${subjectToRoute[value]}`)
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
        {currentNavItems.navButtons.map((item, index) => {
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
              <Link href={item.href}>
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
      {currentNavItems.navButtons.map((item, index) => {
        const isActive = item.label === currentCategory;
        return (
          <Link
            key={index}
            href={item.href}
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