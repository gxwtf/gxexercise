# 广学题库（gxexercise）

面向中学场景的在线刷题与组卷练习系统，支持数学、语文、英语、物理、化学五个学科，提供题库浏览、单题 / 组题 / 套卷练习、提交记录回顾，以及基于大模型的主观题（英语作文、阅读表达等）AI 自动批改。

## 功能特性

- **题库浏览**：按学科 → 类别逐级浏览，支持关键词搜索以及题型、来源、年份、年级 / 标签多维度筛选
- **三种练习形态**：
  - 单题（Question）：选择、填空、解答等
  - 组题（QuestionGroup）：完形填空、语法填空、阅读理解、七选五、选词填空等共享题干的题组
  - 套卷（TestPaper）：整卷计时练习，交卷后查看成绩与逐题解析
- **答题与回顾**：客观题自动判分，主观题支持 AI 评分与反馈，可查看历史提交记录
- **AI 批改**：通过 OpenAI 兼容接口调用大模型，提示词按题型可配置；应用内内置轮询 Worker，异步批改 `pending` 状态的提交
- **SSO 登录**：基于 iron-session 维护会话，对接广学统一账号中心（GX Account）完成单点登录
- **内容渲染**：题目与文章使用 MDX 渲染，支持 GFM、数学公式（KaTeX）与图片
- **试卷导入工具**：`problem_generate/` 下提供试卷 docx 解析与入库脚本

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16（App Router）、React 19、React Compiler |
| 语言 | TypeScript |
| 数据库 | PostgreSQL + Prisma 7（`@prisma/adapter-pg`） |
| 样式 / UI | Tailwind CSS 4、shadcn 风格组件、radix-ui / @base-ui、lucide-react |
| 内容渲染 | next-mdx-remote、remark-gfm、remark-math、rehype-katex |
| 数据请求 | SWR |
| 交互 | react-dnd（七选五 / 选词填空拖拽）、next-themes（明暗主题）、sonner（通知） |
| 会话 | iron-session |
| AI | openai（OpenAI 兼容接口） |
| 包管理 | pnpm |

## 快速开始

### 环境要求

- Node.js 20.9+
- pnpm
- PostgreSQL

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制示例文件并按需修改：

```bash
cp .env.example .env
```

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `SES_SECRET` | iron-session 加密密钥（生产环境请使用足够复杂的随机值） |
| `GXACCOUNT_URL` | 广学统一账号中心地址，用于 SSO 登录 |
| `OPENAI_BASE_URL` | OpenAI 兼容 API 地址（如 SiliconFlow） |
| `OPENAI_API_KEY` | 大模型 API Key |
| `OPENAI_MODEL` | 批改使用的模型名称 |

### 3. 初始化数据库

```bash
pnpm run db:generate   # 生成 Prisma Client
pnpm run db:push       # 将 schema 推送到数据库
pnpm run db:seed       # 写入种子数据
```

另有学科专项种子脚本：

```bash
pnpm run db:seed-math      # 数学
pnpm run db:seed-chinese   # 语文（数据见 prisma/seed-chinese.json）
```

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)。

## 常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm start` | 运行生产构建 |
| `pnpm lint` | ESLint 检查 |
| `pnpm run db:generate` | 生成 Prisma Client（输出到 `src/generated/prisma`） |
| `pnpm run db:push` | 同步 schema 到数据库 |
| `pnpm run db:seed` | 执行基础种子脚本 `prisma/seed.ts` |

## 目录结构

```
prisma/
  schema.prisma          # 数据模型（题目 / 组题 / 套卷 / 提交记录 / 用户）
  seed.ts 等              # 各学科种子数据与脚本
problem_generate/        # 试卷解析与导入工具（docx → json → 数据库）
  parse-exam.js          # 解析试卷文件
  import-exam.ts         # 将解析结果导入数据库
src/
  app/
    (root)/              # 首页、登录页
    questions/[subject]/[category]/   # 题库浏览
    question/[id]/                    # 单题作答与回顾
    test-paper/[id]/                  # 套卷详情 / 练习 / 结果
    sso/                              # SSO 登录跳转与回调
    api/                              # 会话、统计、提交、AI 批改等接口
  components/            # UI 组件、题目 / 题组作答组件、回顾组件
  constants/             # 学科、类别、题型等常量与路由映射
  lib/
    prisma.ts            # Prisma Client 单例
    iron.ts              # 会话配置
    ai-service.ts        # 大模型调用与评分解析
    grading-worker.ts    # AI 批改后台轮询任务
    grading-prompts/     # 各题型批改提示词（en-writing、reading-expression）
    transformers.ts      # 数据转换
  instrumentation.ts     # 启动批改 Worker
```

## 数据模型概览

- `Question`：单题，含题型、题干、选项、答案、解析、学科、类别、来源、年份、标签等
- `QuestionGroup` / `GroupItem`：题组及其与单题的有序关联（阅读理解、完形填空等）
- `TestPaper` / `PaperItem`：套卷及其包含的题组 / 单题
- `QuestionSubmission`、`QuestionGroupSubmission`、`TestPaperSubmission`：三级提交记录，主观题提交带 `gradingStatus`（`pending` 等）与 `aiFeedback`
- `User`：用户 ID 来自 SSO 账号中心，本地仅保存提交关联

## AI 批改说明

- 学生提交后，客观题即时判分；需 AI 批改的提交写入 `pending` 状态
- 服务启动时通过 `instrumentation.ts` 运行 [grading-worker.ts](src/lib/grading-worker.ts)，每 10 秒轮询待批改记录，按题型匹配提示词并调用大模型
- 提示词配置位于 [src/lib/grading-prompts](src/lib/grading-prompts)，包含系统提示词、用户提示词模板及 `config.json`；模板支持 `{stem}`、`{userAnswer}`、`{correctAnswer}`、`{maxScore}` 占位符
- 也可调用 `/api/ai/retry-pending` 手动触发重试

## 试卷导入

`problem_generate/` 目录按试卷归档了 docx / txt / md / json 多种格式文件。典型流程：

1. 使用 `parse-exam.js` 将试卷 docx 解析为结构化 JSON
2. 使用 `import-exam.ts` 将 JSON 写入数据库（自动建立题组、套卷及题项关联）

脚本依赖 `.env` 中的 `DATABASE_URL`，通过 `npx tsx` 运行。
