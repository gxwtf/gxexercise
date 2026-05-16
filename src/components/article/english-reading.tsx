'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type BlankOption = {
  id: string;
  label: string;
};

export interface BlankContextValue {
  blanks: Record<string, string>;
  options: BlankOption[];
  onBlankClick?: (blankId: string) => void;
  onRemove?: (blankId: string) => void;
  getNextBlankId: () => string;
}

export const BlankContext = React.createContext<BlankContextValue | null>(null);

export interface ClozeContextValue {
  getNextQuestionNumber: () => number;
}

export const ClozeContext = React.createContext<ClozeContextValue | null>(null);

export interface InputChangeContextValue {
  onInputChange?: (questionId: string, value: string) => void;
}

export const InputChangeContext = React.createContext<InputChangeContextValue | null>(null);

export function useBlankContext() {
  return React.useContext(BlankContext);
}

export function useClozeContext() {
  return React.useContext(ClozeContext);
}

export function useInputChangeContext() {
  return React.useContext(InputChangeContext);
}

export interface CustomComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface EnglishReadingProps {
  title?: string;
  children?: React.ReactNode;
  customComponents?: Record<string, React.ComponentType<CustomComponentProps>>;
  className?: string;
  blanks?: Record<string, string>;
  options?: BlankOption[];
  onBlankClick?: (blankId: string) => void;
  onRemove?: (blankId: string) => void;
  onInputChange?: (questionId: string, value: string) => void;
  startQuestionNumber?: number;
}

function replaceBlankTokens(
  node: React.ReactNode,
  getNextBlankId: () => string,
  blanks: Record<string, string>,
  options: BlankOption[],
  onBlankClick?: (blankId: string) => void,
  onRemove?: (blankId: string) => void
): React.ReactNode {
  if (typeof node === 'string') {
    return node
      .split(/(\[■\])/g)
      .flatMap((part, index) => {
        if (part === '[■]') {
          const blankId = getNextBlankId();
          const filledOptionId = blanks[blankId];
          const filledOption = filledOptionId ? options.find((o) => o.id === filledOptionId) : null;

          return (
            <button
              key={`blank-${blankId}-${index}`}
              type="button"
              onClick={() =>
                filledOption ? onRemove?.(blankId) : onBlankClick?.(blankId)
              }
              className={cn(
                'inline-flex items-center rounded px-1.5 py-0.5 text-sm font-medium transition',
                filledOption ? 'text-amber-700' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {filledOption ? `[${filledOption.label}]` : '[■]'}
            </button>
          );
        }

        return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
      });
  }

  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <React.Fragment key={index}>
        {replaceBlankTokens(child, getNextBlankId, blanks, options, onBlankClick, onRemove)}
      </React.Fragment>
    ));
  }

  if (React.isValidElement(node) && node.props) {
    const elementProps = node.props as { children?: React.ReactNode };
    const children = elementProps.children;
    return React.cloneElement(
      node,
      node.props,
      children ? replaceBlankTokens(children, getNextBlankId, blanks, options, onBlankClick, onRemove) : children
    );
  }

  return node;
}

export function EnglishReading({
  title,
  children,
  customComponents = {},
  className,
  blanks = {},
  options = [],
  onBlankClick,
  onRemove,
  onInputChange,
  startQuestionNumber = 1,
}: EnglishReadingProps) {
  const blankIndexRef = React.useRef(0);
  blankIndexRef.current = 0;

  const getNextBlankId = React.useCallback(() => {
    blankIndexRef.current += 1;
    return String(blankIndexRef.current);
  }, []);

  const clozeNumberRef = React.useRef(startQuestionNumber ?? 1);
  clozeNumberRef.current = startQuestionNumber ?? 1;

  const getNextQuestionNumber = React.useCallback(() => {
    const next = clozeNumberRef.current;
    clozeNumberRef.current += 1;
    return next;
  }, []);

  const blankContextValue = React.useMemo(
    () => ({
      blanks,
      options,
      onBlankClick,
      onRemove,
      getNextBlankId,
    }),
    [blanks, options, onBlankClick, onRemove, getNextBlankId]
  );

  const clozeContextValue = React.useMemo(
    () => ({
      getNextQuestionNumber,
    }),
    [getNextQuestionNumber]
  );

  const inputChangeContextValue = React.useMemo(
    () => ({
      onInputChange,
    }),
    [onInputChange]
  );

  const renderedContent = () => {
    if (!children) return null;
    return replaceBlankTokens(
      children,
      getNextBlankId,
      blanks,
      options,
      onBlankClick,
      onRemove
    );
  };

  return (
    <BlankContext.Provider value={blankContextValue}>
      <ClozeContext.Provider value={clozeContextValue}>
        <InputChangeContext.Provider value={inputChangeContextValue}>
          <article
            className={cn('max-w-4xl mx-auto p-6', className)}
            style={{ fontFamily: '"Times New Roman", serif' }}
          >
            {title ? (
              <header className="mb-8">
                <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
                  {title}
                </h1>
              </header>
            ) : null}

            <div className="prose prose-lg max-w-none dark:prose-invert">
              {renderedContent()}
            </div>
          </article>
        </InputChangeContext.Provider>
      </ClozeContext.Provider>
    </BlankContext.Provider>
  );
}

export default EnglishReading;