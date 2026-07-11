#!/usr/bin/env tsx

import path from "node:path";

import {
  loadAndValidateManifest,
  ManifestValidationError,
} from "./lib/validate-manifest";

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: pnpm gaokao:validate-manifest <manifest.jsonl>");

  const file = path.resolve(input);
  const manifest = await loadAndValidateManifest(file);
  const paperKeys = new Set(manifest.records.map((record) => record.paper.paper_key));
  const questionCount = manifest.records.reduce(
    (total, record) => total + record.questions.length,
    0,
  );

  process.stdout.write(`${JSON.stringify({
    valid: true,
    file,
    manifest_sha256: manifest.manifestSha256,
    records: manifest.records.length,
    papers: paperKeys.size,
    questions: questionCount,
  })}\n`);
}

main().catch((error: unknown) => {
  if (error instanceof ManifestValidationError) {
    process.stderr.write(`${error.message}\n${error.issues.join("\n")}\n`);
  } else {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  }
  process.exitCode = 1;
});
