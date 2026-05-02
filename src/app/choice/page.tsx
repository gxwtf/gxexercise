"use client"

import { ChoiceQuestion } from "@/components/question/choice"

export default function Page() {
  const options = [
    { id: 'a', label: 'Option AAAAAAAA' },
    { id: 'b', label: 'Option B' },
    { id: 'c', label: 'Option C' },
    { id: 'd', label: 'Option D' },
  ]

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-4">Single Choice (单选)</h1>
        <ChoiceQuestion
          type="single"
          options={options}
          onChange={(selected) => console.log('Single selected:', selected)}
        />
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-4">Multiple Choice (多选)</h1>
        <ChoiceQuestion
          type="multiple"
          options={options}
          onChange={(selected) => console.log('Multiple selected:', selected)}
        />
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-4">Indeterminate Choice (不定项选择)</h1>
        <ChoiceQuestion
          type="indeterminate"
          options={options}
          onChange={(selected) => console.log('Indeterminate selected:', selected)}
        />
      </div>
    </div>
  )
}