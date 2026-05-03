"use client"

import { ChoiceQuestion } from "./choice"

type Option = {
  id: string
  label: string
}

type ChoiceType = 'single' | 'multiple' | 'indeterminate'

interface Question {
  id: string
  stem: string
  type: ChoiceType
  options: Option[]
}

interface ChoiceFieldProps {
  questions: Question[]
  onChange: (questionId: string, selected: string[]) => void
}

export function ChoiceField({ questions, onChange }: ChoiceFieldProps) {
  return (
    <div className="space-y-6">
      {questions.map((question, index) => (
        <div key={question.id} className="space-y-4">
          <h3 className="text-lg font-medium">
            {index + 1}. {question.stem}
          </h3>
          <ChoiceQuestion
            type={question.type}
            options={question.options}
            onChange={(selected) => onChange(question.id, selected)}
          />
        </div>
      ))}
    </div>
  )
}