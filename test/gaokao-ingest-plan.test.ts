import assert from "node:assert/strict";
import test from "node:test";

import {
  assertApplyConfirmations,
  buildPlan,
  questionSourcePayload,
  sectionSourcePayload,
  type RemoteInventory,
} from "../scripts/gaokao/apply-manifest";
import { buildGaoKaoMathRecord } from "../scripts/gaokao/lib/gaokao-math";
import type { ManifestRecord } from "../scripts/gaokao/lib/model";
import type { LoadedManifest } from "../scripts/gaokao/lib/validate-manifest";
import {
  questionPayloadCore,
  sectionPayloadCore,
  sha256,
  stablePositiveInt,
  stableStringify,
} from "../scripts/gaokao/lib/normalize";

function fixtureManifest(): LoadedManifest {
  const built = buildGaoKaoMathRecord({
    row: {
      id: 100,
      problem: "Find x.",
      answer: "1",
      score: 4,
      year: "2025",
      number: "1",
      province: "Shanghai",
    },
    source: {
      key: "fixture-math",
      name: "Fixture Math",
      url: "https://example.test/math",
      revision: "abc123",
      snapshotSha256: "a".repeat(64),
      retrievedAt: null,
      licenseSpdx: "MIT",
      rightsStatus: "review_required",
    },
    sourceFile: "test.jsonl",
  });
  assert.equal(built.valid, true);
  if (!built.valid) throw new Error("fixture failed");
  built.record.section.sort_order = stablePositiveInt(
    `gaokao-section-order-v1\0${built.record.section.source_key}`,
  );
  recomputePayloads(built.record);
  return {
    bytes: Buffer.from("fixture"),
    manifestSha256: "b".repeat(64),
    records: [built.record],
  };
}

function emptyInventory(): RemoteInventory {
  return {
    sources: [],
    papers: [],
    paperSources: [],
    regions: [],
    sections: [],
    sectionSources: [],
    questions: [],
    questionSources: [],
    legacyGroups: [],
    databaseIdentitySha256: "d".repeat(64),
    sha256: "c".repeat(64),
  };
}

function recomputePayloads(record: ManifestRecord): void {
  for (const question of record.questions) {
    const { payload_hash, content_hash, canonical_hash, review_status, raw_source, ...core } = question;
    void payload_hash;
    void content_hash;
    void canonical_hash;
    void review_status;
    void raw_source;
    question.payload_hash = sha256(
      stableStringify(questionPayloadCore(record.paper.paper_key, core)),
    );
  }
  const { payload_hash, content_hash, review_status, raw_source, ...core } = record.section;
  void payload_hash;
  void content_hash;
  void review_status;
  void raw_source;
  record.section.payload_hash = sha256(
    stableStringify(sectionPayloadCore(record.paper.paper_key, core, record.questions)),
  );
}

function canonicalPairManifest(): LoadedManifest {
  const first = structuredClone(fixtureManifest().records[0]);
  const second = structuredClone(first);
  second.source = {
    ...second.source,
    key: "fixture-math-copy@def456",
    provider_key: "fixture-math-copy",
    name: "Fixture Math Copy",
    revision: "def456",
    snapshot_sha256: "e".repeat(64),
  };
  const itemKey = "fixture-math-copy:test.jsonl:id:00000100";
  second.section.source_key = itemKey;
  second.section.source_item_key = itemKey;
  second.section.sort_order = stablePositiveInt(
    `gaokao-section-order-v1\0${second.section.source_key}`,
  );
  second.questions[0].source_key = `${itemKey}:child:1`;
  second.questions[0].source_item_key = `${itemKey}:child:1`;
  recomputePayloads(second);

  return {
    bytes: Buffer.from("canonical-pair"),
    manifestSha256: "f".repeat(64),
    records: [first, second],
  };
}

function appliedCanonicalInventory(
  loaded: LoadedManifest,
  plan: ReturnType<typeof buildPlan>,
): RemoteInventory {
  const [first] = loaded.records;
  const sectionId = plan.sections[0].targetId!;
  const questionId = plan.questions[0].targetId!;
  const paperId = "paper-1";
  const sourceIds = ["source-1", "source-2"];

  return {
    sources: loaded.records.map((record, index) => ({
      id: sourceIds[index],
      sourceKey: record.source.key,
      providerKey: record.source.provider_key,
      name: record.source.name,
      sourceUrl: record.source.url,
      revision: record.source.revision,
      snapshotSha256: record.source.snapshot_sha256,
      licenseSpdx: record.source.license_spdx,
      rightsStatus: record.source.rights_status.toUpperCase(),
      retrievedAt: null,
      metadata: record.source.metadata ?? null,
    })),
    papers: [{
      id: paperId,
      paperKey: first.paper.paper_key,
      examKind: first.paper.exam_kind,
      examYear: first.paper.exam_year,
      subjectCode: first.paper.subject_code,
      subjectName: first.paper.subject_name,
      variantCode: first.paper.variant_code,
      paperVariant: first.paper.paper_variant,
      regionScope: first.paper.region_scope,
      track: first.paper.track,
      metadata: first.paper.metadata ?? null,
    }],
    paperSources: loaded.records.map((record, index) => ({
      paperId,
      paperKey: record.paper.paper_key,
      sourceId: sourceIds[index],
      snapshotSourceKey: record.source.key,
      role: "QUESTION",
    })),
    regions: [{
      paperId,
      paperKey: first.paper.paper_key,
      regionCode: first.paper.regions[0].code,
      regionName: first.paper.regions[0].name,
      sourceId: sourceIds[0],
      snapshotSourceKey: first.source.key,
      evidence: null,
    }],
    sections: [{
      id: sectionId,
      paperId,
      paperKey: first.paper.paper_key,
      sourceId: sourceIds[0],
      snapshotSourceKey: first.source.key,
      sourceKey: first.section.source_key,
      sortOrder: first.section.sort_order,
      sectionType: first.section.section_type,
      questionType: first.section.question_type,
      category: first.section.category,
      grade: first.section.grade,
      score: first.section.score,
      article: first.section.article,
      instructions: first.section.instructions,
      analysis: first.section.analysis,
      options: first.section.options,
      contentHash: first.section.content_hash,
      payloadHash: first.section.payload_hash,
      reviewStatus: first.section.review_status.toUpperCase(),
      rawSource: first.section.raw_source,
    }],
    sectionSources: loaded.records.map((record, index) => ({
      sectionId,
      paperId,
      paperKey: record.paper.paper_key,
      sectionSourceKey: first.section.source_key,
      sourceId: sourceIds[index],
      snapshotSourceKey: record.source.key,
      sourceItemKey: record.section.source_item_key,
      role: "QUESTION",
      payloadHash: record.section.payload_hash,
      sourcePayload: sectionSourcePayload(record),
      rawSource: record.section.raw_source,
    })),
    questions: [{
      id: questionId,
      paperId,
      paperKey: first.paper.paper_key,
      sectionId,
      sourceId: sourceIds[0],
      snapshotSourceKey: first.source.key,
      sourceKey: first.questions[0].source_key,
      sortOrder: first.questions[0].sort_order,
      questionType: first.questions[0].question_type,
      score: first.questions[0].score,
      correctRate: first.questions[0].correct_rate,
      content: first.questions[0].content,
      subContent: first.questions[0].sub_content,
      options: first.questions[0].options,
      answer: first.questions[0].answer,
      contentHash: first.questions[0].content_hash,
      canonicalHash: first.questions[0].canonical_hash,
      payloadHash: first.questions[0].payload_hash,
      reviewStatus: first.questions[0].review_status.toUpperCase(),
      rawSource: first.questions[0].raw_source,
    }],
    questionSources: loaded.records.map((record, index) => ({
      questionId,
      paperId,
      paperKey: record.paper.paper_key,
      sectionId,
      questionSourceKey: first.questions[0].source_key,
      sourceId: sourceIds[index],
      snapshotSourceKey: record.source.key,
      sourceItemKey: record.questions[0].source_item_key,
      role: "QUESTION",
      payloadHash: record.questions[0].payload_hash,
      sourcePayload: questionSourcePayload(record, record.questions[0]),
      rawSource: record.questions[0].raw_source,
    })),
    legacyGroups: [],
    databaseIdentitySha256: "d".repeat(64),
    sha256: "1".repeat(64),
  };
}

test("empty-database plans have deterministic targets and a stable plan hash", () => {
  const loaded = fixtureManifest();
  const first = buildPlan(loaded, emptyInventory());
  const second = buildPlan(loaded, emptyInventory());

  assert.deepEqual(first, second);
  assert.equal(first.counts.sections.insert, 1);
  assert.equal(first.counts.questions.insert, 1);
  assert.match(first.sections[0].targetId ?? "", /^gks_[0-9a-f]{40}$/);
  assert.match(first.questions[0].targetId ?? "", /^gkq_[0-9a-f]{40}$/);
  assert.match(first.planSha256, /^[0-9a-f]{64}$/);
});

test("canonical source links retain separate source and target hashes on rerun", () => {
  const loaded = canonicalPairManifest();
  const initial = buildPlan(loaded, emptyInventory());
  assert.equal(initial.sections[1].action, "link_canonical");
  assert.equal(initial.questions[1].action, "link_canonical");

  const rerun = buildPlan(loaded, appliedCanonicalInventory(loaded, initial));
  assert.deepEqual(rerun.sections.map((item) => item.action), ["skip_identical", "skip_identical"]);
  assert.deepEqual(rerun.questions.map((item) => item.action), ["skip_identical", "skip_identical"]);
  assert.equal(rerun.sections[1].existingPayloadHash, loaded.records[1].section.payload_hash);
  assert.equal(rerun.sections[1].targetPayloadHash, loaded.records[0].section.payload_hash);
  assert.notEqual(rerun.sections[1].existingPayloadHash, rerun.sections[1].targetPayloadHash);
  assert.equal(rerun.questions[1].existingPayloadHash, loaded.records[1].questions[0].payload_hash);
  assert.equal(rerun.questions[1].targetPayloadHash, loaded.records[0].questions[0].payload_hash);
});

test("source-link review and raw provenance drift fail closed", () => {
  const loaded = canonicalPairManifest();
  const initial = buildPlan(loaded, emptyInventory());
  const rawDrift = appliedCanonicalInventory(loaded, initial);
  rawDrift.sectionSources[1].rawSource = { tampered: true };
  const sectionPlan = buildPlan(loaded, rawDrift);
  assert.equal(sectionPlan.sections[1].action, "conflict");
  assert.match(sectionPlan.sections[1].reason, /provenance/);

  const reviewDrift = appliedCanonicalInventory(loaded, initial);
  reviewDrift.questionSources[1].sourcePayload = {
    ...reviewDrift.questionSources[1].sourcePayload as Record<string, unknown>,
    review_status: "approved",
  };
  const questionPlan = buildPlan(loaded, reviewDrift);
  assert.equal(questionPlan.sections[1].action, "skip_identical");
  assert.equal(questionPlan.questions[1].action, "conflict");
  assert.match(questionPlan.questions[1].reason, /provenance/);
});

test("apply confirmation binds manifest, plan, and remote inventory", () => {
  const loaded = fixtureManifest();
  const plan = buildPlan(loaded, emptyInventory());
  const previous = {
    manifest: process.env.GAOKAO_APPLY_CONFIRM,
    plan: process.env.GAOKAO_PLAN_CONFIRM,
    database: process.env.GAOKAO_DATABASE_CONFIRM,
    inventory: process.env.GAOKAO_REMOTE_INVENTORY_CONFIRM,
  };

  try {
    process.env.GAOKAO_APPLY_CONFIRM = loaded.manifestSha256;
    process.env.GAOKAO_PLAN_CONFIRM = plan.planSha256;
    process.env.GAOKAO_DATABASE_CONFIRM = plan.databaseIdentitySha256;
    process.env.GAOKAO_REMOTE_INVENTORY_CONFIRM = plan.remoteInventorySha256;
    assert.doesNotThrow(() => assertApplyConfirmations(loaded, plan));

    process.env.GAOKAO_PLAN_CONFIRM = "d".repeat(64);
    assert.throws(() => assertApplyConfirmations(loaded, plan), /GAOKAO_PLAN_CONFIRM/);
  } finally {
    if (previous.manifest === undefined) delete process.env.GAOKAO_APPLY_CONFIRM;
    else process.env.GAOKAO_APPLY_CONFIRM = previous.manifest;
    if (previous.plan === undefined) delete process.env.GAOKAO_PLAN_CONFIRM;
    else process.env.GAOKAO_PLAN_CONFIRM = previous.plan;
    if (previous.database === undefined) delete process.env.GAOKAO_DATABASE_CONFIRM;
    else process.env.GAOKAO_DATABASE_CONFIRM = previous.database;
    if (previous.inventory === undefined) delete process.env.GAOKAO_REMOTE_INVENTORY_CONFIRM;
    else process.env.GAOKAO_REMOTE_INVENTORY_CONFIRM = previous.inventory;
  }
});
