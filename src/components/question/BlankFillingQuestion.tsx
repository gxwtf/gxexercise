'use client'

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

interface BlankFillingQuestionProps {
  availableOptions: Option[]
  selectedOption: string | null
  onOptionSelect: (optionId: string | null) => void
}

export function BlankFillingQuestion({ availableOptions, selectedOption, onOptionSelect }: BlankFillingQuestionProps) {
  return (
    <div className="space-y-6">
      {/* 待选选项 */}
      <div>
        <h4 className="font-semibold mb-3">Available Options:</h4>
        <RadioGroup value={selectedOption || ''} onValueChange={(value) => onOptionSelect(value || null)}>
          {availableOptions.map(option => (
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
      </div>
    </div>
  )
}