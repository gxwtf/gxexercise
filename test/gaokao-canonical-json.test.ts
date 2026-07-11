import assert from "node:assert/strict";
import test from "node:test";

import {
  stablePositiveInt,
  stableStringify,
} from "../scripts/gaokao/lib/normalize";

test("canonical JSON is key-order independent", () => {
  assert.equal(
    stableStringify({ second: [2, 1], first: "value" }),
    stableStringify({ first: "value", second: [2, 1] }),
  );
});

test("canonical JSON rejects values JSON cannot represent", () => {
  assert.throws(
    () => stableStringify({ invalid: undefined }),
    /Unsupported canonical JSON value/,
  );
});

test("staging sort order is stable and fits a PostgreSQL integer", () => {
  const first = stablePositiveInt("source:a");
  assert.equal(first, stablePositiveInt("source:a"));
  assert.ok(first >= 1 && first <= 2_147_483_647);
  assert.notEqual(first, stablePositiveInt("source:b"));
});
