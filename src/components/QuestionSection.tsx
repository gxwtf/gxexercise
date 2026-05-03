'use client'

import * as React from 'react'

interface QuestionSectionProps {
  title?: string
  children: React.ReactNode
  className?: string
}

export function QuestionSection({ title, children, className }: QuestionSectionProps) {
  return (
    <section
      className={`space-y-4 ${className ?? ''}`.trim()}
      style={{ fontFamily: '"Times New Roman", serif' }}
    >
      {title ? (
        <header>
          <h3 className="text-lg font-medium">{title}</h3>
        </header>
      ) : null}
      {children}
    </section>
  )
}
