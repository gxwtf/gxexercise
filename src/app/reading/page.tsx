'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { ChoiceField } from '@/components/question/ChoiceField'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'

export default function ReadingPage() {
  // 示例文章内容
  const sampleContent = [
    'A pair of papers, published in the scientific journal Nature, touts (标榜) the potential of new AI weather forecasting approaches — systems that could produce faster and more accurate results than traditional models. They are part of a new wave of AI models sweeping the meteorology (气象学) community worldwide.',
    'Conventional forecasts rely on a system known as numerical weather prediction. It’s a kind of mathematical model that uses complex equations (方程式) to predict the way weather systems change over time and space. These equations describe the actual physics behind the movement of air and water in the atmosphere and the oceans. Because there’s so much math and physics involved, numerical weather models require extremely high levels of computational power. That makes them expensive and time-consuming to run. It also limits the fine-scale processes that these models can accurately capture.',
    'Scientists have come up with various ways to get around these difficulties in traditional models. One strategy is a method known as parameterization — that’s when scientists replace the actual physical equations in a model with a simplified program that generally captures the process without forcing the model to represent the actual physics.',
    'But artificial intelligence could replace these workarounds, enthusiasts argue, with potentially faster and more accurate results.',
    'AI models don’t have to represent actual physics in the form of mathematical equations. Instead, they take in large amounts of historical weather data and learn to recognize patterns. They then use these patterns to make predictions when presented with new data on present-day weather conditions.',
    'In principle, the much faster computational speed could provide immense benefits. But some experts note that the changing climate may pose a unique challenge for developing AI weather models. AI systems rely on historical weather data to teach them how to produce accurate forecasts. But certain kinds of weather events, such as heat waves and hurricanes, are growing more intense as the planet warms — and in some cases, they’re becoming so extreme that there are few examples at all in the historical record. That could make it difficult for AI weather models to accurately simulate (模拟) events that are record-breaking or have never been seen before.',
    'Accurately forecasting extreme weather events is one of the most crucial functions for weather models, enabling decision-makers to issue public safety announcements or facilitate evacuations (疏散) with enough time to protect high-risk populations. But if AI models are presented with weather conditions that are entirely foreign to them, it may be hard to predict how they’ll react. The authors of the 2021 Royal Society paper point out that when it comes to capturing extremes with limited data, AI systems have produced mixed results — some have performed well while others not that satisfactorily.',
    'Hybrid models that include both AI components and numerical model components may run into fewer difficulties with record-breaking events, Russ Schumacher, Colorado’s state climatologist, suggested. He noted that numerical models and AI models may end up with different strengths, and human experience will remain valuable for communicating information about the weather.'
  ];

  // 示例选择题
  const questions = [
    {
      id: '1',
      stem: 'What does the underlined expression “these workarounds” in Paragraph 4 refer to?',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'High costs.' },
        { id: 'b', label: 'Various methods.' },
        { id: 'c', label: 'Weather systems.' },
        { id: 'd', label: 'Inaccurate results.' }
      ]
    },
    {
      id: '2',
      stem: 'What is Paragraph 5 mainly about?',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'The advantages of artificial intelligence.' },
        { id: 'b', label: 'The application of mathematical equations.' },
        { id: 'c', label: 'The fast collection of historical weather data.' },
        { id: 'd', label: 'The working principles of AI weather models.' }
      ]
    },
    {
      id: '3',
      stem: 'What can we learn from the passage?',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'Decision-makers find AI forecasts more reliable.' },
        { id: 'b', label: 'AI models will eventually replace numerical ones.' },
        { id: 'c', label: 'Lack of relevant weather data challenges AI systems.' },
        { id: 'd', label: 'AI weather models help to prevent extreme climate events.' }
      ]
    },
    {
      id: '4',
      stem: 'What’s the main purpose of the passage?',
      type: 'single' as const,
      options: [
        { id: 'a', label: 'To raise global climate change awareness.' },
        { id: 'b', label: 'To stress the importance of the historical record.' },
        { id: 'c', label: 'To compare the strengths of weather prediction methods.' },
        { id: 'd', label: 'To suggest a way to improve weather prediction accuracy.' }
      ]
    }
  ]

  // 处理题目选择变化
  const handleAnswerChange = (questionId: string, selected: string[]) => {
    console.log(`Question ${questionId} selected:`, selected)
    // 这里可以添加提交答案的逻辑
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-screen">
        {/* 左侧文章区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <EnglishReading
            title="D"
            content={sampleContent}
            className="max-w-none"
          />
        </div>

        {/* 分隔线 */}
        <Separator orientation="vertical" />

        {/* 右侧题目区域 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <QuestionSection>
            <ChoiceField questions={questions} onChange={handleAnswerChange} />
          </QuestionSection>
        </div>
      </div>
    </div>
  )
}