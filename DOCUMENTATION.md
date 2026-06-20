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

| 学科 | 类别 |
|------|------|
| 数学 | 代数、几何、函数、概率统计、微积分 |
| 语文 | 诗词鉴赏、阅读理解、作文素材、文言文、现代文 |
| 英语 | 完形填空、语法填空、阅读、七选五、阅读表达、作文 |
| 物理 | 力学、电磁学、热学、光学、实验题 |
| 化学 | 化学方程式、有机化学、无机化学、实验操作、元素周期 |

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