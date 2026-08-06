import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressCircleProps {
  correct: number
  total: number
  size?: number
  strokeWidth?: number
  className?: string
  fontSize?: string
}

export function ProgressCircle({
  correct,  
  total,
  size = 48,
  strokeWidth = 6,
  className,
  fontSize,
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  
  // 计算进度
  const progress = total > 0 ? correct / total : 0
  const strokeDasharray = `${circumference} ${circumference}`
  const strokeDashoffset = circumference - progress * circumference

  // 判断是否有答题记录
  const hasAttempt = total > 0

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
          className={hasAttempt ? "text-red-400" : "text-gray-200"}
        />
        
        {/* 进度圆环 - 只有有答题记录时才显示绿色进度 */}
        {hasAttempt && (
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
            className="text-green-500"
            style={{
              transition: 'stroke-dashoffset 0.3s ease'
            }}
          />
        )}
      </svg>
      
      {/* 中间文字 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn(
          fontSize || "text-[10px]",
          "font-medium",
          hasAttempt ? "text-gray-700" : "text-gray-400"
        )}>
          {correct}/{total}
        </span>
      </div>
    </div>
  )
}