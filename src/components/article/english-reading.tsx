'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// 排版组件定义
const Typography = {
  // 标题组件
  H1: React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
      <h1
        ref={ref}
        className={cn(
          'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
          className
        )}
        {...props}
      />
    )
  ),

  H2: React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
      <h2
        ref={ref}
        className={cn(
          'scroll-m-20 text-3xl font-semibold tracking-tight transition-colors first:mt-0',
          className
        )}
        {...props}
      />
    )
  ),

  H3: React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
      <h3
        ref={ref}
        className={cn(
          'scroll-m-20 text-2xl font-semibold tracking-tight',
          className
        )}
        {...props}
      />
    )
  ),

  H4: React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
      <h4
        ref={ref}
        className={cn(
          'scroll-m-20 text-xl font-semibold tracking-tight',
          className
        )}
        {...props}
      />
    )
  ),

  // 段落组件
  P: React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
      <p
        ref={ref}
        className={cn('leading-7 [&:not(:first-child)]:mt-6', className)}
        {...props}
      />
    )
  ),

  // 引用组件
  Blockquote: React.forwardRef<HTMLQuoteElement, React.HTMLAttributes<HTMLQuoteElement>>(
    ({ className, ...props }, ref) => (
      <blockquote
        ref={ref}
        className={cn(
          'mt-6 border-l-2 border-muted-foreground/20 pl-6 italic text-muted-foreground',
          className
        )}
        {...props}
      />
    )
  ),

  // 列表组件
  UL: React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
    ({ className, ...props }, ref) => (
      <ul
        ref={ref}
        className={cn('my-6 ml-6 list-disc [&>li]:mt-2', className)}
        {...props}
      />
    )
  ),

  OL: React.forwardRef<HTMLOListElement, React.HTMLAttributes<HTMLOListElement>>(
    ({ className, ...props }, ref) => (
      <ol
        ref={ref}
        className={cn('my-6 ml-6 list-decimal [&>li]:mt-2', className)}
        {...props}
      />
    )
  ),

  LI: React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(
    ({ className, ...props }, ref) => (
      <li ref={ref} className={cn('mt-2', className)} {...props} />
    )
  ),

  // 内联文本组件
  InlineCode: React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
    ({ className, ...props }, ref) => (
      <code
        ref={ref}
        className={cn(
          'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm',
          className
        )}
        {...props}
      />
    )
  ),

  Lead: React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
      <p
        ref={ref}
        className={cn('text-xl text-muted-foreground', className)}
        {...props}
      />
    )
  ),

  Large: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn('text-lg font-semibold', className)}
        {...props}
      />
    )
  ),

  Small: React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
    ({ className, ...props }, ref) => (
      <small
        ref={ref}
        className={cn('text-sm font-medium leading-none', className)}
        {...props}
      />
    )
  ),

  Muted: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      />
    )
  ),
};

Typography.H1.displayName = 'H1';
Typography.H2.displayName = 'H2';
Typography.H3.displayName = 'H3';
Typography.H4.displayName = 'H4';
Typography.P.displayName = 'P';
Typography.Blockquote.displayName = 'Blockquote';
Typography.UL.displayName = 'UL';
Typography.OL.displayName = 'OL';
Typography.LI.displayName = 'LI';
Typography.InlineCode.displayName = 'InlineCode';
Typography.Lead.displayName = 'Lead';
Typography.Large.displayName = 'Large';
Typography.Small.displayName = 'Small';
Typography.Muted.displayName = 'Muted';


// 自定义组件接口
export interface CustomComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// 文章阅读组件主接口
export interface EnglishReadingProps {
  title: string;
  content: string | React.ReactNode;
  customComponents?: Record<string, React.ComponentType<CustomComponentProps>>;
  className?: string;
  // 新增：挖空相关
  blanks?: Record<string, string>; // blankId => optionId
  options?: { id: string; label: string }[];
  onBlankClick?: (blankId: string) => void;
  onRemove?: (blankId: string) => void;
}

// 英文文章阅读组件
export function EnglishReading({
  title,
  content,
  customComponents = {},
  className,
  blanks = {},
  options = [],
  onBlankClick,
  onRemove,
}: EnglishReadingProps) {
  // 合并默认排版组件和自定义组件
  const Components = { ...Typography, ...customComponents };

  const renderContent = () => {
    if (typeof content === 'string') {
      return content
        .split(/\r?\n\s*\r?\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph, index) => (
          <Components.P key={index} className="text-justify leading-relaxed">
            {paragraph.split(/(\[blank\d+\])/).map((part, idx) => {
              const blankMatch = part.match(/\[blank(\d+)\]/);
              if (blankMatch) {
                const blankId = blankMatch[1];
                const filledOptionId = blanks[blankId];
                const filledOption = filledOptionId ? options.find(o => o.id === filledOptionId) : null;

                return (
                  <span
                    key={idx}
                    onClick={() => filledOption ? (onRemove && onRemove(blankId)) : (onBlankClick && onBlankClick(blankId))}
                    style={{
                      cursor: 'pointer',
                      color: filledOption ? '#a31f24' : 'inherit',
                      fontWeight: filledOption ? '500' : 'normal',
                    }}
                  >
                    {filledOption ? `[${filledOption.label}]` : '[■]'}
                  </span>
                );
              }
              return <span key={idx}>{part}</span>;
            })}
          </Components.P>
        ));
    }

    const nodes = React.Children.toArray(content);
    if (nodes.length === 0) return null;

    return nodes.map((node, index) => (
      <Components.P key={index} className="text-justify leading-relaxed">
        {node}
      </Components.P>
    ));
  };

  return (
    <article
      className={cn('max-w-4xl mx-auto p-6', className)}
      style={{ fontFamily: '"Times New Roman", serif' }}
    >
      {/* 文章头部信息 */}
      <header className="mb-8">
        <Components.H1 className="mb-4">{title}</Components.H1>
      </header>

      {/* 文章内容 */}
      <div className="prose prose-lg max-w-none dark:prose-invert">
        {renderContent()}
      </div>
    </article>
  );
}

// 导出排版组件供单独使用
export const {
  H1,
  H2,
  H3,
  H4,
  P,
  Blockquote,
  UL,
  OL,
  LI,
  InlineCode,
  Lead,
  Large,
  Small,
  Muted,
} = Typography;

// 默认导出主组件
export default EnglishReading;