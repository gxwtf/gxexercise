# Auditable Gaokao ingestion

[中文](README.zh-CN.md)

This pipeline builds a deterministic JSONL manifest and imports it into isolated
`Bank*` staging tables. It is incremental and does not call the legacy seed
scripts, which are destructive and are intended only for local demo data.

## 1. Prepare pinned sources

Keep source checkouts outside the application repository and checkout the exact
revisions in `sources.json`:

```powershell
git clone https://github.com/OpenLMLab/GAOKAO-Bench ..\.cache\GAOKAO-Bench
git -C ..\.cache\GAOKAO-Bench checkout 6dbb24f8d8439041e5431c4c184a582182a6ce9c
git clone https://github.com/OpenLMLab/GAOKAO-Bench-Updates ..\.cache\GAOKAO-Bench-Updates
git -C ..\.cache\GAOKAO-Bench-Updates checkout a606c88ab6039f9282d5135c767e13bc0ec99079
git clone https://huggingface.co/datasets/FrankieYao/GaoKaoMath ..\.cache\FrankieYao-GaoKaoMath
git -C ..\.cache\FrankieYao-GaoKaoMath checkout 4b994833f5fa730d9967f450b5a4454173afdc52
```

The builder refuses a different revision unless `--allow-unpinned` is supplied.
That escape hatch is for investigation only; do not use its output for a remote
apply.

## 2. Build and validate the manifest

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

The output directory is ignored by Git. Commit source configuration, exact
metadata overrides, code, tests, and coverage documentation—not third-party exam
content. The summary includes the manifest hash, explicit zero-coverage years,
quarantine counts, and duplicate/conflict candidates.

Staging section order is a stable positive integer derived from its source key,
not a rank recalculated from the current snapshot. This lets a later delta add a
missing source record without changing every existing payload hash. Natural exam
order is assigned only when reviewed content is published.

## 3. Validate the supplied seed shapes

The existing English and Chinese seed files exercise group-level options,
instructions, blank indexes, empty child stems, and both `subject` and `subjects`
root aliases:

```powershell
pnpm gaokao:validate-seeds prisma\seed-english.json prisma\seed-chinese.json
```

Additional files can be appended to that command. Validation is read-only.

## 4. Deploy the schema migration

Set `DATABASE_URL` for the intended database and take a backup. A new database
can apply the complete history directly:

```powershell
pnpm db:migrate:deploy
```

For an existing database that was previously managed with `prisma db push` and
has no `_prisma_migrations` history, first verify that it matches the pre-change
schema, then baseline it once before deploying the incremental migration:

```powershell
pnpm exec prisma migrate resolve --applied 20260711000000_baseline
pnpm db:migrate:deploy
```

Do not mark the baseline applied on an empty or drifted database. The incremental
migration has preflight checks for legacy ordering/submission duplicates.
Fix any reported legacy conflict instead of bypassing the unique constraint.

## 5. Plan before applying

Planning reads the remote inventory but does not write it:

```powershell
pnpm gaokao:plan -- --manifest .cache\gaokao\2016-2025.jsonl `
  --plan-output .cache\gaokao\plan.json
```

The plan reports inserts, identical skips, legacy candidates, and blocking
conflicts. It also prints all four required confirmation hashes. Review the full plan
before applying.

## 6. Apply the exact reviewed plan

Set the four values printed by the plan, then run the apply command. The plan
hash binds the exact actions and deterministic targets; the database-identity
hash prevents applying a reviewed plan to a look-alike database; the inventory
hash prevents applying after the remote database has changed:

```powershell
$env:GAOKAO_APPLY_CONFIRM = '<manifest-sha256>'
$env:GAOKAO_PLAN_CONFIRM = '<plan-sha256>'
$env:GAOKAO_DATABASE_CONFIRM = '<database-identity-sha256>'
$env:GAOKAO_REMOTE_INVENTORY_CONFIRM = '<remote-inventory-sha256>'
pnpm gaokao:apply -- --manifest .cache\gaokao\2016-2025.jsonl `
  --allow-review-required
```

Apply uses a PostgreSQL advisory lock, bounded transactions, source-key
idempotency, payload-hash conflict detection, and a `BankIngestRun` audit trail.
`--allow-review-required` only permits insertion into staging; it does not approve
or publish the content.

Bounded transactions mean a process crash can leave earlier batches in staging.
On the next locked apply, stale `RUNNING` runs are marked failed; the operator
must review and confirm the newly computed inventory and plan hashes. Identical
rows are then skipped and only the remaining rows are inserted.

## Publication boundary

Staged rows are deliberately invisible to the existing question APIs. Publishing
requires approved source rights, approved content review, asset verification,
and an explicit `Bank*Publication` record with reviewer identity and evidence.
Only rows covered by a `COMPLETED` ingest run may be considered for publication;
never publish from a `RUNNING` or `FAILED` run after a partial batch failure.
Never materialize raw imported MDX directly into a client-rendered page.
