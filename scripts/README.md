# scripts/

## `cover-from-group.ts` —— 给题组找封面（裸正文 → article-cover → 可选写回 imageUrl）

一个可重复调用的命令：读题组和子题 → 把 MDX 正文压成一篇「裸英文文章」→ 调
`/home/gxwtf/article-cover` 找封面候选 → 需要时把某张封面的 `image_url` 写回
`QuestionGroup.imageUrl`。**默认不改库**。

### 用法（在 `/home/gxwtf/gxexercise` 仓库根）

```bash
# 只看裸正文 + 校验结果（不调 article-cover、不写库，秒出；调抽取逻辑时用这个）
npx tsx scripts/cover-from-group.ts --group <groupId> --extract-only

# 抽正文 + 调 article-cover 拿封面候选（终端打印正文前 300 字 / 词数 / 校验 / 封面简表）
npx tsx scripts/cover-from-group.ts --group <groupId>
npx tsx scripts/cover-from-group.ts --group <groupId> --max-results 3 --no-clip --no-cache

# 预览写库 SQL（dry-run，不改数据）
npx tsx scripts/cover-from-group.ts --group <groupId> --write 1

# 真正写库（唯一会改数据的形态）
npx tsx scripts/cover-from-group.ts --group <groupId> --write 1 --apply
```

| 参数 | 说明 |
| --- | --- |
| `--group <id>` | 题组 id（必填） |
| `--extract-only` | 只抽正文 + 校验，不调 article-cover，也不写库 |
| `--max-results <1..5>` | 透传给 article-cover（默认 5） |
| `--no-clip` / `--no-cache` | 透传：关 OpenCLIP 排序 / 绕过磁盘缓存 |
| `--apply` | 才真正 UPDATE；不带就是 dry-run |
| `--write <N\|best>` | **默认就是 `best`**（分数最高那张）；`--write 2` 改成第 2 张 |
| `--no-write` | 完全不写库、也不生成候选清单（只看效果时用） |
| `--top <1..5>` | 保留前 N 张候选到 `<id>.candidates.json`（默认 5，供以后人工换封面） |
| `--reuse-json` | 已有 `.cache/cover/<id>.json` 时不重跑 article-cover |
| `--show-body <n>` | 打印裸正文前 n 字符（默认 300，0 = 不打印） |

产物（`.cache/cover/`，已被 `.gitignore` 忽略）：

- `<groupId>.txt` —— 裸正文（也就是喂给 article-cover 的「文章」）
- `<groupId>.json` —— article-cover 的完整结果（`article_analysis` / `covers` / `meta`）
- `<groupId>.candidates.json` —— **保留的前 N 张候选**（含 `selected` 标记），以后人工换封面就看这份

### 封面审阅页（可选）

```bash
# 汇总已跑过的题组 → .cache/cover/gallery/index.html
npx tsx scripts/cover-gallery.ts --groups <id1>,<id2>,<id3>
npx tsx scripts/cover-gallery.ts --all

# 起个临时端口看效果（仅内网/隧道可达）
python3 -m http.server 8123 --bind 0.0.0.0 --directory .cache/cover/gallery
# 外部机器：ssh -N -L 8123:127.0.0.1:8123 gxwtf@39.105.54.184 -p 6000 → 浏览器开 http://127.0.0.1:8123/
```

### 三类题的裸正文怎么来

| 题型 | 策略 |
| --- | --- |
| `en-reading` / `reading-expression` | 按 `# A` / `# B` 切顶层材料段，每段**从第一个题干（`（1）`/`1．`/`72.`）或 A–D 选项区块起全部截掉**，剩下的材料拼成连贯正文 |
| `cloze` 完形填空 | 第 n 个 `<ClozeBlank></ClozeBlank>` ↔ `orderIndex` 第 n 个子题；答案（字母）按该题 `options` 解析成选项文本后**填回原文** |
| `seven-choose-five` 七选五 | 第 n 个 `<Blank></Blank>` ↔ `orderIndex` 第 n 个子题；答案 A–G 按该题 `options`（必要时取全体子题选项并集）解析成句子文本后**填回原位** |
| 其他（`grammar` / `word-choice` / `en-writing`…） | 未做专门处理：按「截题目区 + 通用清洗」，抽不出足够英文词数就**报错退出** |

清洗规则：去 MDX（`**`、`#`、`<Component>`、`![]()`、表格竖线）、去 KaTeX、去中文注音括号
（`(脉搏)` `（逻辑）`，换成空格而不是删掉，避免 `logic`+`of` 粘成 `logicof`）、英文正文里的全角标点
规范成 ASCII、压缩连续空白。

### 校验（写死在脚本里，不放宽）

- 裸正文不得残留 `___`、`（1）`/`(1)`、`①`、`A．`、`# ` 标题、MDX 组件、`![]()`、`$…$`、没填上的空位；
- 完形 / 七选五的空位必须**全部**填上，任何一个没填上就 `exit 1`，绝不产出半成品；
- 英文词数低于 40（完形/七选五低于 100）视为抽取失败。

退出码：`0` 成功；`1` 抽取/校验失败；`2` 参数、数据库或 article-cover 调用错误。

### 注意

- `/home/gxwtf/article-cover` 是**只读调用**的独立项目（独立 venv），本脚本不改它任何文件。
  可用环境变量覆盖路径：`ARTICLE_COVER_PYTHON`、`ARTICLE_COVER_MAIN`、`ARTICLE_COVER_TIMEOUT_MS`。
- 单次调用约 20–30s（LLM 分析 + Pixabay 搜索 + OpenCLIP 排序）。
- `imageUrl` 目前全库为 NULL；**开发调试一律不要带 `--apply`**。
- article-cover 的 `warnings` 里常驻 `PEXELS_API_KEY is missing`，是已知的正常状态（只配了 Pixabay）。
