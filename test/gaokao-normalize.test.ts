import assert from "node:assert/strict";
import test from "node:test";
import {
  buildManifestRecord,
  deriveSubject,
  normalizeCategory,
  normalizeText,
  publicCategoryFromSource,
} from "../scripts/gaokao/lib/normalize";

test("normalizes national, new-Gaokao and province paper metadata", () => {
  assert.equal(normalizeCategory("（全国卷Ⅲ）", 2020)?.variantCode, "national-3");
  assert.equal(normalizeCategory("全国甲卷文科", 2023)?.track, "文科");
  assert.equal(normalizeCategory("新课标Ⅰ卷", 2024)?.variantCode, "new-gaokao-1");
  assert.deepEqual(normalizeCategory("北京卷", 2024)?.regions, [
    { code: "beijing", name: "北京" },
  ]);
});

test("keeps ambiguous curriculum labels explicitly unverified", () => {
  assert.deepEqual(normalizeCategory("新课标Ⅰ", 2021), {
    variant: "新课标Ⅰ卷（待核）",
    variantCode: "new-curriculum-1-unverified",
    regionScope: "全国统考",
    track: null,
    regions: [],
    verified: false,
  });
  assert.equal(normalizeCategory("解析版", 2021), null);
});

test("maps Math I to science and Math II to humanities", () => {
  assert.equal(deriveSubject("2023_Math_I_MCQs.json")?.code, "mathematics_science");
  assert.equal(deriveSubject("2023_Math_II_MCQs.json")?.code, "mathematics_humanities");
});

test("maps imported source files to visible exercise categories", () => {
  assert.equal(publicCategoryFromSource("Objective_Questions/2024_Chinese_Modern_Lit.json", "语文"), "多文本");
  assert.equal(publicCategoryFromSource("Objective_Questions/2024_English_Fill_in_Blanks.json", "英语"), "完形填空");
  assert.equal(publicCategoryFromSource("Objective_Questions/2024_English_Language_Error_Correction.json", "英语"), "阅读表达");
  assert.equal(publicCategoryFromSource("Objective_Questions/2024_Math_II_Fill-in-the-Blank.json", "数学"), "填空");
  assert.equal(publicCategoryFromSource("Objective_Questions/2024_Physics_MCQs.json", "物理"), "力学");
  assert.equal(publicCategoryFromSource("Subjective_Questions/2024_Physics_Open-ended_Questions.json", "物理"), "力学");
});

test("maps content into the original subject navigation categories", () => {
  assert.equal(
    publicCategoryFromSource("Subjective_Questions/2024_Math_Open-ended_Questions.json", "数学", "求函数 f(x) 的导数并讨论单调性"),
    "导数",
  );
  assert.equal(
    publicCategoryFromSource("Objective_Questions/2024_Physics_MCQs.json", "物理", "导体棒在匀强磁场中运动，产生感应电动势"),
    "电磁学",
  );
  assert.equal(
    publicCategoryFromSource("Objective_Questions/2024_Physics_MCQs.json", "物理", "双缝干涉实验中，屏幕上出现明暗条纹"),
    "光学",
  );
  assert.equal(
    publicCategoryFromSource("Objective_Questions/2024_Chemistry_MCQs.json", "化学", "下列有机物中，苯的同系物是"),
    "有机化学",
  );
});

test("builds a deterministic grouped record and preserves fractional total score", () => {
  const input = {
    row: {
      year: "2023",
      category: "全国甲卷理科",
      question: "1. 材料题\r\n（1）甲（2）乙（3）丙",
      answer: ["A", "B", "C"],
      analysis: "解析",
      index: 7,
      score: 10,
    },
    relativePath: "GAOKAO-Bench-2023/2023_Math_I_MCQs.json",
    source: {
      key: "fixture",
      name: "Fixture",
      url: "https://example.test/source",
      revision: "abc123",
      snapshotSha256: "a".repeat(64),
      retrievedAt: "2026-01-01T00:00:00Z",
      licenseSpdx: null,
      rightsStatus: "review_required" as const,
    },
  };
  const first = buildManifestRecord(input);
  const second = buildManifestRecord(input);
  assert.deepEqual(first, second);
  assert.equal(first.valid, true);
  if (!first.valid) return;
  assert.equal(first.record.paper.paper_key, "gaokao:2023:national-a:mathematics_science");
  assert.deepEqual(first.record.questions.map((question) => question.score), [3.34, 3.33, 3.33]);
  assert.equal(first.record.questions.length, 3);
  assert.equal(first.record.section.review_status, "review_required");
  assert.equal(first.record.questions[0].source_key.endsWith(":child:1"), true);
});

test("normalization preserves semantic compatibility glyphs", () => {
  assert.equal(normalizeText("① Ⅲ ㏒ ㎝"), "① Ⅲ ㏒ ㎝");
});
