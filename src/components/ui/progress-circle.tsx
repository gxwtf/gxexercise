import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressCircleProps {
  correct: number
  total: number
  size?: number
  strokeWidth?: number
  className?: string
}

export function ProgressCircle({
  correct,
  total,
  size = 48,
  strokeWidth = 6,
  className
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  
  // 计算进度
  const progress = total > 0 ? correct / total : 0
  const strokeDasharray = `${circumference} ${circumference}`
  const strokeDashoffset = circumference - progress * circumference
  
  // 确定颜色
  const getColor = () => {
    if (total === 0) return "text-gray-400"
    if (progress === 0) return "text-red-500"
    if (progress === 1) return "text-green-500"
    return "text-blue-500"
  }

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* 背景圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 opacity-50"
        />
        {/* 进度圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={getColor()}
          style={{
            transition: 'stroke-dashoffset 0.3s ease'
          }}
        />
      </svg>
      
      {/* 中间文字 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-medium text-gray-700">
          {correct}/{total}
        </span>
      </div>
    </div>
  )
}