'use client'

import { useState, useMemo } from 'react'
import { QuestionCard } from './QuestionCard'
import { mockQuestions } from '@/data/mockQuestions'
import { Search, Filter, Grid3X3, List } from 'lucide-react'
import { Button } from '@/components/ui/button'

const subjects = ['全部', '数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治']
const questionTypes = ['全部', '选择题', '填空题', '解答题', '证明题', '计算题']

export function QuestionList() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('全部')
  const [selectedType, setSelectedType] = useState('全部')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filteredQuestions = useMemo(() => {
    return mockQuestions.filter((question) => {
      const matchesSearch = question.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        question.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesSubject = selectedSubject === '全部' || question.subject === selectedSubject
      const matchesType = selectedType === '全部' || question.questionType === selectedType
      return matchesSearch && matchesSubject && matchesType
    })
  }, [searchTerm, selectedSubject, selectedType])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">题库概览</h1>
          <p className="text-muted-foreground">共收录 {mockQuestions.length} 道题目，涵盖多学科多类型</p>
        </div>

        <div className="bg-card rounded-xl shadow-sm p-4 mb-6 border border-border">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索题目..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="gap-2"
              >
                <Grid3X3 className="w-4 h-4" />
                网格
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="gap-2"
              >
                <List className="w-4 h-4" />
                列表
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">学科:</span>
            </div>
            {subjects.map((subject) => (
              <Button
                key={subject}
                variant={selectedSubject === subject ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSubject(subject)}
                className="rounded-full"
              >
                {subject}
              </Button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">题型:</span>
            {questionTypes.map((type) => (
              <Button
                key={type}
                variant={selectedType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type)}
                className="rounded-full"
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        {filteredQuestions.length > 0 ? (
          <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
            {filteredQuestions.map((question, index) => (
              <div
                key={question.id}
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <QuestionCard {...question} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <div className="text-muted-foreground mb-2">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">未找到匹配的题目</h3>
            <p className="text-muted-foreground">尝试调整筛选条件或搜索关键词</p>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            当前显示 {filteredQuestions.length} 道题目
          </p>
        </div>
      </div>
    </div>
  )
}
