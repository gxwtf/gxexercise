"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"

type Option = {
  id: string
  label: string
}

type ChoiceType = 'single' | 'multiple' | 'indeterminate'

interface ChoiceQuestionProps {
  type: ChoiceType
  options: Option[]
  onChange: (selected: string[]) => void
}

export function ChoiceQuestion({ type, options, onChange }: ChoiceQuestionProps) {
  const [selected, setSelected] = useState<string[]>([])

  const handleMultipleChange = (id: string, checked: boolean) => {
    const newSelected = checked ? [...selected, id] : selected.filter(s => s !== id)
    setSelected(newSelected)
    onChange(newSelected)
  }

  const handleSingleChange = (value: string) => {
    setSelected([value])
    onChange([value])
  }

  if (type === 'single') {
    return (
      <RadioGroup value={selected[0] || ''} onValueChange={handleSingleChange}>
        {options.map(option => (
          <FieldLabel key={option.id}>
            <Field orientation="horizontal">
              <RadioGroupItem value={option.id} id={option.id} />
              <FieldContent>
                <FieldTitle>{option.label}</FieldTitle>
              </FieldContent>
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    )
  }

  return (
    <div className="space-y-4">
      {options.map(option => (
        <FieldLabel key={option.id}>
          <Field orientation="horizontal">
            <Checkbox
              id={option.id}
              checked={selected.includes(option.id)}
              onCheckedChange={(checked) => handleMultipleChange(option.id, checked as boolean)}
            />
            <FieldContent>
              <FieldTitle>{option.label}</FieldTitle>
            </FieldContent>
          </Field>
        </FieldLabel>
      ))}
    </div>
  )
}