'use client'

import * as React from 'react'
import type { MDXRemoteSerializeResult } from 'next-mdx-remote'

type Option = {
  id: string
  label: string
  labelMdx?: MDXRemoteSerializeResult | null
}

interface BlankFillingLogicProps {
  options: Option[]
  onStateChange?: (state: {
    filledBlanks: Record<string, string>
    selectedOption: string | null
  }) => void
}

export function useBlankFillingLogic({ options, onStateChange }: BlankFillingLogicProps) {
  const [filledBlanks, setFilledBlanks] = React.useState<Record<string, string>>({})
  const [selectedOption, setSelectedOption] = React.useState<string | null>(null)

  // 计算可用选项
  const availableOptions = options.filter(option => !Object.values(filledBlanks).includes(option.id))

  // 处理选项选择
  const handleOptionSelect = (optionId: string | null) => {
    setSelectedOption(optionId)
  }

  // 处理blank点击
  const handleBlankClick = (blankId: string) => {
    const hasSelected = !!selectedOption
    const hasFilled = !!filledBlanks[blankId]

    if (hasFilled && !hasSelected) {
      console.log('情况1：有填充但没有选中选项 - 移除并设为选中')
      // 情况1：有填充但没有选中选项 - 移除并设为选中
      const oldOptionId = filledBlanks[blankId]
      setFilledBlanks(prev => {
        const newFilled = { ...prev }
        delete newFilled[blankId]
        return newFilled
      })
      setSelectedOption(oldOptionId)
    } else if (hasFilled && hasSelected) {
      console.log('情况2：有填充且有选中 - 先移除旧的，再填入新的')
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
      console.log('情况3：没有填充但有选中选项 - 直接填入')
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

  // 重置所有状态
  const resetAll = () => {
    setFilledBlanks({})
    setSelectedOption(null)
  }

  // 监听状态变化
  React.useEffect(() => {
    onStateChange?.({
      filledBlanks,
      selectedOption
    })
  }, [filledBlanks, selectedOption, onStateChange])

  return {
    // 状态
    filledBlanks,
    selectedOption,
    availableOptions,
    
    // 操作方法
    handleOptionSelect,
    handleBlankClick,
    handleRemove,
    resetAll,
    
    // 设置方法
    setFilledBlanks,
    setSelectedOption
  }
}

// 组件化版本
export function BlankFillingLogic({ options, onStateChange, children }: BlankFillingLogicProps & { children?: React.ReactNode }) {
  const logic = useBlankFillingLogic({ options, onStateChange })
  
  return (
    <div>
      {children && React.Children.map(children, child => 
        React.isValidElement<{ logic?: ReturnType<typeof useBlankFillingLogic> }>(child)
          ? React.cloneElement(child, { logic })
          : child
      )}
    </div>
  )
}
