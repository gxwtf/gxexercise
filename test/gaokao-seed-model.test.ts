import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { normalizeSeedDocument } from "../scripts/gaokao/lib/seed-model";

function readSeed(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.resolve("prisma", name), "utf8"));
}

test("English seed maps group options, blank indexes and empty child stems losslessly", () => {
  const model = normalizeSeedDocument(readSeed("seed-english.json"));
  assert.deepEqual(
    {
      subject: model.subject,
      sections: model.sectionCount,
      questions: model.questionCount,
      score: model.totalScore,
      hash: model.canonicalJsonHash,
    },
    {
      subject: { code: "english", name: "英语", sourceField: "subjects" },
      sections: 6,
      questions: 39,
      score: 235,
      hash: "6c4d7591eba16d6febeabcc865994d74a36c1b4427c803b77517205b7850e599",
    },
  );
  const sevenChooseFive = model.sections.find(
    (section) => section.questionType === "seven-choose-five",
  );
  assert.ok(sevenChooseFive);
  assert.equal(Array.isArray(sevenChooseFive.options), true);
  assert.deepEqual(
    sevenChooseFive.questions.map((question) => question.blankIndex),
    [0, 1, 2, 3, 4],
  );
  assert.equal(sevenChooseFive.questions[0].questionType, "choice");
  assert.deepEqual(sevenChooseFive.questions[0].options, sevenChooseFive.options);
});

test("Chinese seed maps every section and child score", () => {
  const model = normalizeSeedDocument(readSeed("seed-chinese.json"));
  assert.equal(model.subject.sourceField, "subject");
  assert.equal(model.sectionCount, 9);
  assert.equal(model.questionCount, 31);
  assert.equal(model.totalScore, 150);
  assert.equal(
    model.canonicalJsonHash,
    "b89a1acaeafa708b62560478ceb78c7d2b3f0e49353880358a60c810be145b34",
  );
});

test("seed validation rejects score drift and conflicting subject aliases", () => {
  const english = readSeed("seed-english.json") as Record<string, unknown>;
  assert.throws(
    () => normalizeSeedDocument({ ...english, subject: "语文" }),
    /subject and subjects disagree/,
  );

  const mutated = structuredClone(english) as {
    sections: Array<{ score: number }>;
  };
  mutated.sections[0].score += 1;
  assert.throws(() => normalizeSeedDocument(mutated), /child question score/);
});
