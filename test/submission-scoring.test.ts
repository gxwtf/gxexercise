import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeInputAnswer,
  normalizeMultipleAnswer,
  normalizeSingleAnswer,
  parseGroupSubmissionInput,
  prepareGroupSubmission,
  type ScorableQuestion,
} from "../src/app/api/submissions/group/submission-logic";

const questions: ScorableQuestion[] = [
  { id: "single", questionType: "single", answer: "b", score: 2 },
  { id: "multiple", questionType: "multiple", answer: "A,C", score: 3 },
  { id: "input", questionType: "input", answer: "has been held", score: 4 },
];

test("normalizes supported automatically graded answers", () => {
  assert.equal(normalizeSingleAnswer("  b "), "B");
  assert.equal(normalizeMultipleAnswer(" c、A，a "), "A,C");
  assert.equal(normalizeMultipleAnswer("CA"), "A,C");
  assert.equal(normalizeInputAnswer("  has   been\t held  "), "has been held");
  assert.equal(normalizeInputAnswer("Ａ， Ｂ"), "A,B");
});

test("parses a request without trusting its userId", () => {
  const parsed = parseGroupSubmissionInput({
    userId: 999,
    questionGroupId: " group-1 ",
    duration: 12,
    questionSubmissions: [
      { questionId: "single", content: { answer: "B", ignored: true } },
    ],
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.value, {
    questionGroupId: "group-1",
    duration: 12,
    questionSubmissions: [{ questionId: "single", answer: "B" }],
  });
  assert.equal("userId" in parsed.value, false);
});

test("rejects duplicate question ids before scoring", () => {
  const parsed = parseGroupSubmissionInput({
    questionGroupId: "group-1",
    questionSubmissions: [
      { questionId: "single", content: { answer: "A" } },
      { questionId: " single ", content: { answer: "B" } },
    ],
  });

  assert.deepEqual(parsed, {
    ok: false,
    error: "Duplicate questionId: single",
  });
});

test("rejects question ids that are not members of the group", () => {
  const prepared = prepareGroupSubmission(questions, [
    { questionId: "another-group-question", answer: "A" },
  ]);

  assert.deepEqual(prepared, {
    ok: false,
    error: "Question does not belong to group: another-group-question",
  });
});

test("grades single, multiple, and input answers using normalized comparison", () => {
  const prepared = prepareGroupSubmission(questions, [
    { questionId: "single", answer: " B " },
    { questionId: "multiple", answer: "c,a" },
    { questionId: "input", answer: " has   been held " },
  ]);

  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.value.score, 9);
  assert.equal(prepared.value.isCorrect, true);
  assert.equal(prepared.value.correctNum, 3);
  assert.equal(prepared.value.totalNum, 3);
  assert.deepEqual(
    prepared.value.submissions.map(({ score, isCorrect }) => ({ score, isCorrect })),
    [
      { score: 2, isCorrect: true },
      { score: 3, isCorrect: true },
      { score: 4, isCorrect: true },
    ],
  );
});

test("keeps free-form questions pending human grading", () => {
  const prepared = prepareGroupSubmission(
    [{ id: "essay", questionType: "text", answer: "reference", score: 10 }],
    [{ questionId: "essay", answer: "student response" }],
  );

  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.value.score, null);
  assert.equal(prepared.value.isCorrect, null);
  assert.equal(prepared.value.correctNum, 0);
  assert.deepEqual(prepared.value.submissions[0], {
    questionId: "essay",
    content: { answer: "student response" },
    score: null,
    isCorrect: null,
  });
});

test("does not mark a partial objective submission as all-correct", () => {
  const prepared = prepareGroupSubmission(questions, [
    { questionId: "single", answer: "b" },
  ]);

  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.value.score, 2);
  assert.equal(prepared.value.isCorrect, false);
  assert.equal(prepared.value.correctNum, 1);
  assert.equal(prepared.value.totalNum, 3);
});

test("leaves an auto-gradable type pending when its answer key is empty", () => {
  const prepared = prepareGroupSubmission(
    [{ id: "missing-key", questionType: "single", answer: "", score: 2 }],
    [{ questionId: "missing-key", answer: "A" }],
  );

  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.value.score, null);
  assert.equal(prepared.value.isCorrect, null);
  assert.equal(prepared.value.submissions[0].isCorrect, null);
});

test("does not mark an empty group as correct", () => {
  const prepared = prepareGroupSubmission([], []);

  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.value.score, 0);
  assert.equal(prepared.value.isCorrect, false);
  assert.equal(prepared.value.totalNum, 0);
});
