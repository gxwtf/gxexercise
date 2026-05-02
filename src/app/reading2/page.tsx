'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { BlankFillingQuestion } from '@/components/question/BlankFillingQuestion'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'

export default function Reading2Page() {
    // 示例文章内容，包含挖空标记
    const sampleContent = `Artificial intelligence (AI) is transforming various industries at an unprecedented pace. [blank1] From healthcare to finance, AI technologies are revolutionizing how we work and live.

One of the most significant developments in AI is machine learning, which allows computers to learn from data without being explicitly programmed. [blank2] This technology powers everything from recommendation systems to autonomous vehicles.

However, the rapid advancement of AI also raises important ethical questions. [blank3] Issues such as data privacy, algorithmic bias, and job displacement need to be carefully considered as we move forward.

Despite these challenges, the potential benefits of AI are enormous. [blank4] In healthcare, AI can help diagnose diseases earlier and more accurately. [blank5] In education, it can provide personalized learning experiences for students.

As we continue to develop and implement AI technologies, it is crucial that we do so responsibly and ethically, ensuring that these powerful tools benefit all of humanity.`

    // 示例选项（七选五）
    const sampleOptions = [
        { id: 'a', label: 'For example,' },
        { id: 'b', label: 'In addition,' },
        { id: 'c', label: 'On the other hand,' },
        { id: 'd', label: 'As a result,' },
        { id: 'e', label: 'Furthermore,' },
        { id: 'f', label: 'However,' },
        { id: 'g', label: 'Therefore,' }
    ]

    const [filledBlanks, setFilledBlanks] = React.useState<Record<string, string>>({})
    const [selectedOption, setSelectedOption] = React.useState<string | null>(null)

    // 计算可用选项
    const availableOptions = sampleOptions.filter(option => !Object.values(filledBlanks).includes(option.id))

    // 处理选项选择
    const handleOptionSelect = (optionId: string | null) => {
        setSelectedOption(optionId)
    }

    // 处理blank点击
    const handleBlankClick = (blankId: string) => {
        const hasSelected = !!selectedOption
        const hasFilled = !!filledBlanks[blankId]

        if (hasFilled && !hasSelected) {
            // 情况1：有填充但没有选中选项 - 移除并设为选中
            const oldOptionId = filledBlanks[blankId]
            setFilledBlanks(prev => {
                const newFilled = { ...prev }
                delete newFilled[blankId]
                return newFilled
            })
            setSelectedOption(oldOptionId)
        } else if (hasFilled && hasSelected) {
            // 情况2：有填充且选中了新选项 - 先移除旧的，再填入新的
            const oldOptionId = filledBlanks[blankId]
            setFilledBlanks(prev => {
                const newFilled = { ...prev }
                delete newFilled[blankId]
                newFilled[blankId] = selectedOption
                return newFilled
            })
            setSelectedOption(oldOptionId) // 将旧的选项设为选中状态
        } else if (!hasFilled && hasSelected) {
            // 情况3：没有填充但有选中选项 - 直接填入
            setFilledBlanks(prev => ({
                ...prev,
                [blankId]: selectedOption
            }))
            setSelectedOption(null)
        }
        // 情况4：既没有填充也没有选中 - 不做任何事
    }

    // 处理移除
    const handleRemove = (blankId: string) => {
        setFilledBlanks(prev => {
            const newFilled = { ...prev }
            delete newFilled[blankId]
            return newFilled
        })
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="flex h-screen">
                {/* 左侧文章区域 */}
                <div className="flex-1 overflow-y-auto p-6">
                    <EnglishReading
                        title="The Future of Artificial Intelligence"
                        content={sampleContent}
                        className="max-w-none"
                        blanks={filledBlanks}
                        options={sampleOptions}
                        onBlankClick={handleBlankClick}
                        onRemove={handleRemove}
                    />
                </div>

                {/* 分隔线 */}
                <Separator orientation="vertical" />

                {/* 右侧题目区域 */}
                <div className="flex-1 p-6 overflow-y-auto">
                    <QuestionSection title="Fill in the Blanks">
                        <BlankFillingQuestion
                            availableOptions={availableOptions}
                            selectedOption={selectedOption}
                            onOptionSelect={handleOptionSelect}
                        />
                    </QuestionSection>
                </div>
            </div>
        </div>
    )
}