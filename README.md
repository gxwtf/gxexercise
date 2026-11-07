# 广学题库（gxexercise）

面向中学场景的在线刷题与组卷练习系统（当前版本 **0.3.0-rc1**，公测期），支持数学、语文、英语、物理、化学、生物、政治、历史、地理九个学科，提供题库浏览、单题 / 组题 / 套卷练习、提交记录回顾，以及基于大模型的主观题（英语作文、阅读表达等）AI 自动批改。

## 功能特性

- **题库浏览**：按学科 → 类别逐级浏览，支持关键词搜索以及题型、来源、年份、年级 / 标签多维度筛选
- **三种练习形态**：
  - 单题（Question）：选择、填空、解答等
  - 组题（QuestionGroup）：完形填空、语法填空、阅读理解、七选五、选词填空等共享题干的题组
  - 套卷（TestPaper）：整卷计时练习，交卷后查看成绩与逐题解析
- **答题与回顾**：客观题自动判分，主观题支持 AI 评分与反馈，可查看历史提交记录
- **优秀解答**：主观题得分率达到优秀标准的作答（英语作文 90%，即 20 分制的 18 分；语文大作文 / 微写作 90%）可按得分展示在本题回顾页，提交时可选择是否允许展示
- **管理员视角**：管理员（打开「管理 → 全部作答记录」，或 `/admin/submissions`）可查看全体用户的作答记录，支持按学科、用户名 / ID、题组关键词、是否待批改筛选与排序；可查看单条作答的作答全文与 AI 批改反馈，也可删除指定记录（二次确认，服务端写审计日志；套卷小节会连同整份套卷一起删除）
- **题库管理**（管理 → 题库管理，或 `/admin/questions`，网站管理员与题目审核管理成员可用）：编辑页按「基本信息 / 题组正文 / 单题」三个板块组织：基本信息管标题、学科 / 类别 / 题型、年级、来源、作答模式、标签与封面；题组正文单独编辑阅读材料 / 语料；单题板块逐题改题型、题干、选项、答案、解析、分值、标签、类别 / 年级 / 年份 / 来源。**题组分值只读、由单题分值自动合计**（普通题组取小计、任选一题题组取单题满分，保存单题时服务端重算，保留 .5 这类小数；接口也拒绝直接改题组分值）。题组正文与题干直接编辑 Markdown（支持公式 $...$ 与题库私有填空标签）。每次保存都写入审计日志（`AdminEditLog`：哪个管理员、什么时候、改了哪个题组 / 单题、哪些字段、改动前后内容，封面选用还会记下候选序号与出处），可在「修改记录」页按对象 / 关键词 / 管理员查询。封面与题组信息在同一张卡片里维护：可上传本地图片（服务端用 ImageMagick 转 JPG 并压到 1600px 内），也可以从流水线生成的候选封面里挑任意一张——**不限于分数最高的那张**（候选读自 `.cache/cover/<groupId>.candidates.json`，目录可用 `COVERS_CACHE_DIR` 覆盖；选用时服务端重新下载原图并转存到本地封面目录，源站不可达会明确提示换一张）。题组与单题的**增删、排序**仍由导入脚本负责，页面只改内容
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
| `GXEXERCISE_API_KEY` | `/api/v1` 只读接口的 Bearer key（逗号分隔可配多把，留空则接口 503） |

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

## 开放 API（`/api/v1`）

给脚本、快捷指令、其他站点读取题库用的一套**只读**接口，Bearer 鉴权，不依赖浏览器登录态。
配置：`.env` 里加 `GXEXERCISE_API_KEY=<随机 48 位十六进制>`（逗号分隔可配多把）。

| 接口 | 说明 |
|------|------|
| `GET /api/v1/health` | 健康检查（公开，不需要 key） |
| `GET /api/v1/meta` | 学科 / 类别 / 路由 slug / 考区枚举 |
| `GET /api/v1/questions` | 题组列表（筛选 + 分页，只回元信息） |
| `GET /api/v1/questions/<groupId>` | 题组详情（含题干、选项、答案、解析） |
| `GET /api/v1/test-papers` | 套卷列表 |
| `GET /api/v1/test-papers/<id>` | 套卷结构（按顺序展开题组与单题） |
| `GET /api/v1/stats` | 题库规模总览 |

```bash
curl -fsS "https://ti.gxwtf.cn/api/v1/questions?subject=math&pageSize=5" \
  -H "Authorization: Bearer $GXEXERCISE_API_KEY"
```

字段、筛选参数与错误码见开发文档 [开放 API](https://dev.gxwtf.cn/#/gxexercise/api)。

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
    admin/                            # 管理后台：全部作答记录 / 题库管理（题组列表、编辑页、修改记录）
    api/                              # 会话、统计、提交、AI 批改、题库编辑等接口
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

## 题库管理权限

「题库管理」（`/admin/questions/**`）不等于「网站管理员」：

- 网站管理员（SSO `admin`）默认可用；
- 另外维护一份**题目审核管理**（表 `QuestionBankReviewer`，按广学账号用户名存放），名单里的同学登录后也能看、能改题目；
- 名单由网站管理员在「题库管理 → 审核名单」（`/admin/questions/reviewers`）里增删，变更会记入修改记录；
- 审核同学看不到「全部作答记录」等其他管理员页面，只能进题库管理相关页面；
- 权限在页面与接口里都校验（接口返回 401/403），不依赖前端隐藏。

## 数据模型概览

- `Question`：单题，含题型、题干、选项、答案、解析、学科、类别、来源、年份、标签等
- `QuestionGroup` / `GroupItem`：题组及其与单题的有序关联（阅读理解、完形填空等）
- `TestPaper` / `PaperItem`：套卷及其包含的题组 / 单题
- `QuestionSubmission`、`QuestionGroupSubmission`、`TestPaperSubmission`：三级提交记录，主观题提交带 `gradingStatus`（`pending` 等）与 `aiFeedback`
- `User`：用户 ID 来自 SSO 账号中心，本地仅保存提交关联
- `QuestionBankReviewer`：题目审核管理（用户名 + 备注 + 添加人），决定谁能管理题库
- `AdminEditLog`：题库编辑审计日志，记录管理员（SSO userId / 用户名）、动作（修改题组 / 修改单题 / 上传封面 / 移除封面）、对象（题组 / 单题 + 标题或题干摘要 + 所属题组）、字段级 `changes`（改动前后预览与原文长度）、来源 IP 与时间；与业务更新同事务写入

## AI 批改说明

- 学生提交后，客观题即时判分；需 AI 批改的提交写入 `pending` 状态
- 服务启动时通过 `instrumentation.ts` 运行 [grading-worker.ts](src/lib/grading-worker.ts)，每 10 秒轮询待批改记录，按题型匹配提示词并调用大模型
- 提示词配置位于 [src/lib/grading-prompts](src/lib/grading-prompts)，包含系统提示词、用户提示词模板及 `config.json`；模板支持 `{stem}`、`{userAnswer}`、`{correctAnswer}`、`{maxScore}` 占位符
- 也可调用 `/api/ai/retry-pending` 手动触发重试

### 阅读表达（40-43）的判分口径

阅读表达题组固定 4 题、满分 12（2 + 2 + 3 + 5），四题各有一套规则，写在
[reading-expression/config.json](src/lib/grading-prompts/reading-expression/config.json)：

| 题号 | `orderIndex` | 满分 | `scoring` | 规则 |
| --- | --- | --- | --- | --- |
| 40 / 41 | 0 / 1 | 2 | `info-points` | 信息点制：每个信息点分值 = 满分 ÷ 信息点数，缺一个扣其分值；多写/说反的信息每处 −0.5；语言错误每处 −0.5（整题最多 −1） |
| 42 | 2 | 3 | `underline-fix` | 划线 1 分（必须完整 chunk，否则 0 分）+ 修改 2 分（三档 2/1/0）；划线错了照样判修改（海淀标准）；修改里夹带无关内容每处 −0.5；语言错误每处 −0.5（整题最多 −1） |
| 43 | 3 | 5 | `essay-weights` | 按作文标准：内容 2 + 语言 2 + 结构 1；每个维度只给 0.5 的整数倍；必须是完整段落，第一句不完整 → 结构最多 0.5，条目式碎片 → 结构 0；**超字数不扣分**（与作文口径一致） |

**关键实现**：模型只输出「结构化判断」（`infoPoints`/`hit`/`redundant`/`grammarErrors`、`underlineCorrect`/`underlineComplete`/`fixLevel`、`subScores`），
分数一律由 [reading-expression-score.ts](src/lib/reading-expression-score.ts) 确定性算出 —— 小模型的减法不可靠，
且规则要求「最低 0 分、绝不出现负数」。改 prompt 时如果新增字段，记得同步该文件的解析。

回归：`pnpm check:reading`（[scripts/check-reading-expression.mts](scripts/check-reading-expression.mts)）会串行跑 12 条样例
（含 40/41 的四个算例、42 的划线/修改组合、43 的完整段落 / 首句截断 / 碎片 / 超字数），有 FAIL 时退出码为 1。
提示词 `.md` 是**运行时按 `process.cwd()` 读取**，改完重启服务即可生效；`config.json` 是打包进产物，改它必须重新 `pnpm build`。

## 题目 PDF 导出

题库的 PDF 全部由**服务端生成**（`src/lib/pdf/`，HTML → LibreOffice headless 转 PDF），前端只放下载链接。

| 场景 | 路由 | 内容 |
| --- | --- | --- |
| 单题回顾 | `/question/<题组 id>/review/<题号>/pdf` | 题目 + 我的作答 + 正确答案 / AI 反馈 + 解析 |
| 题组纸质作答卷 | `/question/<题组 id>/paper/pdf` | 只印题组材料与单题，按考试卷版式留白（无答案） |
| 套卷纸质作答卷 | `/test-paper/<套卷 id>/paper/pdf` | 整卷：封面信息（满分 / 时长 / 姓名班级栏）+ 按类别分大题 + 连续题号 |
| 套卷原始 PDF | `/api/test-paper/<id>/pdf` | 入库时抓到的原卷 PDF（`find-source-pdf.ts` 按标题模糊匹配素材目录） |

原卷匹配（`src/lib/pdf/find-source-pdf.ts`）的两个坑，改之前先看：

- 素材目录的卷别是 `一模 / 二模 / 上期中 / 下期中 / 上期末 / 下期末 / 真题`，**新增卷别目录必须同步
  `TYPES`**，否则该卷别的卷压根不进索引；
- 标题与文件名只差一个字时相似度也有 0.92，所以除了索引，还要过 `conflicts()` 这关：卷别
  （期中≠期末、一模≠二模）或学期（上≠下）对不上的候选直接排除。曾因此把「海淀期中」发成「海淀期末」。
- 回归：`pnpm check:source-pdf`（`scripts/check-source-pdf.mts`）会遍历库里所有套卷，报表「未找到」
  和「卷别/学期错配」，有错配时退出码为 1。

「纸质作答卷」的版式约定（改 `src/lib/pdf/paper-doc.ts` 前先看）：

- 选择题：题干后留「（　　）」作答括号，选项一行排开；题干里已带括号的不重复补
- 填空题：题干里的 `<Input2>` / `<Input>` / `<ClozeBlank>` / `<Blank>` 统一印成 `___3___`（题号与前缀对齐）
- 主观题：按题型和分值给带横线的作答区（作文 22 行、英语写作 14–16 行、阅读表达 3–6 行）
- 图片版题目（化学 `<QImg>`）：按 300dpi 原始像素换算宽度、铺满版心
- 整卷按 `category` 把连续题组合并成「一、完形填空（第 1-20 题，共 20 单题，共 30 分）」，作文类另起一页

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

**套卷标题约定（重要）**：`TestPaper.title` 一律以学科名结尾，如 `2026北京海淀高三（上）期中数学`。
各科解析产物本来就带，只有英语的 `paper.title` 一直是 `2026北京海淀高三（上）期中`（没有「英语」），
所以英语的两个入库脚本（`scripts/import-english-json.ts`、`problem_generate/import-exam.ts`）在写库前
统一过一遍 `paperTitleWithSubject()`（`src/constants/subjects.ts`，幂等，已有学科名不会再补）。
`scripts/sync-json-to-db.ts` 找套卷时对两种标题都兼容，老库/新库都能匹配。

英语 JSON 有两个根目录，`--type` 批量时都会找：老的 `output_json/<类型>/英语/`、
新的 `output_json_english/<类型>/`（2026 上学期的期中卷只在后者）。

```bash
npx tsx problem_generate/import-exam.ts "<json 文件或目录>"      # 导入（新建套卷）
npx tsx problem_generate/import-exam.ts --delete "<套卷标题>"     # 删除某套
npx tsx problem_generate/import-exam.ts --delete --all            # 删除全部英语内容
```

⚠ **导入不是幂等的**：同一份 JSON 导两次会得到两套同名套卷，`--delete "<标题>"` 会按标题
删除（连同该卷的作答记录）。重复导入前请先删同名套卷。

### 化学：非选择题按题型拆组（物质结构与性质 / 化学反应原理 / 有机化学基础 / 工业流程 / 实验探究）

化学图片版套卷里，选择题是一个大组，**非选择题一题一组**（和生物一致）：组名 `<卷>·第N题`，
题型（物质结构与性质 / 化学反应原理 / 有机化学基础 / 工业流程 / 实验探究，即
`src/constants/subjects.ts` 中 `categoryToRoute['化学']` 的键）放在题组的 `category` 上，题库导航可直接筛。
题型由流水线分类器 `exam-parser/chem_category.py` 给出（`paper.json` 每题带 `category` + `score`）：

- **题型按内容判**（关键词打分：结构/原理/有机/流程/探究各自一套强标记词，强标记权重 3、普通词 1）；
  2021+ 用位置（15结构 16原理 17有机 18流程 19探究）当先验，内容能明确判定时覆盖位置；
  2020 及以前纯内容判、判不准才退老卷位置表（25-28 / 8-11 序）。

```bash
python3 ~/jingshibang/exam-parser/chem_category.py --all --json /tmp/chem_categories.json
npx tsx scripts/split-chemistry-fill.ts --map /tmp/chem_categories.json --dry-run      # 先看分类表
npx tsx scripts/split-chemistry-fill.ts --map /tmp/chem_categories.json --apply        # 原地搬家，不换题 id
npx tsx scripts/split-chemistry-fill.ts --map <json> --paper "<卷名>" --apply --force   # 改完分类重跑单卷
npx tsx scripts/repair-chemistry-groups.ts --apply   # 分组被误伤时按 Question.source 找回孤儿题
```

`--apply` 只做「每题建一个组 + 题目原地搬组 + 删掉空的旧组 + 重排套卷顺序 + 重算分值」，
**不动选择题组**，题目 id 不变（作答 / 优秀解答引用不受影响）。

### 整卷学科（生物 / 历史 / 地理 / 政治）：`scripts/import-subject-json.ts`

这四科是「选择题一组 + 一个大题一个 section」的同构结构（材料挂在题组 `content`，
小问是 `<Input>/<InputLong>` 的「空」），统一用一个泛化入库脚本（`import-biology-json.ts` 的泛化版）：

```bash
npx tsx scripts/import-subject-json.ts --subject 历史 --type 一模 --dry-run    # 结构自检 + 缺图/分值/答案
npx tsx scripts/import-subject-json.ts --subject 地理 --type 一模 --manifest ~/backups/imp.json
npx tsx scripts/import-subject-json.ts --subject 政治 --file <json> --force    # 重导：作答快照→映射→重建
npx tsx scripts/import-subject-json.ts --subject 政治 --delete "<套卷标题>"
npx tsx scripts/import-subject-json.ts --rollback ~/backups/imp.json          # 按清单整批回退
```

- `--dry-run` 的自检会逐卷报：内联空个数≠小问数、小问无参考答案/分值≤0、选择题答案不在选项内、
  题组小问合计≠大题分值、卷面总分≠题组合计、`/exam-images/**` 引用的图不在磁盘上（含「（教师版）」目录变体）。
- `--force` 重导**不会丢作答**：先快照旧题组与作答，按「题组名 + 题干内容指纹」映射到新 id 重建
  （没有作答的旧题组不参与映射，所以「按模块分组的老卷 → 按大题分组的新卷」也能过）；
  映射不上直接中止，确实要丢弃才加 `--drop-submissions`。
- `--manifest` 会记录本次导入的 `{subject,title,paperId}`，`--rollback` 按它整批删除（用于试跑回退）。

### 批量维护题库数据

本仓库只负责「JSON → 数据库」这一步。上游（爬取菁师帮新卷、docx → md → JSON、校验、批量入库、
存量题干回填）由 `/home/gxwtf/jingshibang` 的流水线脚本负责，操作手册见
`/home/gxwtf/jingshibang/README.md`：

| 脚本 | 用途 |
| --- | --- |
| `jingshibang/check_missing.py` | 仅爬取线上新增的卷子（只下载缺失部分） |
| `jingshibang/update_bank.py` | 按卷子跑 md → JSON → 校验 → 入库（`--list` 可看进度，`--replace` 覆盖同名套卷） |
| `jingshibang/exam-parser/backfill_re_stems.py` | 用 md 重算「阅读表达」题干并回填 `Question.content`（不调 AI） |

### JSON 修好之后：原地回灌生产库（`scripts/sync-json-to-db.ts`）

上游 `exam-parser/qa_scaffold.py --repair --apply` 修完 JSON（空答案、答案不在选项内、图片路径、
分值兜底等，逐卷留痕 `<卷>.review.txt`）之后，生产库里的相应题目**还是旧数据**。
用 `scripts/sync-json-to-db.ts` 把 JSON 原地同步进去——**只 update，不 delete / create**，
题目与题组的 ID 都不变，所以作答记录（`QuestionSubmission` / `QuestionGroupSubmission`）原样保留。

```bash
npx tsx scripts/sync-json-to-db.ts --subject 语文 --type 二模 --dry-run     # 先看「将变更条数」
npx tsx scripts/sync-json-to-db.ts --subject 语文 --type 二模 --apply       # 真正写库
npx tsx scripts/sync-json-to-db.ts --subject 英语 --type 一模 --file <json> --apply
npx tsx scripts/sync-json-to-db.ts --subject 数学 --type 二模 --apply --report /tmp/sync-数学.md
```

- **JSON 根**（按学科自动选）：英语 → `output_json/<类型>/英语/`；语文 → `output_json_chinese/<类型>/`；
  政治 → `output_json_politics/<类型>/`；数学 / 物理 / 化学 → `output_json_math/<类型>/<学科>/`。
- **结构自动识别**：`sections`（英语 / 数学 / 物理 / 化学）与 `groups`（语文 / 政治）都支持。
- **匹配口径**（与 `sync-math-json.ts` 一致，找不到就跳过，**绝不用「新建」兜底**）：
  1. `TestPaper`：`title = paper.title`（或文件名去 `.json`）且 `subject` 一致，找不到记「库中缺卷」；
  2. 题组：`PaperItem.orderIndex` 顺序对 JSON 的 section / group 顺序，**两边数量不等就跳过整卷**（顺序不可信时不冒错位的险）；
  3. 单题：`GroupItem.orderIndex` 顺序对 JSON questions 顺序，数量不等则跳过该题组。
- **写哪些字段**：`Question.content / options / answer / analysis / score`；
  `QuestionGroup.title / content / category / score`（题组标题沿用该卷既有命名法：
  「卷名·分类」的继续用分类，英语那种「节标题」的继续用节标题，**试卷名一律不改**）。
- **图片**：JSON 里若是相对 `images/x.png` → 改写为 `/exam-images/<类型>/<学科>/<卷>/images/x.png`；
  链接目标里的空格与 ASCII 括号做百分号编码（否则 CommonMark 会把图片链接截断）。
- 几个保守约定：JSON 里为空的字段**不覆盖**库里的值（防抹掉人工补充内容）；选项 ID 大小写沿用库里的
  （英语 / 语文 / 数学是 `a/b/c`，物理是 `A/B/C`），只换 label，避免动到学生作答里存的 ID；
  题组分值优先取 JSON `score`，缺失时才用单题合计；库中该卷若是**图片版**（题面 `<QImg>`，化学就是这种情况）
  而 JSON 是文本版，不同源，直接跳过并记警告。
- 跑完 `--dry-run` 应显示「需变更 0」（幂等），可据此确认库与 JSON 已一致。
- 化学注意：库里 108 份化学卷都是**图片版**（`output_image_questions`，题面 `<QImg>`），
  `output_json_math/<类型>/化学` 是文本版，两者不同源，本脚本会全部跳过。
