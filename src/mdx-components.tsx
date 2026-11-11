import type { MDXComponents } from 'mdx/types'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { useBlankContext, ClozeContext, useInputChangeContext } from '@/components/article/english-reading'
import { Input as ShadcnInput } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// ---- Input default values context (for restoring input values on navigation) ----
export const InputDefaultValuesContext = React.createContext<Record<string, string>>({})

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
  const defaultValues = React.useContext(InputDefaultValuesContext)
  const indexRef = React.useRef<number | undefined>(undefined)
  const isDisabled = ctx?.disabled ?? false

  if (indexRef.current === undefined) {
    if (ctx) {
      indexRef.current = ctx.getNextIndex()
    }
  }

  const defaultValue = indexRef.current != null ? defaultValues[String(indexRef.current)] : undefined

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
        defaultValue={defaultValue}
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

    const { blanks, options, onBlankClick, onRemove, getNextBlankId, getNextBlankQuestionNum, reviewMode, correctBlanks, blankCorrectness } = context

    const blankIdRef = React.useRef<string | null>(null)
    if (blankIdRef.current === null) {
        blankIdRef.current = getNextBlankId()
    }
    const blankId = blankIdRef.current

    const filledOptionId = blanks[blankId]
    const filledOption = filledOptionId
      ? options.find((o) => String(o.id).toLowerCase() === String(filledOptionId).toLowerCase())
      : null

    const questionNumRef = React.useRef<number | null>(null)
    if (getNextBlankQuestionNum && questionNumRef.current === null) {
      questionNumRef.current = getNextBlankQuestionNum()
    }

    if (reviewMode) {
      if (filledOption) {
        // 优先用阅卷结果；否则按答案字符串（忽略大小写）比较
        const graded = blankCorrectness?.[blankId]
        const answerNorm = String(correctBlanks?.[blankId] ?? '').trim().toLowerCase()
        const filledNorm = String(filledOptionId ?? '').trim().toLowerCase()
        const isCorrect = typeof graded === 'boolean' ? graded : !!answerNorm && filledNorm === answerNorm
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
            {questionNumRef.current != null && <span className="mr-0.5">{questionNumRef.current}.</span>}[{filledOption.id}. {filledOption.label}]
          </span>
        )
      }
      return (
        <span
          className={cn(
            'inline rounded px-1 py-0.5 text-lg font-normal',
            'align-baseline leading-normal',
            'text-muted-foreground'
          )}
          {...props}
        >
          {questionNumRef.current != null && `${questionNumRef.current}`}[■]
        </span>
      )
    }

    return (
        <span
            onClick={() => filledOption ? onRemove?.(blankId) : onBlankClick?.(blankId)}
            className={cn(
                'inline rounded px-1 py-0.5 text-lg font-normal transition cursor-pointer',
                'align-baseline leading-normal',
                filledOption ? 'text-brand font-medium' : 'text-foreground'
            )}
            {...props}
        >
            {questionNumRef.current != null && <span className="mr-0.5">{questionNumRef.current}.</span>}{filledOption ? `[${filledOption.id}. ${filledOption.label}]` : '[■]'}
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
    const defaultValues = React.useContext(InputDefaultValuesContext);
    const questionNumberRef = React.useRef<number | undefined>(undefined);
    const isReviewMode = clozeContext?.reviewMode ?? false;

    if (questionNumberRef.current === undefined) {
        if (!clozeContext) {
            return (
                <span className="inline-flex items-center h-8" style={{textIndent: 0}} {...props}>
                    <span className="text-base font-medium text-foreground px-2 py-1 border border-input rounded-l-lg border-r-0 bg-transparent cursor-default h-full flex items-center" style={{textIndent: 0}}>?</span>
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

    const defaultValue = questionNumberRef.current != null ? defaultValues[String(questionNumberRef.current)] : undefined

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(e.target.value);
        // 通过 InputChangeContext 传递答案到父组件
        if (inputChangeContext?.onInputChange && questionNumberRef.current) {
            inputChangeContext.onInputChange(String(questionNumberRef.current), e.target.value);
        }
    };

    return (
        <span className="inline-flex items-center h-7" style={{textIndent: 0}} {...props}>
            <span className="text-base font-medium text-foreground px-2 py-1 border border-input rounded-l-lg border-r-0 bg-transparent cursor-default h-full flex items-center" style={{textIndent: 0}}>
                {questionNumberRef.current}
            </span>
            <ShadcnInput
                type="text"
                className="w-30 rounded-l-none h-7 text-base"
                disabled={isReviewMode}
                defaultValue={defaultValue}
                onChange={handleChange}
            />
        </span>
    )
}

Input.displayName = 'Input'

/**
 * 长答框的起步高度：rows 由分值换算（≤4 分 → 2 行、5–9 分 → 4 行、≥10 分 → 6 行）。
 *
 * 为什么要内联 minHeight：Textarea 自带 `field-sizing-content`（field-sizing: content），
 * 空内容时高度只由 `min-h-16`（64px）决定，`rows` 属性对**视觉高度完全无效**——
 * 实测 rows=2/4/6 三个空框一样高。给一个和 rows 成正比的 min-height 起步高度，
 * 既让长答框按分值变高，又保留 field-sizing: content 的「越写越高」。
 * rows=2（生物默认）→ 66px，与原来的 min-h-16(64px) 基本一致，老题组视觉不变。
 */
function inputLongMinHeight(rows: number | string | undefined): string {
    const n = Math.max(Number(rows) || 2, 2)
    // text-base 行高 24px + 上下 padding 8+8 + 边框 2 ≈ 每行 24px
    return `${n * 24 + 18}px`
}

/**
 * 长答框的公共实现（`InputLong` 与三科大题的 `AnswerBox` 共用）：
 * 一个整宽的多行文本框，编号走同一套 ClozeContext 计数（只用于回填/索引，不渲染），
 * 回顾/只读态沿用同一个 InputChangeContext 回填逻辑。
 *
 * `heightByRows`：InputLong 按 rows 折算起步高度（生物题组的老行为）；
 * AnswerBox 不按 rows，直接用「阅读表达」那款固定起步高度（7rem ≈ 112px，够写 4–12 分）。
 * 两者都保留 Textarea 的 `field-sizing: content`，所以越写越高。
 *
 * 2026-11 起**不再显示左侧数字徽章**（用户要求）：题面本身已有「（1）（2）…」编号，
 * 徽章与之重复且会把句子/版面切碎。计数仍然照常递增（`getNextQuestionNumber()`），
 * 因为作答回填、回顾索引、`<Input>` 短空的编号都依赖它，只是不再渲染出来。
 */
function LongAnswerField({
    rows = 2,
    placeholder = "请作答",
    minHeightClass = "min-h-16",
    heightByRows = true,
    ...props
}: {
    rows?: number
    placeholder?: string
    minHeightClass?: string
    heightByRows?: boolean
} & React.HTMLAttributes<HTMLSpanElement>) {
    const clozeContext = React.useContext(ClozeContext);
    const inputChangeContext = useInputChangeContext();
    const defaultValues = React.useContext(InputDefaultValuesContext);
    const questionNumberRef = React.useRef<number | undefined>(undefined);
    const isReviewMode = clozeContext?.reviewMode ?? false;
    const heightStyle: React.CSSProperties = heightByRows
        ? { minHeight: inputLongMinHeight(rows) }
        : { minHeight: "7rem" };

    if (questionNumberRef.current === undefined) {
        if (!clozeContext) {
            return (
                <span className="my-2 block" style={{ textIndent: 0 }} {...props}>
                    <Textarea rows={rows} className={minHeightClass} style={heightStyle} />
                </span>
            );
        }
        questionNumberRef.current = clozeContext.getNextQuestionNumber();
    }

    const defaultValue = questionNumberRef.current != null ? defaultValues[String(questionNumberRef.current)] : undefined;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (inputChangeContext?.onInputChange && questionNumberRef.current) {
            inputChangeContext.onInputChange(String(questionNumberRef.current), e.target.value);
        }
    };

    return (
        <span className="my-2 block" style={{ textIndent: 0 }} {...props}>
            <Textarea
                rows={rows}
                className={cn(minHeightClass, "w-full text-base")}
                style={heightStyle}
                disabled={isReviewMode}
                defaultValue={defaultValue}
                placeholder={isReviewMode ? undefined : placeholder}
                onChange={handleChange}
            />
        </span>
    );
}

/** InputLong —— 长填空（生物大题里的长句表达）：独占一行的多行文本框，编号与 Input 共用同一套计数 */
function InputLong({ rows = 2, ...props }: { rows?: number } & React.HTMLAttributes<HTMLSpanElement>) {
    // 默认值（rows=2 / min-h-16 / placeholder「请作答」）不要动：生物题组的视觉必须与改动前一致
    return <LongAnswerField rows={rows} placeholder="请作答" minHeightClass="min-h-16" heightByRows {...props} />;
}

InputLong.displayName = 'InputLong'

/**
 * AnswerBox —— 历史 / 地理 / 政治大题的答题框：外观对齐英语「阅读表达」那一款
 * （高一些的起步高度 min-h-28 ≈ 112px、placeholder「请在此作答...」、可随内容增高），
 * 其余（编号顺序、作答回填、回顾只读态）与 InputLong 完全一致；两者都不再显示数字徽章。
 */
function AnswerBox(props: React.HTMLAttributes<HTMLSpanElement>) {
    return <LongAnswerField placeholder="请在此作答..." minHeightClass="min-h-28" heightByRows={false} {...props} />;
}

AnswerBox.displayName = 'AnswerBox'

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

// Center - 居中组件，用于诗词等需要居中展示的内容
function Center({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('text-lg leading-7 text-center [&>p]:!indent-0', className)}
            {...props}
        >
            {children}
        </div>
    )
}

Center.displayName = 'Center';

// Superscript - 上角标组件，用于语文题文中的注释标记
function Superscript({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            className={cn(
                'inline align-[0.25em] text-[0.62em] font-normal text-muted-foreground ml-0.5',
                className
            )}
            {...props}
        >
            {children}
        </span>
    )
}

Superscript.displayName = 'Superscript';

// Dot - 语文「加点字」：渲染着重号（点在下），字本身不变
function Dot({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
    return (
        <span className={cn('dot-em', className)} {...props}>
            {children}
        </span>
    )
}
Dot.displayName = 'Dot';

// U - 语文「下划线」：卷面原文的下划线（与 <Dot> 可叠加）
function U({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
    return (
        <u className={cn('underline underline-offset-[3px] decoration-[1.5px]', className)} {...props}>
            {children}
        </u>
    )
}
U.displayName = 'U';

/** 单元格里是否是「几个字的短文本」（纯字符串/数字，不含标签、公式、图片） */
function isShortText(children: React.ReactNode, limit = 8): boolean {
    const parts = Array.isArray(children) ? children : [children]
    let text = ''
    for (const part of parts) {
        if (typeof part === 'string' || typeof part === 'number') text += String(part)
        else return false // 有 <strong>/<br>/公式等结构化内容，一律当长表头处理
    }
    text = text.trim()
    return text.length > 0 && text.length <= limit
}

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
    sup: ({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) => (
        <sup className={cn('inline align-[0.25em] text-[0.7em] font-normal text-muted-foreground ml-0.5 leading-none', className)} {...props}>
            {children}
        </sup>
    ),
    // markdown 表格（政治的「完成下表」、生物实验数据表等）：走语义 token，浅深色都可读
    // 宽度锁在内容区宽度（w-full），单元格里的长文本到边界就换行——
    // 不能像以前那样 w-max 让表格按内容无限撑开：政史地那种「故事一…」几百字的长段落
    // 会变成一条几屏宽的长横线，学生只能看到第一列，得横向拖着看。
    // 只有「怎么都塞不进」的情况（列特别多、或者单元格里有不可断开的超长串）才由外层
    // overflow-x-auto 兜底横向滚动，原来的宽数据表行为不变。
    table: ({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
        <div className="my-4 w-full max-w-full overflow-x-auto [contain:inline-size]">
            <table className={cn("w-full max-w-full table-auto border-collapse text-base", className)} {...props} />
        </div>
    ),
    thead: ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
        <thead className={cn("bg-muted/60", className)} {...props} />
    ),
    th: ({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
        // 表头通常只有几个字：短表头不折行（否则窄列会「一个字一行」地竖排下来，
        // 像「经济学依据」挤成 5 行）；长表头照常换行，不会把表撑宽。
        <th
            className={cn(
                "border border-border px-3 py-1.5 text-left font-semibold text-foreground break-words",
                isShortText(children) && "whitespace-nowrap",
                className
            )}
            {...props}
        >
            {children}
        </th>
    ),
    td: ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
        <td className={cn("border border-border px-3 py-1.5 align-top text-foreground break-words", className)} {...props} />
    ),
    img: "img",
    QImg,
    Blank,
    ClozeBlank,
    Input,
    InputLong,
    AnswerBox,
    Input2,
    RightAlign,
    Center,
    Superscript,
    Dot,
    U,
    u: U,
}

/** 图片版题目：按原始像素与 300dpi 的固定比例显示（96/300），保证不同宽度题目字号一致 */
function QImg({ src, px, alt }: { src: string; px?: string | number; alt?: string }) {
  // 按固定比例换算（300dpi 原图 → 与题干文字同字号），保证各题文字大小一致
  const w = px ? Math.round(Number(px) * 0.41) : undefined
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt || ""} className="qimage-shot" style={w ? { width: `${w}px`, maxWidth: "100%" } : undefined} />
  )
}

export function useMDXComponents(): MDXComponents {
    return components
}