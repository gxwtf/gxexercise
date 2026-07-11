#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "./lib/normalize";

interface SummarySource {
  key: string;
  revision: string;
  snapshotSha256: string;
  rightsStatus: string;
}

interface SnapshotSummary {
  schema_version: number;
  year_range: { from: number; to: number };
  manifest_sha256: string;
  record_count: number;
  child_question_count: number;
  paper_count: number;
  quarantine_count: number;
  metadata_override_count: number;
  coverage_year_totals: Record<string, number>;
  sources: SummarySource[];
}

function comparable(value: SnapshotSummary): SnapshotSummary {
  return {
    schema_version: value.schema_version,
    year_range: value.year_range,
    manifest_sha256: value.manifest_sha256,
    record_count: value.record_count,
    child_question_count: value.child_question_count,
    paper_count: value.paper_count,
    quarantine_count: value.quarantine_count,
    metadata_override_count: value.metadata_override_count,
    coverage_year_totals: value.coverage_year_totals,
    sources: value.sources.map((source) => ({
      key: source.key,
      revision: source.revision,
      snapshotSha256: source.snapshotSha256,
      rightsStatus: source.rightsStatus,
    })),
  };
}

function main(): void {
  const summaryFile = path.resolve(
    process.argv[2] ?? ".cache/gaokao/2016-2025.jsonl.summary.json",
  );
  const expectedFile = path.resolve(
    process.argv[3] ?? path.join(import.meta.dirname, "expected-snapshot.json"),
  );
  const actual = comparable(
    JSON.parse(fs.readFileSync(summaryFile, "utf8")) as SnapshotSummary,
  );
  const expected = comparable(
    JSON.parse(fs.readFileSync(expectedFile, "utf8")) as SnapshotSummary,
  );

  if (stableStringify(actual) !== stableStringify(expected)) {
    throw new Error(
      `Snapshot verification failed. Actual summary does not match ${expectedFile}`,
    );
  }

  process.stdout.write(`${JSON.stringify({
    verified: true,
    summary: summaryFile,
    expected: expectedFile,
    manifest_sha256: actual.manifest_sha256,
    records: actual.record_count,
    questions: actual.child_question_count,
  })}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
