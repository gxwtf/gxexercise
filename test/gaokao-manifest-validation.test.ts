import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadAndValidateManifest,
  ManifestValidationError,
} from "../scripts/gaokao/lib/validate-manifest";

test("malformed records return structured validation issues", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gxexercise-manifest-"));
  const manifest = path.join(directory, "invalid.jsonl");
  await writeFile(
    manifest,
    `${JSON.stringify({
      schema_version: 1,
      source: {},
      paper: {},
      section: { sort_order: 2_147_483_648 },
      questions: [{}],
    })}\n`,
    "utf8",
  );

  try {
    await assert.rejects(
      loadAndValidateManifest(manifest),
      (error: unknown) =>
        error instanceof ManifestValidationError &&
        error.issues.some((issue) => issue.includes("section.sort_order")),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
