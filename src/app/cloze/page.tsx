'use client'

import * as React from 'react'
import EnglishReading from '@/components/article/english-reading'
import { ChoiceField } from '@/components/question/ChoiceField'
import { QuestionSection } from '@/components/QuestionSection'
import { Separator } from '@/components/ui/separator'

export default function ReadingPage() {
    // 示例文章内容
    const sampleContent = [
        'I’m not a professional ____1____. My husband and I had suddenly decided on a wild holiday after watching several videos on rock climbing. Our first climb was ____2____ than I had imagined, as it required much arm strength. I’m pretty active and fit, but my arm muscles aren’t the strongest. Yet we managed to ____3____ the route and it was quite fun.',
        'Soon we tried the next climb. I stood at the bottom of a cliff, wondering whether I should climb or not. I was ____4____ — half of me wanted to back out, while the other half felt like I should go for it. My husband was above me, just a little farther up the cliff face. He was ____5____— or appeared to be at least— and was willing me on.',
        'I carried on until there seemed to be fewer pegs (攀岩的岩点). I had to stretch my leg to ____6____ the next peg, which was hard to land on, because it was so skinny. I hesitated. I knew if I ____7____ myself, I could miss it and fall. As fear was beginning to ____8____, my legs started to shake. I knew if I allowed this panic to flood me, I might fall. So I ____9____ my head, visualized where my foot would land on the peg, managed to stop my legs from _____10_____ and went for it. Phew! I _____11_____ it. I was on the peg. It was smaller than the last. I could only fit one foot on, the other balanced on top. I felt _____12_____ for a moment— we were halfway through and had passed the trickiest part.',
        'Thirty meters high— we were near the top. By this point, the rock was sticking outward, which was dangerous. But I couldn’t afford to panic now. I managed to blank my mind and drag myself around the rock, transforming my fear into the _____13_____ I needed. I grabbed the handhold and swung my foot around onto the rock. For the first time, I experienced fear as being separate from myself. I realized that I actually had the power to notice myself feeling fear and I knew exactly what I needed to do: to breathe, and take the leap (跳跃) with _____14_____.',
        'Finally, I reached the top and felt excited. Something had _____15_____. Fear is unbelievably powerful, but now I know, so am I.'
    ];

    // 示例选择题
    const questions = [
        {
            id: '1',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'walker' },
                { id: 'b', label: 'climber' },
                { id: 'c', label: 'coach' },
                { id: 'd', label: 'rescuer' }
            ]
        },
        {
            id: '2',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'safer' },
                { id: 'b', label: 'faster' },
                { id: 'c', label: 'harder' },
                { id: 'd', label: 'smoother' }
            ]
        },
        {
            id: '3',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'plan' },
                { id: 'b', label: 'track' },
                { id: 'c', label: 'accept' },
                { id: 'd', label: 'complete' }
            ]
        },
        {
            id: '4',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'torn' },
                { id: 'b', label: 'hurt' },
                { id: 'c', label: 'serious' },
                { id: 'd', label: 'excited' }
            ]
        },
        {
            id: '5',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'sad' },
                { id: 'b', label: 'calm' },
                { id: 'c', label: 'scared' },
                { id: 'd', label: 'lucky' }
            ]
        },
        {
            id: '6',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'fix' },
                { id: 'b', label: 'kick' },
                { id: 'c', label: 'break' },
                { id: 'd', label: 'reach' }
            ]
        },
        {
            id: '7',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'doubted' },
                { id: 'b', label: 'comforted' },
                { id: 'c', label: 'satisfied' },
                { id: 'd', label: 'disappointed' }
            ]
        },
        {
            id: '8',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'run out' },
                { id: 'b', label: 'give in' },
                { id: 'c', label: 'take hold' },
                { id: 'd', label: 'break down' }
            ]
        },
        {
            id: '9',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'nodded' },
                { id: 'b', label: 'cleared' },
                { id: 'c', label: 'raised' },
                { id: 'd', label: 'clouded' }
            ]
        },
        {
            id: '10',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'aching' },
                { id: 'b', label: 'moving' },
                { id: 'c', label: 'shaking' },
                { id: 'd', label: 'twisting' }
            ]
        },
        {
            id: '11',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'left' },
                { id: 'b', label: 'made' },
                { id: 'c', label: 'missed' },
                { id: 'd', label: 'changed' }
            ]
        },
        {
            id: '12',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'relieved' },
                { id: 'b', label: 'nervous' },
                { id: 'c', label: 'hesitant' },
                { id: 'd', label: 'regretful' }
            ]
        },
        {
            id: '13',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'joy' },
                { id: 'b', label: 'honesty' },
                { id: 'c', label: 'pride' },
                { id: 'd', label: 'strength' }
            ]
        },
        {
            id: '14',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'surprise' },
                { id: 'b', label: 'gratitude' },
                { id: 'c', label: 'curiosity' },
                { id: 'd', label: 'confidence' }
            ]
        },
        {
            id: '15',
            stem: '',
            type: 'single' as const,
            options: [
                { id: 'a', label: 'mixed' },
                { id: 'b', label: 'dropped' },
                { id: 'c', label: 'shifted' },
                { id: 'd', label: 'darkened' }
            ]
        }
    ];

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
                        title=""
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