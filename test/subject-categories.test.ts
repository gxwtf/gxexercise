import assert from "node:assert/strict";
import test from "node:test";
import { categoryForSubjectRoute } from "../src/constants/subjects";

test("resolves duplicate category routes within the current subject", () => {
  assert.equal(categoryForSubjectRoute("物理", "experiment"), "实验题");
  assert.equal(categoryForSubjectRoute("化学", "experiment"), "实验操作");
});
