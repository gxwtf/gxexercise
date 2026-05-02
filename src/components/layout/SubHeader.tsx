'use client';

import Link from 'next/link';
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
import { subjects, subjectToRoute, subjectNavItems } from '@/constants/subjects';

export default function SubHeader({
  subject,
}: Readonly<{
  subject: string;
}>) {
  const router = useRouter();
  const currentNavItems = subjectNavItems[subject];

  const leftContent = (
    <div className="flex items-center">
      <Link href="/questions" className="hidden lg:flex items-center">
        <span className="text-xl font-bold text-foreground">广学题库</span>
      </Link>

      <div className="ml-6 min-w-[160px]">
        <Combobox items={subjects} value={subject} onValueChange={(value) => {
          if (value && subjectToRoute[value]) {
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
    </div>
  );

  const mobileMenuContent = (
    <nav className="flex flex-col gap-3">
      {currentNavItems.navButtons.map((item, index) => (
        <Link
          key={index}
          href={item.href}
          className="text-sm font-medium hover:text-primary"
        >
          {item.label}
        </Link>
      ))}
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
