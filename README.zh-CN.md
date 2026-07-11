# 广学题库（gxexercise）

这是一个基于 Next.js 和 PostgreSQL/Prisma 的题库项目。

[English](README.md)

## 高考真题导入

仓库包含一套可审计、可重复执行的高考题目导入流程：它读取固定版本的公开来源，生成确定性的 JSONL 清单，先导入与线上题库隔离的 `Bank*` 暂存表，再经过版权、内容和资源审核后显式发布。

当前快照覆盖 2016–2025 年的部分公开题目，**并不等同于近十年全部省份、全部科目的完整真题库**。其中 2025 年仅含一小部分翻译后的上海数学题；缺口、冲突候选和隔离条目见[覆盖范围与已知缺口](docs/gaokao-coverage.md)。完整操作说明见[导入运行手册](scripts/gaokao/README.md)。

导入不会自动写入现有题目接口所使用的公开题表，也不会自动发布或批准内容。这一边界避免未完成版权和内容审核的原始材料被客户端展示。

## 本地开发

```powershell
pnpm install
pnpm dev
```

设置 `DATABASE_URL` 后，可在新数据库部署迁移：

```powershell
pnpm db:migrate:deploy
```

对于过去仅使用 `prisma db push`、且没有 `_prisma_migrations` 记录的既有数据库，必须先确认它与变更前的 schema 一致，再执行一次基线标记，随后部署增量迁移：

```powershell
pnpm exec prisma migrate resolve --applied 20260711000000_baseline
pnpm db:migrate:deploy
```

不要在空数据库或已漂移的数据库上标记基线。

## 构建与校验导入清单

按照运行手册检出 `sources.json` 固定的来源版本后：

```powershell
pnpm exec tsx scripts/gaokao/build-manifest.ts `
  --bench-root ..\.cache\GAOKAO-Bench `
  --updates-root ..\.cache\GAOKAO-Bench-Updates `
  --gaokao-math-root ..\.cache\FrankieYao-GaoKaoMath `
  --from-year 2016 `
  --to-year 2025 `
  --output .cache\gaokao\2016-2025.jsonl

pnpm gaokao:validate-manifest .cache\gaokao\2016-2025.jsonl
pnpm gaokao:verify-snapshot .cache\gaokao\2016-2025.jsonl.summary.json
```

示例的中英文 seed 文件也可只读校验：

```powershell
pnpm gaokao:validate-seeds prisma\seed-english.json prisma\seed-chinese.json
```

## 远程导入的安全确认

先生成计划并人工审阅：

```powershell
pnpm gaokao:plan -- --manifest .cache\gaokao\2016-2025.jsonl --plan-output .cache\gaokao\plan.json
```

实际写入前，必须使用计划输出的四个 SHA-256 值进行绑定确认：清单、操作计划、目标数据库身份和远程库存。详见运行手册的“Apply the exact reviewed plan”一节。即使使用 `--allow-review-required`，数据也只会进入暂存表，不会发布。

## 质量与可追溯性

- 每条来源、试卷、分区和题目都保留来源键、修订版、指纹和元数据。
- 相同内容会被幂等跳过；内容或来源信息不一致会产生冲突，不能静默覆盖。
- 导入过程有 PostgreSQL 咨询锁、分批事务和 `BankIngestRun` 审计记录。
- 仅来自已完成导入运行、且版权、内容、资源审核通过的数据，才能被显式发布。
