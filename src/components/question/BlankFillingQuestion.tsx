'use client'

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { useMDXComponents } from '@/mdx-components'

type Option = {
  id: string
  label: string
  labelMdx?: MDXRemoteSerializeResult | null
}

interface BlankFillingQuestionProps {
  availableOptions: Option[]
  selectedOption: string | null
  onOptionSelect: (optionId: string | null) => void
}

export function BlankFillingQuestion({ availableOptions, selectedOption, onOptionSelect }: BlankFillingQuestionProps) {
  const components = useMDXComponents()

  return (
    <div className="space-y-6">
      {/* 待选选项 */}
      <div>
        <RadioGroup value={selectedOption || ''} onValueChange={(value) => onOptionSelect(value || null)}>
          {availableOptions.map(option => (
            <FieldLabel key={option.id}>
              <Field orientation="horizontal" className="!items-center">
                <RadioGroupItem value={option.id} id={option.id} />
                <FieldContent>
                  <FieldTitle className="text-base">
                    {option.labelMdx ? (
                      <span className="text-lg leading-7">
                        {option.id}.{" "}
                        <MDXRemote
                          {...option.labelMdx}
                          // 与阅读选择题一致：mdx 的 <p> 在这里换成 <span>，但要保留同样的字号/行高
                          components={{ ...components, p: (props) => <span className="text-lg leading-7">{props.children}</span> }}
                        />
                      </span>
                    ) : (
                      <span className="text-lg leading-7">{`${option.id}. ${option.label}`}</span>
                    )}
                  </FieldTitle>
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </div>
    </div>
  )
}