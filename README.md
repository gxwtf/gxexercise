# 广学题库（gxexercise）

面向中学场景的在线刷题与组卷练习系统，支持数学、语文、英语、物理、化学五个学科，提供题库浏览、单题 / 组题 / 套卷练习、提交记录回顾，以及基于大模型的主观题（英语作文、阅读表达等）AI 自动批改。

## 功能特性

- **题库浏览**：按学科 → 类别逐级浏览，支持关键词搜索以及题型、来源、年份、年级 / 标签多维度筛选
- **三种练习形态**：
  - 单题（Question）：选择、填空、解答等
  - 组题（QuestionGroup）：完形填空、语法填空、阅读理解、七选五、选词填空等共享题干的题组
  - 套卷（TestPaper）：整卷计时练习，交卷后查看成绩与逐题解析
- **答题与回顾**：客观题自动判分，主观题支持 AI 评分与反馈，可查看历史提交记录
- **优秀解答**：主观题得分率达到优秀标准的作答（英语作文 90%，即 20 分制的 18 分；语文大作文 / 微写作 90%）可按得分展示在本题回顾页，提交时可选择是否允许展示
- **管理员视角**：管理员（打开「管理 → 全部作答记录」，或 `/admin/submissions`）可查看全体用户的作答记录，支持按学科、用户名 / ID、题组关键词、是否待批改筛选与排序；可查看单条作答的作答全文与 AI 批改反馈，也可删除指定记录（二次确认，服务端写审计日志；套卷小节会连同整份套卷一起删除）
- **PDF 导出**：
  - 题组 / 套卷可导出「纸质作答卷」PDF：无答案、按考试卷版式排版并留出作答空间，可直接打印后手写作答
  - 单题回顾可导出 PDF（含作答、正确答案 / AI 反馈与解析）
  - 套卷还可下载入库时抓到的原始试卷 PDF
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
    question/[id]/review/[i]/pdf/     # 单题回顾 PDF
    question/[id]/paper/pdf/          # 题组「纸质作答卷」PDF
    test-paper/[id]/                  # 套卷详情 / 练习 / 结果
    test-paper/[id]/paper/pdf/        # 套卷「纸质作答卷」PDF
    api/test-paper/[id]/pdf/          # 下载套卷的原始 PDF（素材目录）
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
    pdf/
      soffice.ts         # HTML → PDF（LibreOffice headless）
      markdown.ts        # 轻量 Markdown → HTML（题库私有标签、KaTeX、插图尺寸）
      review-doc.ts      # 单题回顾 PDF 正文
      paper-doc.ts       # 纸质作答卷版式（题组 / 整卷）
      paper-source.ts    # Prisma 数据 → 卷面结构（连续题号）
      image-size.ts      # 读图片像素尺寸，供打印稿算显示宽高
      attachment.ts      # PDF 附件下载响应
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

## 题目 PDF 导出

题库的 PDF 全部由**服务端生成**（`src/lib/pdf/`，HTML → LibreOffice headless 转 PDF），前端只放下载链接。

| 场景 | 路由 | 内容 |
| --- | --- | --- |
| 单题回顾 | `/question/<题组 id>/review/<题号>/pdf` | 题目 + 我的作答 + 正确答案 / AI 反馈 + 解析 |
| 题组纸质作答卷 | `/question/<题组 id>/paper/pdf` | 只印题组材料与小题，按考试卷版式留白（无答案） |
| 套卷纸质作答卷 | `/test-paper/<套卷 id>/paper/pdf` | 整卷：封面信息（满分 / 时长 / 姓名班级栏）+ 按类别分大题 + 连续题号 |
| 套卷原始 PDF | `/api/test-paper/<id>/pdf` | 入库时抓到的原卷 PDF（`find-source-pdf.ts` 按标题模糊匹配素材目录） |

「纸质作答卷」的版式约定（改 `src/lib/pdf/paper-doc.ts` 前先看）：

- 选择题：题干后留「（　　）」作答括号，选项一行排开；题干里已带括号的不重复补
- 填空题：题干里的 `<Input2>` / `<Input>` / `<ClozeBlank>` / `<Blank>` 统一印成 `___3___`（题号与前缀对齐）
- 主观题：按题型和分值给带横线的作答区（作文 22 行、英语写作 14–16 行、阅读表达 3–6 行）
- 图片版题目（化学 `<QImg>`）：按 300dpi 原始像素换算宽度、铺满版心
- 整卷按 `category` 把连续题组合并成「一、完形填空（第 1-20 题，共 20 小题，共 30 分）」，作文类另起一页

**LibreOffice 排版踩坑（务必遵守）**：它的 HTML 导入能力有限，以下写法才会真正生效，否则会出现
「图片铺满整页 / 横线消失 / 只剩数字」的问题：

1. `img` 的 CSS `width` / `max-width` / `max-height` **全部被忽略**，只有 HTML 属性 `width` + `height`（单位 pt）生效，
   所以打印前要用 `image-size.ts` 读出图片像素尺寸再折算；
2. 空 `div` / `td` 的 `border-bottom` 不渲染 —— 作答横线用真实下划线字符（`___`）画；
3. `page-break-inside: avoid` 基本无效，分页交给正文自然流动；
4. 中文字体依赖服务器安装的 SimSun（`~/.fonts/simsun.ttf`），图片素材目录由 `MD_IMAGES_ROOT` 指定
   （默认 `/home/gxwtf/jingshibang/output_docx_to_md`）。

## 试卷导入

`problem_generate/` 目录按试卷归档了 docx / txt / md / json 多种格式文件。典型流程：

1. 使用 `parse-exam.js` 将试卷 docx 解析为结构化 JSON
2. 使用 `import-exam.ts` 将 JSON 写入数据库（自动建立题组、套卷及题项关联）

脚本依赖 `.env` 中的 `DATABASE_URL`，通过 `npx tsx` 运行。

```bash
npx tsx problem_generate/import-exam.ts "<json 文件或目录>"      # 导入（新建套卷）
npx tsx problem_generate/import-exam.ts --delete "<套卷标题>"     # 删除某套
npx tsx problem_generate/import-exam.ts --delete --all            # 删除全部英语内容
```

⚠ **导入不是幂等的**：同一份 JSON 导两次会得到两套同名套卷，`--delete "<标题>"` 会按标题
删除（连同该卷的作答记录）。重复导入前请先删同名套卷。

### 批量维护题库数据

本仓库只负责「JSON → 数据库」这一步。上游（爬取菁师帮新卷、docx → md → JSON、校验、批量入库、
存量题干回填）由 `/home/gxwtf/jingshibang` 的流水线脚本负责，操作手册见
`/home/gxwtf/jingshibang/README.md`：

| 脚本 | 用途 |
| --- | --- |
| `jingshibang/check_missing.py` | 仅爬取线上新增的卷子（只下载缺失部分） |
| `jingshibang/update_bank.py` | 按卷子跑 md → JSON → 校验 → 入库（`--list` 可看进度，`--replace` 覆盖同名套卷） |
| `jingshibang/exam-parser/backfill_re_stems.py` | 用 md 重算「阅读表达」题干并回填 `Question.content`（不调 AI） |
