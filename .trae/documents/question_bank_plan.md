# 题库数据库模型设计方案

## 需求分析

根据用户需求，设计一个三级题库数据库模型：

### 第一级 - 单题 (Question)

* 题型：单选、多选、不定项、填空、解答等

* 题干：mdx 格式

* 选项：JSON 串格式（如 `[{'A':'1 2'},{'B':'3 4'}]`）

* 答案

* 分值（score）

* 是否在主页显示（showOnHomepage）

* 正确率等统计信息

### 第二级 - 组题 (QuestionGroup)

* 套题题干：mdx 格式（如阅读理解文章）

* 关联题目列表：id 数组

* 动态渲染

### 第三级 - 套卷 (TestPaper)

* 关联题目或组题列表：按顺序排列

* 全卷背景信息或说明：mdx 格式

### 三级共通字段

* 学科（subject）

* 来源（source）

* 年级（grade）

* 标签（tags）等

***

## 数据库模型设计

### 模型关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                      TestPaper (套卷)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ id, title, description (mdx), subject, source, grade   │    │
│  │ tags, createdAt, updatedAt                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │          PaperItem (卷内条目 - 维护顺序)                │    │
│  │  paperId, itemId, itemType(Question/QuestionGroup),    │    │
│  │  orderIndex, score                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│    Question (单题)       │         │  QuestionGroup (组题)    │
│  id, questionType       │         │  id, title              │
│  content (mdx)          │         │  content (mdx)          │
│  options (json)         │         │  subject, source, grade │
│  answer, analysis       │         │  tags, createdAt...     │
│  correctRate            │         └─────────────────────────┘
│  subject, source, grade │                    │
│  tags, createdAt...     │                    ▼
└─────────────────────────┘         ┌─────────────────────────┐
          │                         │   GroupItem (组内条目)    │
          └─────────────────────────▶│  groupId, questionId,   │
                                    │  orderIndex             │
                                    └─────────────────────────┘
```

***

## 模型详细设计

### 1. Question (单题表)

| 字段名            | 类型            | 说明          | 约束                   |
| -------------- | ------------- | ----------- | -------------------- |
| id             | String (CUID) | 主键          | @id @default(cuid()) |
| questionType   | String        | 题型          | 必填，枚举值               |
| content        | String (Text) | 题干内容（mdx格式） | 必填                   |
| options        | Json          | 选项（JSON数组）  | 可选（解答题可能无选项）         |
| answer         | String        | 答案          | 必填                   |
| analysis       | String (Text) | 解析（mdx格式）   | 可选                   |
| score          | Int           | 分值          | 必填                   |
| showOnHomepage | Boolean       | 是否在主页显示     | 默认 true              |
| correctRate    | Float         | 正确率         | 可选，0-1               |
| subject        | String        | 学科          | 必填                   |
| source         | String        | 来源（如：高考真题）  | 必填                   |
| grade          | String        | 年级          | 可选                   |
| category       | String        | 分类/章节       | 必填                   |
| year           | Int           | 年份（如真题年份）   | 可选                   |
| tags           | String\[]     | 标签列表        | 可选                   |
| imageUrl       | String        | 配图URL       | 可选                   |
| createdAt      | DateTime      | 创建时间        | @default(now())      |
| updatedAt      | DateTime      | 更新时间        | @updatedAt           |

**questionType 枚举值**：

* 单项选择题

* 多项选择题

* 不定项选择题

* 填空题

* 解答题

* 七选五题

* 选词填空题

**options 格式示例**：

```json
[
  {"A": "选项A内容"},
  {"B": "选项B内容"},
  {"C": "选项C内容"},
  {"D": "选项D内容"}
]
```

***

### 2. QuestionGroup (组题表)

| 字段名       | 类型            | 说明                  | 约束                   |
| --------- | ------------- | ------------------- | -------------------- |
| id        | String (CUID) | 主键                  | @id @default(cuid()) |
| title     | String        | 组题标题                | 必填                   |
| content   | String (Text) | 组题题干（mdx格式，如阅读理解文章） | 必填                   |
| subject   | String        | 学科                  | 必填                   |
| source    | String        | 来源                  | 必填                   |
| grade     | String        | 年级                  | 可选                   |
| category  | String        | 分类                  | 必填                   |
| tags      | String\[]     | 标签列表                | 可选                   |
| createdAt | DateTime      | 创建时间                | @default(now())      |
| updatedAt | DateTime      | 更新时间                | @updatedAt           |

***

### 3. GroupItem (组内条目表 - 维护组题内题目顺序)

| 字段名        | 类型            | 说明     | 约束                                    |
| ---------- | ------------- | ------ | ------------------------------------- |
| id         | String (CUID) | 主键     | @id @default(cuid())                  |
| groupId    | String        | 所属组题ID | @relation("QuestionGroupToGroupItem") |
| questionId | String        | 关联题目ID | @relation("QuestionToGroupItem")      |
| orderIndex | Int           | 顺序索引   | 必填，从0开始                               |

***

### 4. TestPaper (套卷表)

| 字段名         | 类型            | 说明          | 约束                   |
| ----------- | ------------- | ----------- | -------------------- |
| id          | String (CUID) | 主键          | @id @default(cuid()) |
| title       | String        | 套卷标题        | 必填                   |
| description | String (Text) | 全卷说明（mdx格式） | 可选                   |
| subject     | String        | 学科          | 必填                   |
| source      | String        | 来源          | 必填                   |
| grade       | String        | 年级          | 可选                   |
| totalScore  | Int           | 总分          | 可选                   |
| duration    | Int           | 考试时长（分钟）    | 可选                   |
| tags        | String\[]     | 标签列表        | 可选                   |
| createdAt   | DateTime      | 创建时间        | @default(now())      |
| updatedAt   | DateTime      | 更新时间        | @updatedAt           |

***

### 5. PaperItem (卷内条目表 - 维护套卷内题目/组题顺序)

| 字段名        | 类型            | 说明        | 约束                                | <br />          |
| ---------- | ------------- | --------- | --------------------------------- | :-------------- |
| id         | String (CUID) | 主键        | @id @default(cuid())              | <br />          |
| paperId    | String        | 所属套卷ID    | @relation("TestPaperToPaperItem") | <br />          |
| itemId     | String        | 关联题目或组题ID | 必填                                | <br />          |
| itemType   | String        | 条目类型      | 必填，枚举："Question"                  | "QuestionGroup" |
| orderIndex | Int           | 顺序索引      | 必填，从0开始                           | <br />          |

***

## Prisma Schema 代码

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model Question {
  id             String    @id @default(cuid())
  questionType   String    @db.VarChar(100)
  content        String    @db.Text
  options        Json?
  answer         String
  analysis       String?   @db.Text
  score          Int
  showOnHomepage Boolean   @default(true)
  correctRate    Float?    @db.Float
  subject        String    @db.VarChar(100)
  source         String    @db.VarChar(200)
  grade          String?   @db.VarChar(50)
  category       String    @db.VarChar(100)
  year           Int?
  tags           String[]
  imageUrl       String?   @db.VarChar(500)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  groupItems     GroupItem[]
  paperItems     PaperItem[]

  @@index([subject])
  @@index([questionType])
  @@index([category])
  @@index([year])
}

model QuestionGroup {
  id        String     @id @default(cuid())
  title     String     @db.VarChar(255)
  content   String     @db.Text
  subject   String     @db.VarChar(100)
  source    String     @db.VarChar(200)
  grade     String?    @db.VarChar(50)
  category  String     @db.VarChar(100)
  tags      String[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  groupItems GroupItem[]
  paperItems PaperItem[]

  @@index([subject])
  @@index([category])
}

model GroupItem {
  id         String        @id @default(cuid())
  groupId    String
  questionId String
  orderIndex Int

  group      QuestionGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  question   Question      @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([groupId, questionId])
  @@index([groupId])
}

model TestPaper {
  id          String     @id @default(cuid())
  title       String     @db.VarChar(255)
  description String?    @db.Text
  subject     String     @db.VarChar(100)
  source      String     @db.VarChar(200)
  grade       String?    @db.VarChar(50)
  totalScore  Int?
  duration    Int?
  tags        String[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  paperItems  PaperItem[]

  @@index([subject])
}

model PaperItem {
  id         String        @id @default(cuid())
  paperId    String
  itemId     String
  itemType   String        @db.VarChar(20)
  orderIndex Int

  paper      TestPaper     @relation(fields: [paperId], references: [id], onDelete: Cascade)

  @@unique([paperId, itemId])
  @@index([paperId])
}
```

***

## 设计要点说明

### 1. 选项存储格式

使用 JSON 类型存储选项，支持灵活的选项结构：

```json
// 单选题/多选题
[
  {"A": "选项A内容"},
  {"B": "选项B内容"},
  {"C": "选项C内容"},
  {"D": "选项D内容"}
]

// 填空题（可能包含多个空）
[
  {"1": "第一个空"},
  {"2": "第二个空"}
]
```

### 2. 顺序维护

* **GroupItem**：维护组题内单题的顺序

* **PaperItem**：维护套卷内题目/组题的顺序

* 使用 `orderIndex` 字段从0开始排序，支持动态调整顺序

### 3. 分值设计

* **Question.score**：单题分值，存储在单题表中

* **QuestionGroup**：不单独存储分值，总分通过关联的题目动态计算

* **TestPaper**：不单独存储分值，总分通过关联的题目或组题动态计算

### 4. 主页显示控制

* **Question.showOnHomepage**：控制单题是否在主页显示

* 适用于阅读理解中的某些子题（如主旨题）无需单独展示的场景

### 5. 多态关联

`PaperItem.itemType` 字段区分关联的是单题还是组题：

* `"Question"`：关联 Question 表

* `"QuestionGroup"`：关联 QuestionGroup 表

### 6. 扩展性考虑

* 使用 String 类型存储枚举字段（questionType, subject, grade），便于后续扩展

* tags 使用数组类型，支持多标签

* content 使用 Text 类型支持较长的 mdx 内容

***

## 数据库变更计划

### 需要修改的文件

1. **`prisma/schema.prisma`** - 更新数据库模型
2. **`src/constants/questionTypes.ts`** - 确认题型定义（已有）
3. **`src/constants/subjects.ts`** - 确认学科定义（已有）
4. **`prisma/seed.ts`** - 更新种子数据生成逻辑

### 变更步骤

1. 备份现有数据（如需要）
2. 修改 schema.prisma
3. 运行 `prisma migrate dev` 创建迁移
4. 更新 seed.ts 添加测试数据
5. 运行 `prisma db seed` 填充数据

***

## 潜在风险

1. **数据迁移**：现有 Question 表需要添加新字段，需注意数据兼容性
2. **性能考虑**：大量题目时，查询需要合理使用索引
3. **MDX 内容**：需要前端支持 MDX 渲染，确保内容安全

***

## 后续建议

1. 考虑添加用户做题记录相关表（UserAnswer, ExamRecord 等）
2. 添加难度等级字段（difficulty）
3. 添加审核状态字段（status: draft/published/review）
4. 考虑添加版本控制支持

***

**状态**: 待审核

**版本**: v1.0

**日期**: 2026-05-04
