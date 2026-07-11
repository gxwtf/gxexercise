# 可审计的高考题目导入

[English](README.md)

该流程会生成确定性的 JSONL 清单，并导入与公开题库隔离的 `Bank*` 暂存表。它支持增量导入，但不会调用用于本地演示且具有破坏性的旧 seed 脚本。

## 1. 准备固定版本的来源

将来源仓库放在应用仓库外，并检出 `sources.json` 中的精确 revision：

```powershell
git clone https://github.com/OpenLMLab/GAOKAO-Bench ..\.cache\GAOKAO-Bench
git -C ..\.cache\GAOKAO-Bench checkout 6dbb24f8d8439041e5431c4c184a582182a6ce9c
git clone https://github.com/OpenLMLab/GAOKAO-Bench-Updates ..\.cache\GAOKAO-Bench-Updates
git -C ..\.cache\GAOKAO-Bench-Updates checkout a606c88ab6039f9282d5135c767e13bc0ec99079
git clone https://huggingface.co/datasets/FrankieYao/GaoKaoMath ..\.cache\FrankieYao-GaoKaoMath
git -C ..\.cache\FrankieYao-GaoKaoMath checkout 4b994833f5fa730d9967f450b5a4454173afdc52
```

构建器会拒绝其他 revision；`--allow-unpinned` 只可用于排查，不能将其输出写入远程库。

## 2. 构建并校验清单

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

输出目录已被 Git 忽略。应提交来源配置、精确元数据修正、代码、测试和覆盖说明；不要提交第三方题目内容。摘要会给出清单哈希、零覆盖年份、隔离数和重复/冲突候选。

暂存分区的排序值由来源键稳定推导，而不是当前快照的排名。因此未来补充缺失记录不会改变既有内容指纹；自然试卷顺序只在审核发布时写入。

## 3. 校验示例 seed 格式

```powershell
pnpm gaokao:validate-seeds prisma\seed-english.json prisma\seed-chinese.json
```

中英文示例覆盖分组题选项、说明、填空索引、空子题题干和 `subject`/`subjects` 根字段别名。附加文件可以追加到同一命令；该校验不会写入数据库。

## 4. 部署数据库迁移

设置目标数据库的 `DATABASE_URL` 并先备份。新数据库可直接执行完整迁移：

```powershell
pnpm db:migrate:deploy
```

如果既有数据库过去仅由 `prisma db push` 管理且不存在 `_prisma_migrations` 历史，先确认其与变更前 schema 完全一致，再只标记一次基线，然后部署增量迁移：

```powershell
pnpm exec prisma migrate resolve --applied 20260711000000_baseline
pnpm db:migrate:deploy
```

不要在空库或已漂移库上标记基线。增量迁移会预检查旧的排序和提交记录重复项；应修复报告的冲突，不能绕过唯一约束。

## 5. 先生成计划

计划会读取远程库存，但不会写入：

```powershell
pnpm gaokao:plan -- --manifest .cache\gaokao\2016-2025.jsonl `
  --plan-output .cache\gaokao\plan.json
```

计划会报告插入、相同跳过、旧数据候选和阻塞性冲突，并打印四个确认哈希。必须完整审阅计划后才能写入。

## 6. 执行已审阅的精确计划

使用计划输出的四个值：清单、计划、数据库身份和远程库存哈希。

```powershell
$env:GAOKAO_APPLY_CONFIRM = '<manifest-sha256>'
$env:GAOKAO_PLAN_CONFIRM = '<plan-sha256>'
$env:GAOKAO_DATABASE_CONFIRM = '<database-identity-sha256>'
$env:GAOKAO_REMOTE_INVENTORY_CONFIRM = '<remote-inventory-sha256>'
pnpm gaokao:apply -- --manifest .cache\gaokao\2016-2025.jsonl `
  --allow-review-required
```

写入时使用 PostgreSQL 咨询锁、分批事务、来源键幂等、内容指纹冲突检测和 `BankIngestRun` 审计记录。`--allow-review-required` 仅允许写入暂存区，不代表批准或发布。

进程崩溃可能在前几个批次已写入暂存区。下次获得锁的导入会把旧的 `RUNNING` 运行标记为失败；操作员必须重新审阅并确认最新库存和计划哈希。相同记录会跳过，只写入余下记录。

## 发布边界

暂存数据不会被现有题目 API 返回。发布必须拥有已批准的来源权利、内容审核、资源验证，以及带审核者身份和证据的显式 `Bank*Publication` 记录。只有来自 `COMPLETED` 导入运行的数据可以被考虑发布；不得从 `RUNNING` 或 `FAILED` 的部分导入运行发布。不得将原始导入的 MDX 直接渲染到客户端页面。
