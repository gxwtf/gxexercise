# 前端渲染修改方案

## 需求分析

根据用户需求，需要修改前端渲染逻辑：

1. **学科/类别页面**：显示
   - 单题中允许显示的题目（`showOnHomepage: true`）
   - 组题（QuestionGroup）

2. **套卷区域**（category === '套卷'）：显示
   - 套卷（TestPaper）

## 当前问题

1. 后端查询没有过滤 `showOnHomepage: true` 的题目
2. 没有查询组题（QuestionGroup）数据
3. 套卷数据是硬编码的示例数据，没有从数据库获取
4. 筛选选项硬编码，没有动态获取
5. 缺少来源筛选、题型筛选等功能
6. 组题和套卷没有筛选支持

## 修改计划

### 1. 修改页面组件

| 文件 | 修改内容 |
|------|----------|
| `src/app/questions/[subject]/[category]/page.tsx` | 查询单题（showOnHomepage=true）和组题 |
| `src/app/questions/page.tsx` | 查询所有允许显示的题目和组题 |
| `src/app/questions/[subject]/page.tsx` | 查询该学科下允许显示的题目和组题 |

### 2. 修改 QuestionOverview 组件

- 添加组题展示逻辑
- 从数据库获取套卷数据
- 优化布局结构
- **完善筛选功能**：
  - 动态获取题型选项（从 constants）
  - 添加来源筛选（从数据库动态获取）
  - 添加年级筛选
  - 添加题量统计显示
  - 支持组题和套卷的筛选

### 3. 完善筛选功能

| 筛选类型 | 说明 | 数据来源 |
|----------|------|----------|
| 题型筛选 | 单项选择、多项选择等 | `questionTypes.ts` 常量 |
| 来源筛选 | 高考真题、模拟试卷等 | 数据库动态获取 |
| 年份筛选 | 按年份过滤 | 数据库动态获取 |
| 标签筛选 | 年级（高一/高二/高三）、难度（基础/提高/拓展）等 | 数据库动态获取 |

**说明**：年级信息存储在 `tags` 字段中（如 "高一"、"高二"、"高三"），通过标签筛选实现年级筛选功能。

### 4. 创建新组件

| 组件 | 说明 |
|------|------|
| `src/components/GroupCard.tsx` | 组题卡片组件 |
| `src/components/FilterPanel.tsx` | 统一筛选面板组件 |

### 5. 数据查询逻辑

```typescript
// 单题查询（过滤 showOnHomepage=true）
const questions = await prisma.question.findMany({
  where: {
    subject: subjectName,
    category: categoryName,
    showOnHomepage: true
  },
  orderBy: { createdAt: "desc" },
});

// 组题查询
const groups = await prisma.questionGroup.findMany({
  where: {
    subject: subjectName,
    category: categoryName
  },
  orderBy: { createdAt: "desc" },
  include: {
    groupItems: {
      include: {
        question: true
      },
      orderBy: { orderIndex: "asc" }
    }
  }
});

// 套卷查询
const papers = await prisma.testPaper.findMany({
  where: {
    subject: subjectName
  },
  orderBy: { createdAt: "desc" },
  include: {
    paperItems: {
      orderBy: { orderIndex: "asc" }
    }
  }
});

// 获取筛选选项（动态获取）
const sources = await prisma.question.findMany({
  distinct: ['source'],
  select: { source: true }
}).then(res => res.map(r => r.source));

const years = await prisma.question.findMany({
  distinct: ['year'],
  select: { year: true }
}).then(res => res.filter(r => r.year).map(r => r.year!.toString()));

const tags = await prisma.question.findMany({
  select: { tags: true }
}).then(res => [...new Set(res.flatMap(r => r.tags))]);
```

### 6. 筛选逻辑

```typescript
interface FilterState {
  searchTerm: string;
  questionType: string;
  source: string;
  year: string;
  grade: string;
  tag: string;
}

// 单题筛选
const filteredQuestions = questions.filter(q => {
  const matchesSearch = q.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
  const matchesType = !filter.questionType || q.questionType === filter.questionType;
  const matchesSource = !filter.source || q.source === filter.source;
  const matchesYear = !filter.year || q.year?.toString() === filter.year;
  const matchesGrade = !filter.grade || q.tags.includes(filter.grade);
  const matchesTag = !filter.tag || q.tags.includes(filter.tag);
  return matchesSearch && matchesType && matchesSource && matchesYear && matchesGrade && matchesTag;
});

// 组题筛选
const filteredGroups = groups.filter(g => {
  const matchesSearch = g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
  const matchesSource = !filter.source || g.source === filter.source;
  const matchesGrade = !filter.grade || g.tags.includes(filter.grade);
  const matchesTag = !filter.tag || g.tags.includes(filter.tag);
  return matchesSearch && matchesSource && matchesGrade && matchesTag;
});

// 套卷筛选
const filteredPapers = papers.filter(p => {
  const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
  const matchesSource = !filter.source || p.source === filter.source;
  const matchesGrade = !filter.grade || p.tags.includes(filter.grade);
  return matchesSearch && matchesSource && matchesGrade;
});
```

### 7. 页面布局

**非套卷页面布局**：
```
┌─────────────────────────────────────┐
│         筛选面板                    │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  组题区域                          │
│  ┌─────────────────────────────┐   │
│  │  GroupCard (组题卡片)       │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  单题区域                          │
│  ┌─────┬─────┬─────┐              │
│  │Card │Card │Card │...           │
│  └─────┴─────┴─────┘              │
└─────────────────────────────────────┘
```

**套卷页面布局**：
```
┌─────────────────────────────────────┐
│         筛选面板                    │
│  - 来源筛选                        │
│  - 年份筛选                        │
│  - 年级筛选                        │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  套卷列表                          │
│  ┌─────────────────────────────┐   │
│  │  TestCard (套卷卡片)        │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  TestCard (套卷卡片)        │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## 组件设计

### GroupCard 组件

| 属性 | 类型 | 说明 |
|------|------|------|
| id | string | 组题ID |
| title | string | 组题标题 |
| content | string | 组题内容（预览） |
| subject | string | 学科 |
| questionCount | number | 题目数量 |
| source | string | 来源 |
| tags | string[] | 标签 |

### FilterPanel 组件

| 属性 | 类型 | 说明 |
|------|------|------|
| questionTypes | string[] | 题型选项 |
| sources | string[] | 来源选项 |
| years | string[] | 年份选项 |
| grades | string[] | 年级选项 |
| tags | string[] | 标签选项 |
| selectedFilters | FilterState | 当前选中的筛选条件 |
| onFilterChange | (filters: FilterState) => void | 筛选条件变化回调 |

### 修改后的 QuestionOverview 组件接口

```typescript
interface QuestionOverviewProps {
  initialQuestions?: Question[];
  initialGroups?: QuestionGroup[];
  initialPapers?: TestPaper[];
  subject?: string;
  category?: string;
  questionType?: string;
}
```

## 风险与注意事项

1. **性能考虑**：组题包含关联的题目数据，需要注意查询性能
2. **MDX 渲染**：组题内容可能包含 MDX，需要支持渲染
3. **数据同步**：确保数据库中的数据正确关联

---

**状态**: 待审核

**版本**: v1.0

**日期**: 2026-05-04