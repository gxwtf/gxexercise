import type { MDXComponents } from 'mdx/types'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { useBlankContext, ClozeContext, useInputChangeContext } from '@/components/article/english-reading'
import { Input as ShadcnInput } from "@/components/ui/input"

// ---- MathInput2 context ----
interface MathInput2ContextType {
  onInputChange?: (index: number, value: string) => void
  getNextIndex: () => number
  disabled?: boolean
}

const MathInput2Context = React.createContext<MathInput2ContextType | undefined>(undefined)

export function useMathInput2Context() {
  return React.useContext(MathInput2Context)
}

export function MathInput2Provider({ children, onInputChange, disabled = false }: { children: React.ReactNode; onInputChange?: (index: number, value: string) => void; disabled?: boolean }) {
  const indexRef = React.useRef(0)
  const getNextIndex = React.useCallback(() => {
    const idx = indexRef.current
    indexRef.current++
    return idx
  }, [])

  return (
    <MathInput2Context.Provider value={{ onInputChange, getNextIndex, disabled }}>
      {children}
    </MathInput2Context.Provider>
  )
}

// Input2 - 无序号短输入框，用于数学填空
function Input2(props: React.HTMLAttributes<HTMLSpanElement>) {
  const ctx = React.useContext(MathInput2Context)
  const indexRef = React.useRef<number | undefined>(undefined)
  const isDisabled = ctx?.disabled ?? false

  if (indexRef.current === undefined) {
    if (ctx) {
      indexRef.current = ctx.getNextIndex()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (ctx && indexRef.current !== undefined && ctx.onInputChange) {
      ctx.onInputChange(indexRef.current, e.target.value)
    }
  }

  return (
    <span className="inline-flex items-center h-8 align-baseline !text-indent-0" {...props}>
      <ShadcnInput
        type="text"
        className="w-32 h-8 text-base inline-block"
        disabled={isDisabled}
        onChange={handleChange}
      />
    </span>
  )
}

Input2.displayName = 'Input2'

function Blank({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
    const context = useBlankContext()

    if (!context) {
        return <span {...props}>{children}</span>
    }

    const { blanks, options, onBlankClick, onRemove, getNextBlankId, reviewMode, correctBlanks } = context

    const blankIdRef = React.useRef<string | null>(null)
    if (blankIdRef.current === null) {
        blankIdRef.current = getNextBlankId()
    }
    const blankId = blankIdRef.current

    const filledOptionId = blanks[blankId]
    const filledOption = filledOptionId ? options.find(o => o.id === filledOptionId) : null

    if (reviewMode) {
      if (filledOption) {
        const isCorrect = correctBlanks && filledOptionId === correctBlanks[blankId]
        return (
          <span
            className={cn(
              'inline rounded px-1 py-0.5 text-lg font-normal',
              'align-baseline leading-normal',
              isCorrect
                ? 'text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300 font-medium'
                : 'text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-300 font-medium'
            )}
            {...props}
          >
            [{filledOption.id}. {filledOption.label}]
          </span>
        )
      }
      return (
        <span
          className={cn(
            'inline rounded px-1 py-0.5 text-lg font-normal',
            'align-baseline leading-normal',
            'text-slate-600'
          )}
          {...props}
        >
          [■]
        </span>
      )
    }

    return (
        <span
            onClick={() => filledOption ? onRemove?.(blankId) : onBlankClick?.(blankId)}
            className={cn(
                'inline rounded px-1 py-0.5 text-lg font-normal transition cursor-pointer',
                'align-baseline leading-normal',
                filledOption ? 'text-[#A31F24] font-medium' : 'text-black'
            )}
            {...props}
        >
            {filledOption ? `[${filledOption.id}. ${filledOption.label}]` : '[■]'}
        </span>
    )
}

function ClozeBlank({
    questionNumber,
    ...props
}: React.HTMLAttributes<HTMLSpanElement> & { questionNumber?: number }) {
    const context = React.useContext(ClozeContext);
    const questionNumberRef = React.useRef<number | undefined>(questionNumber);

    if (questionNumberRef.current === undefined) {
        if (!context) {
            return <span {...props}>____?____</span>;
        }
        questionNumberRef.current = context.getNextQuestionNumber();
    }

    return (
        <span {...props}>
            ____{questionNumberRef.current}____
        </span>
    )
}

ClozeBlank.displayName = 'ClozeBlank'

// Input填空题组件 - 使用InputChangeContext来保存答案
function Input({
    onChange,
    ...props
}: React.HTMLAttributes<HTMLSpanElement> & { onChange?: (value: string) => void }) {
    const clozeContext = React.useContext(ClozeContext);
    const inputChangeContext = useInputChangeContext();
    const questionNumberRef = React.useRef<number | undefined>(undefined);
    const isReviewMode = clozeContext?.reviewMode ?? false;

    if (questionNumberRef.current === undefined) {
        if (!clozeContext) {
            return (
                <span className="inline-flex items-center h-8" style={{textIndent: 0}} {...props}>
                    <span className="text-base font-medium text-gray-700 px-2 py-1 border border-input rounded-l-lg border-r-0 bg-transparent cursor-default h-full flex items-center" style={{textIndent: 0}}>?</span>
                    <ShadcnInput
                        type="text"
                        className="w-30 rounded-l-none h-8 text-base"
                        disabled={isReviewMode}
                        onChange={(e) => onChange?.(e.target.value)}
                    />
                </span>
            );
        }
        questionNumberRef.current = clozeContext.getNextQuestionNumber();
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(e.target.value);
        // 通过 InputChangeContext 传递答案到父组件
        if (inputChangeContext?.onInputChange && questionNumberRef.current) {
            inputChangeContext.onInputChange(String(questionNumberRef.current), e.target.value);
        }
    };

    return (
        <span className="inline-flex items-center h-7" style={{textIndent: 0}} {...props}>
            <span className="text-base font-medium text-gray-700 px-2 py-1 border border-input rounded-l-lg border-r-0 bg-transparent cursor-default h-full flex items-center" style={{textIndent: 0}}>
                {questionNumberRef.current}
            </span>
            <ShadcnInput
                type="text"
                className="w-30 rounded-l-none h-7 text-base"
                disabled={isReviewMode}
                onChange={handleChange}
            />
        </span>
    )
}

Input.displayName = 'Input'

const Typography = {
    H1: React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
        ({ className, ...props }, ref) => (
            <h1
                ref={ref}
                className={cn(
                    'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mt-12 mb-6 text-center',
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
                    'scroll-m-20 text-3xl font-semibold tracking-tight transition-colors mt-10 mb-4 text-center',
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
                className={cn('scroll-m-20 text-2xl font-semibold tracking-tight mt-8 mb-4 text-center', className)}
                {...props}
            />
        )
    ),

    H4: React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
        ({ className, ...props }, ref) => (
            <h4
                ref={ref}
                className={cn('scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3 text-center', className)}
                {...props}
            />
        )
    ),

    P: React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
        ({ className, ...props }, ref) => (
            <p
                ref={ref}
                className={cn('text-lg leading-7 [&:not(:first-child)]:mt-4', className)}
                {...props}
            />
        )
    ),

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
            <li ref={ref} className={cn('text-lg mt-2', className)} {...props} />
        )
    ),

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

// RightAlign - 右对齐文本，用于"（取材于...）"这类内容
function RightAlign({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('text-right text-base text-muted-foreground my-2', className)}
            {...props}
        >
            {children}
        </div>
    )
}

RightAlign.displayName = 'RightAlign';

const components: MDXComponents = {
    ...Typography,
    p: Typography.P,
    h1: Typography.H1,
    h2: Typography.H2,
    h3: Typography.H3,
    h4: Typography.H4,
    blockquote: Typography.Blockquote,
    ul: Typography.UL,
    ol: Typography.OL,
    li: Typography.LI,
    code: Typography.InlineCode,
    Blank,
    ClozeBlank,
    Input,
    Input2,
    RightAlign,
}

export function useMDXComponents(): MDXComponents {
    return components
}