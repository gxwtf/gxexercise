# 题库概览页面开发文档

## 项目概述

本项目为广学题库系统的前端应用，基于 Next.js 16 和 Prisma ORM 构建，使用 PostgreSQL 数据库存储题目数据。

## 创建的文件

### 1. 组件文件

#### `src/components/QuestionOverview.tsx`
- 题库概览核心组件
- 支持搜索功能（按标题和标签搜索）
- 支持按学科、类别、题型筛选
- 展示题目列表，无标题设计

### 2. 页面文件

#### `src/app/questions/page.tsx`
- 题库概览主页
- 显示所有题目列表

#### `src/app/questions/[subject]/[category]/page.tsx`
- 动态路由页面
- 根据学科和类别筛选题目

#### `src/app/questions/type/[questionType]/page.tsx`
- 按题型筛选的动态路由页面

#### `src/app/questions/detail/[id]/page.tsx`
- 显示指定题目详情的动态路由页面

### 3. 常量文件

#### `src/constants/questionTypes.ts`
- 定义支持的题型列表
- 提供题型与路由的映射关系

### 4. 工具文件

#### `src/lib/prisma.ts`
- Prisma Client 实例配置

### 5. Seed 文件

#### `prisma/seed.ts`
- 测试数据生成脚本
- 自动生成 144 道测试题目

## 路由结构

```
/questions                    # 题库概览主页
/questions/[subject]/[category]  # 按学科和类别筛选
/questions/type/[questionType]   # 按题型筛选
/questions/detail/[id]           # 单个题目详情
```

## 支持的题型

1. 单项选择题
2. 多项选择题
3. 不定项选择题
4. 填空题
5. 解答题
6. 七选五题
7. 选词填空题

## 学科与类别映射

> 以下内容与 `src/constants/subjects.ts` 一一对应，改那边记得同步这里。
> 类别即首页/学科页导航上的题型入口，路由 slug 见 `categoryToRoute`。

| 学科 | 路由 | 类别（题型） |
|------|------|------|
| 数学 | `/questions/math` | 选择、填空、三角、概统、立几、解几、导数、新定义、套卷 |
| 语文 | `/questions/chinese` | 多文本、文言文、古诗、默写、名著、文学类、语用、微写作、作文、套卷 |
| 英语 | `/questions/english` | 完形填空、语法填空、选词填空、阅读、七选五、阅读表达、作文、套卷 |
| 物理 | `/questions/physics` | 选择、力学、电磁学、热学、光学、实验题、套卷 |
| 化学 | `/questions/chemistry` | 选择、物质结构与性质、化学反应原理、有机化学基础、工业流程、实验探究、套卷 |
| 生物 | `/questions/biology` | 选择、遗传与进化、稳态与调节、生物技术与工程、实验探究、套卷 |
| 历史 | `/questions/history` | 选择、观点论证、史料分析、修改补写、套卷 |
| 政治 | `/questions/politics` | 选择、材料分析、开放性试题、套卷 |
| 地理 | `/questions/geography` | 选择、自然地理、人文地理、区域发展、图表判读、套卷 |

**生物 / 历史 / 政治 / 地理四科与化学的新题型为公测期预留**：按北京卷近年非选择题的稳定功能板块划分，
不锁定「题号—考点」映射，入库时按题目实际内容归入对应板块即可。

### 新增科目 / 题型时的注意事项

1. 三处齐改：`subjects`、`subjectToRoute` + `routeToSubject`、`categoriesBySubject` + `categoryToRoute`
   （漏掉 `categoryToRoute` 会让首页链接变成 `/questions/<学科>/undefined`）。
2. 同一学科内，路由 slug **不能互为子串**（`SubHeader` 用 `pathname.includes(slug)` 判断当前题型高亮）。
3. `QuestionGroup.questionType` 与 `Question.questionType` 使用独立词汇表（前者如 `math-choice`、`en-reading`，
   后者如 `choice`、`input`、`text`）；`src/app/question/[id]/page.tsx` 与
   `src/app/test-paper/[id]/practice/TestPaperPractice.tsx` 按 `questionType` 精确分支渲染，
   **新题型入库前需要先在两处补上渲染分支**，否则题目页会显示「暂不支持的题型」。

## 运行命令

```bash
# 安装依赖
pnpm install

# 生成 Prisma Client
pnpm run db:generate

# 推送数据库schema
pnpm run db:push

# 运行seed生成测试数据
pnpm run db:seed

# 启动开发服务器
pnpm dev
```

## 数据库配置

数据库连接信息存储在 `.env` 文件中：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
```

## 技术栈

- **框架**: Next.js 16
- **数据库**: PostgreSQL
- **ORM**: Prisma
- **样式**: Tailwind CSS 4
- **UI组件**: shadcn/ui
- **图标**: Lucide React