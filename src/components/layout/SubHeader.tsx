'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { useRouter } from 'next/navigation';
import BaseHeader from '@/components/layout/BaseHeader';
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
      const categoryRoute = categoryToRoute[item.label];
      if (pathname.includes(categoryRoute)) {
        return item.label;
      }
    }
    
    return null;
  };
  
  const currentCategory = getCurrentCategory();

  const leftContent = (
    <div className="flex items-center">
      <Link href="/" className="hidden lg:flex items-center">
        <span className="text-xl font-bold text-foreground">广学题库</span>
      </Link>

      <div className="ml-6 min-w-[160px]">
        <Combobox items={subjects} value={subject} onValueChange={(value) => {
          if (value && subjectToRoute[value]) {
            // 跳转到学科首页，默认显示第一个题型
            router.push(`/questions/${subjectToRoute[value]}`);
          }
        }}>
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

      <nav className="ml-6 hidden flex-1 items-center gap-2 lg:flex">
        {currentNavItems.navButtons.map((item, index) => {
          const isActive = item.label === currentCategory;
          return (
            <Button
              key={index}
              asChild
              variant="ghost"
              size="sm"
              className={`h-8 px-3 text-sm relative ${
                isActive 
                  ? 'text-[#A31F24] font-medium' 
                  : 'text-foreground'
              }`}
            >
              <Link href={item.href}>
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#A31F24]" />
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
                ? 'text-[#A31F24] font-semibold underline underline-offset-4' 
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