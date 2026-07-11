import assert from "node:assert/strict";
import test from "node:test";

import { buildGaoKaoMathRecord } from "../scripts/gaokao/lib/gaokao-math";

const source = {
  key: "fixture-math",
  name: "Fixture Math",
  url: "https://example.test/math",
  revision: "abc123",
  snapshotSha256: "a".repeat(64),
  retrievedAt: null,
  licenseSpdx: "MIT",
  rightsStatus: "review_required" as const,
};

test("maps a translated Shanghai math row into review-gated staging", () => {
  const result = buildGaoKaoMathRecord({
    row: {
      id: 100,
      problem: "Which answer is correct? A. one B. two C. three D. four",
      answer: "B",
      score: 4,
      year: "2025",
      number: "1",
      province: "Shanghai",
    },
    source,
    sourceFile: "test.jsonl",
  });

  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.record.paper.paper_key, "gaokao:2025:province-shanghai:mathematics");
  assert.deepEqual(result.record.paper.regions, [{ code: "shanghai", name: "上海" }]);
  assert.equal(result.record.questions[0].question_type, "choice");
  assert.equal(result.record.section.review_status, "review_required");
  assert.equal(
    (result.record.section.metadata as Record<string, unknown>).source_language,
    "en",
  );
});

test("rejects unverified province labels instead of guessing", () => {
  const result = buildGaoKaoMathRecord({
    row: {
      id: 1,
      problem: "Question",
      answer: "1",
      score: 4,
      year: "2025",
      number: "1",
      province: "Unknown",
    },
    source,
    sourceFile: "test.jsonl",
  });
  assert.deepEqual(result.valid ? [] : result.errors, ["unsupported_or_unknown_province"]);
});
