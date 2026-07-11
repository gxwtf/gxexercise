import { readFile } from "node:fs/promises";

import type {
  JsonValue,
  ManifestRecord,
  PaperManifest,
  QuestionManifest,
  SectionManifest,
  SourceManifest,
} from "./model";
import {
  canonicalText,
  questionPayloadCore,
  sectionPayloadCore,
  sha256,
  stableStringify,
} from "./normalize";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const RIGHTS_STATUSES = new Set(["approved", "review_required", "restricted"]);
const REVIEW_STATUSES = new Set(["approved", "review_required", "invalid"]);

export interface LoadedManifest {
  bytes: Buffer;
  manifestSha256: string;
  records: ManifestRecord[];
}

export class ManifestValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Manifest validation failed with ${issues.length} issue(s)`);
    this.name = "ManifestValidationError";
    this.issues = issues;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function checkKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  at: string,
  issues: string[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) issues.push(`${at}.${key}: unknown field`);
  }
  for (const key of required) {
    if (!hasOwn(value, key)) issues.push(`${at}.${key}: missing field`);
  }
}

function expectString(
  value: unknown,
  at: string,
  issues: string[],
  options: { max: number; allowEmpty?: boolean } = { max: Number.MAX_SAFE_INTEGER },
): value is string {
  if (typeof value !== "string") {
    issues.push(`${at}: expected string`);
    return false;
  }
  if (!options.allowEmpty && value.length === 0) issues.push(`${at}: must not be empty`);
  if (value.length > options.max) issues.push(`${at}: exceeds database limit ${options.max}`);
  if (value.includes("\0")) issues.push(`${at}: PostgreSQL text cannot contain NUL`);
  return true;
}

function expectNullableString(
  value: unknown,
  at: string,
  issues: string[],
  max: number,
): value is string | null {
  if (value === null) return true;
  return expectString(value, at, issues, { max, allowEmpty: true });
}

function expectInteger(
  value: unknown,
  at: string,
  issues: string[],
  options: { min?: number; max?: number } = {},
): value is number {
  if (!Number.isSafeInteger(value)) {
    issues.push(`${at}: expected safe integer`);
    return false;
  }
  const integer = value as number;
  if (options.min !== undefined && integer < options.min) issues.push(`${at}: must be >= ${options.min}`);
  if (options.max !== undefined && integer > options.max) issues.push(`${at}: must be <= ${options.max}`);
  return true;
}

function expectNullableDecimal(
  value: unknown,
  at: string,
  issues: string[],
  options: { min: number; max: number; scale: number },
): value is number | null {
  if (value === null) return true;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${at}: expected finite number or null`);
    return false;
  }
  if (value < options.min || value > options.max) {
    issues.push(`${at}: must be between ${options.min} and ${options.max}`);
  }
  const multiplier = 10 ** options.scale;
  if (Math.abs(value * multiplier - Math.round(value * multiplier)) > 1e-7) {
    issues.push(`${at}: exceeds database scale ${options.scale}`);
  }
  return true;
}

function expectJson(value: unknown, at: string, issues: string[]): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    if (typeof value === "string" && value.includes("\0")) {
      issues.push(`${at}: PostgreSQL JSON strings cannot contain NUL`);
      return false;
    }
    return true;
  }
  if (Array.isArray(value)) {
    let valid = true;
    value.forEach((item, index) => {
      if (!expectJson(item, `${at}[${index}]`, issues)) valid = false;
    });
    return valid;
  }
  if (isObject(value)) {
    let valid = true;
    for (const [key, item] of Object.entries(value)) {
      if (key.includes("\0")) {
        issues.push(`${at}: PostgreSQL JSON object keys cannot contain NUL`);
        valid = false;
      }
      if (!expectJson(item, `${at}.${key}`, issues)) valid = false;
    }
    return valid;
  }
  issues.push(`${at}: expected JSON value`);
  return false;
}

function expectSha256(value: unknown, at: string, issues: string[]): value is string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    issues.push(`${at}: expected lowercase SHA-256 hex`);
    return false;
  }
  return true;
}

function validateSource(value: unknown, at: string, issues: string[]): value is SourceManifest {
  if (!isObject(value)) {
    issues.push(`${at}: expected object`);
    return false;
  }
  const allowed = [
    "key",
    "provider_key",
    "name",
    "url",
    "revision",
    "snapshot_sha256",
    "license_spdx",
    "rights_status",
    "retrieved_at",
    "metadata",
  ] as const;
  checkKeys(value, allowed, allowed.filter((key) => key !== "metadata"), at, issues);
  expectString(value.key, `${at}.key`, issues, { max: 255 });
  expectString(value.provider_key, `${at}.provider_key`, issues, { max: 100 });
  expectString(value.name, `${at}.name`, issues, { max: 200 });
  if (expectString(value.url, `${at}.url`, issues, { max: 2048 })) {
    try {
      const url = new URL(value.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        issues.push(`${at}.url: only http(s) sources are supported`);
      }
    } catch {
      issues.push(`${at}.url: invalid URL`);
    }
  }
  expectString(value.revision, `${at}.revision`, issues, { max: 128 });
  const snapshotValid = expectSha256(value.snapshot_sha256, `${at}.snapshot_sha256`, issues);
  expectNullableString(value.license_spdx, `${at}.license_spdx`, issues, 64);
  if (typeof value.rights_status !== "string" || !RIGHTS_STATUSES.has(value.rights_status)) {
    issues.push(`${at}.rights_status: invalid status`);
  }
  if (value.retrieved_at !== null) {
    if (expectString(value.retrieved_at, `${at}.retrieved_at`, issues, { max: 64 })) {
      if (!Number.isFinite(Date.parse(value.retrieved_at))) issues.push(`${at}.retrieved_at: invalid timestamp`);
    }
  }
  if (hasOwn(value, "metadata")) expectJson(value.metadata, `${at}.metadata`, issues);

  if (snapshotValid && isObject(value.metadata) && hasOwn(value.metadata, "git_tree_inventory_sha256")) {
    const inventoryHash = value.metadata.git_tree_inventory_sha256;
    if (inventoryHash !== value.snapshot_sha256) {
      issues.push(`${at}.snapshot_sha256: does not match metadata.git_tree_inventory_sha256`);
    }
  }
  return true;
}

function validatePaper(value: unknown, at: string, issues: string[]): value is PaperManifest {
  if (!isObject(value)) {
    issues.push(`${at}: expected object`);
    return false;
  }
  const allowed = [
    "paper_key",
    "exam_kind",
    "exam_year",
    "subject_code",
    "subject_name",
    "variant_code",
    "paper_variant",
    "region_scope",
    "track",
    "regions",
    "metadata",
  ] as const;
  checkKeys(value, allowed, allowed.filter((key) => key !== "metadata"), at, issues);
  expectString(value.paper_key, `${at}.paper_key`, issues, { max: 255 });
  expectString(value.exam_kind, `${at}.exam_kind`, issues, { max: 32 });
  if (value.exam_kind !== "gaokao") {
    issues.push(`${at}.exam_kind: only gaokao is supported by manifest schema version 1`);
  }
  expectInteger(value.exam_year, `${at}.exam_year`, issues, { min: 1900, max: 2100 });
  expectString(value.subject_code, `${at}.subject_code`, issues, { max: 64 });
  expectString(value.subject_name, `${at}.subject_name`, issues, { max: 64 });
  expectString(value.variant_code, `${at}.variant_code`, issues, { max: 100 });
  expectString(value.paper_variant, `${at}.paper_variant`, issues, { max: 160 });
  expectString(value.region_scope, `${at}.region_scope`, issues, { max: 160 });
  expectNullableString(value.track, `${at}.track`, issues, 64);
  if (!Array.isArray(value.regions)) {
    issues.push(`${at}.regions: expected array`);
  } else {
    const regionCodes = new Set<string>();
    value.regions.forEach((region, index) => {
      const regionAt = `${at}.regions[${index}]`;
      if (!isObject(region)) {
        issues.push(`${regionAt}: expected object`);
        return;
      }
      checkKeys(region, ["code", "name"], ["code", "name"], regionAt, issues);
      if (expectString(region.code, `${regionAt}.code`, issues, { max: 32 })) {
        if (regionCodes.has(region.code)) issues.push(`${regionAt}.code: duplicate region code`);
        regionCodes.add(region.code);
      }
      expectString(region.name, `${regionAt}.name`, issues, { max: 64 });
    });
  }
  if (hasOwn(value, "metadata")) expectJson(value.metadata, `${at}.metadata`, issues);
  if (
    Number.isSafeInteger(value.exam_year) &&
    typeof value.variant_code === "string" &&
    typeof value.subject_code === "string"
  ) {
    const expectedPaperKey = `gaokao:${value.exam_year}:${value.variant_code}:${value.subject_code}`;
    if (value.paper_key !== expectedPaperKey) {
      issues.push(`${at}.paper_key: expected ${expectedPaperKey}`);
    }
  }
  return true;
}

function validateSection(value: unknown, at: string, issues: string[]): value is SectionManifest {
  if (!isObject(value)) {
    issues.push(`${at}: expected object`);
    return false;
  }
  const allowed = [
    "source_key",
    "source_item_key",
    "sort_order",
    "section_type",
    "question_type",
    "title",
    "category",
    "grade",
    "score",
    "article",
    "instructions",
    "analysis",
    "options",
    "tags",
    "metadata",
    "content_hash",
    "payload_hash",
    "review_status",
    "raw_source",
  ] as const;
  checkKeys(value, allowed, allowed, at, issues);
  expectString(value.source_key, `${at}.source_key`, issues, { max: 512 });
  expectString(value.source_item_key, `${at}.source_item_key`, issues, { max: 512 });
  expectInteger(value.sort_order, `${at}.sort_order`, issues, {
    min: 1,
    max: 2_147_483_647,
  });
  expectNullableString(value.section_type, `${at}.section_type`, issues, 100);
  expectString(value.question_type, `${at}.question_type`, issues, { max: 100 });
  expectNullableString(value.title, `${at}.title`, issues, 512);
  expectNullableString(value.category, `${at}.category`, issues, 160);
  expectNullableString(value.grade, `${at}.grade`, issues, 50);
  expectNullableDecimal(value.score, `${at}.score`, issues, { min: 0, max: 999_999.99, scale: 2 });
  expectNullableString(value.article, `${at}.article`, issues, Number.MAX_SAFE_INTEGER);
  expectNullableString(value.instructions, `${at}.instructions`, issues, Number.MAX_SAFE_INTEGER);
  expectNullableString(value.analysis, `${at}.analysis`, issues, Number.MAX_SAFE_INTEGER);
  expectJson(value.options, `${at}.options`, issues);
  if (!Array.isArray(value.tags)) {
    issues.push(`${at}.tags: expected string array`);
  } else {
    value.tags.forEach((tag, index) => {
      expectString(tag, `${at}.tags[${index}]`, issues, { max: 500 });
    });
  }
  expectJson(value.metadata, `${at}.metadata`, issues);
  expectSha256(value.content_hash, `${at}.content_hash`, issues);
  expectSha256(value.payload_hash, `${at}.payload_hash`, issues);
  if (typeof value.review_status !== "string" || !REVIEW_STATUSES.has(value.review_status)) {
    issues.push(`${at}.review_status: invalid status`);
  }
  expectJson(value.raw_source, `${at}.raw_source`, issues);
  return true;
}

function validateQuestion(value: unknown, at: string, issues: string[]): value is QuestionManifest {
  if (!isObject(value)) {
    issues.push(`${at}: expected object`);
    return false;
  }
  const allowed = [
    "source_key",
    "source_item_key",
    "source_question_no",
    "sort_order",
    "question_type",
    "score",
    "correct_rate",
    "content",
    "sub_content",
    "options",
    "answer",
    "analysis",
    "metadata",
    "content_hash",
    "canonical_hash",
    "payload_hash",
    "review_status",
    "raw_source",
  ] as const;
  checkKeys(value, allowed, allowed, at, issues);
  expectString(value.source_key, `${at}.source_key`, issues, { max: 512 });
  expectString(value.source_item_key, `${at}.source_item_key`, issues, { max: 512 });
  expectNullableString(value.source_question_no, `${at}.source_question_no`, issues, 100);
  expectInteger(value.sort_order, `${at}.sort_order`, issues, {
    min: 1,
    max: 2_147_483_647,
  });
  expectString(value.question_type, `${at}.question_type`, issues, { max: 100 });
  expectNullableDecimal(value.score, `${at}.score`, issues, { min: 0, max: 999_999.99, scale: 2 });
  expectNullableDecimal(value.correct_rate, `${at}.correct_rate`, issues, {
    min: 0,
    max: 1,
    scale: 6,
  });
  expectString(value.content, `${at}.content`, issues, {
    max: Number.MAX_SAFE_INTEGER,
    allowEmpty: true,
  });
  expectNullableString(value.sub_content, `${at}.sub_content`, issues, Number.MAX_SAFE_INTEGER);
  expectJson(value.options, `${at}.options`, issues);
  expectJson(value.answer, `${at}.answer`, issues);
  expectNullableString(value.analysis, `${at}.analysis`, issues, Number.MAX_SAFE_INTEGER);
  expectJson(value.metadata, `${at}.metadata`, issues);
  expectSha256(value.content_hash, `${at}.content_hash`, issues);
  expectSha256(value.canonical_hash, `${at}.canonical_hash`, issues);
  expectSha256(value.payload_hash, `${at}.payload_hash`, issues);
  if (typeof value.review_status !== "string" || !REVIEW_STATUSES.has(value.review_status)) {
    issues.push(`${at}.review_status: invalid status`);
  }
  expectJson(value.raw_source, `${at}.raw_source`, issues);
  return true;
}

function validateHashes(record: ManifestRecord, at: string, issues: string[]): void {
  const expectedSectionContent = sha256(canonicalText(record.section.article));
  if (record.section.content_hash !== expectedSectionContent) {
    issues.push(`${at}.section.content_hash: mismatch (expected ${expectedSectionContent})`);
  }

  record.questions.forEach((question, childIndex) => {
    const questionAt = `${at}.questions[${childIndex}]`;
    if (question.sort_order !== childIndex + 1) {
      issues.push(`${questionAt}.sort_order: must equal child array position ${childIndex + 1}`);
    }
    const expectedContent = sha256(`${expectedSectionContent}\0${childIndex}`);
    if (question.content_hash !== expectedContent) {
      issues.push(`${questionAt}.content_hash: mismatch (expected ${expectedContent})`);
    }
    const expectedCanonical = sha256(
      stableStringify({
        subject_code: record.paper.subject_code,
        section_content_hash: expectedSectionContent,
        child_index: childIndex,
        question_type: question.question_type,
      }),
    );
    if (question.canonical_hash !== expectedCanonical) {
      issues.push(`${questionAt}.canonical_hash: mismatch (expected ${expectedCanonical})`);
    }
    const { payload_hash, content_hash, canonical_hash, review_status, raw_source, ...core } = question;
    void payload_hash;
    void content_hash;
    void canonical_hash;
    void review_status;
    void raw_source;
    const expectedPayload = sha256(
      stableStringify(questionPayloadCore(record.paper.paper_key, core)),
    );
    if (question.payload_hash !== expectedPayload) {
      issues.push(`${questionAt}.payload_hash: mismatch (expected ${expectedPayload})`);
    }
  });

  const { payload_hash, content_hash, review_status, raw_source, ...sectionCore } = record.section;
  void payload_hash;
  void content_hash;
  void review_status;
  void raw_source;
  const expectedSectionPayload = sha256(
    stableStringify(sectionPayloadCore(record.paper.paper_key, sectionCore, record.questions)),
  );
  if (record.section.payload_hash !== expectedSectionPayload) {
    issues.push(`${at}.section.payload_hash: mismatch (expected ${expectedSectionPayload})`);
  }

  if (
    record.section.score !== null &&
    record.questions.every((question) => question.score !== null)
  ) {
    const childTotal = record.questions.reduce(
      (total, question) => total + (question.score ?? 0),
      0,
    );
    if (Math.abs(childTotal - record.section.score) > 0.005) {
      issues.push(
        `${at}.section.score: child score total ${childTotal} does not equal ${record.section.score}`,
      );
    }
  }
}

function validateRecord(value: unknown, at: string, issues: string[]): value is ManifestRecord {
  if (!isObject(value)) {
    issues.push(`${at}: expected object`);
    return false;
  }
  const initialIssueCount = issues.length;
  checkKeys(value, ["schema_version", "source", "paper", "section", "questions"], [
    "schema_version",
    "source",
    "paper",
    "section",
    "questions",
  ], at, issues);
  if (value.schema_version !== 1) issues.push(`${at}.schema_version: only version 1 is supported`);
  const sourceValid = validateSource(value.source, `${at}.source`, issues);
  const paperValid = validatePaper(value.paper, `${at}.paper`, issues);
  const sectionValid = validateSection(value.section, `${at}.section`, issues);
  let questionsValid = true;
  if (!Array.isArray(value.questions) || value.questions.length === 0) {
    issues.push(`${at}.questions: expected non-empty array`);
    questionsValid = false;
  } else {
    value.questions.forEach((question, index) => {
      if (!validateQuestion(question, `${at}.questions[${index}]`, issues)) questionsValid = false;
    });
  }
  if (
    sourceValid &&
    paperValid &&
    sectionValid &&
    questionsValid &&
    value.schema_version === 1 &&
    issues.length === initialIssueCount
  ) {
    validateHashes(value as unknown as ManifestRecord, at, issues);
    return issues.length === initialIssueCount;
  }
  return false;
}

function validateCrossRecordConstraints(records: ManifestRecord[], issues: string[]): void {
  const sources = new Map<string, string>();
  const providerRevisions = new Map<string, string>();
  const papers = new Map<string, string>();
  const sectionKeys = new Set<string>();
  const sectionItems = new Set<string>();
  const sectionSlots = new Set<string>();
  const questionKeys = new Set<string>();
  const questionItems = new Set<string>();

  records.forEach((record, recordIndex) => {
    const at = `line ${recordIndex + 1}`;
    const sourceFingerprint = stableStringify({
      ...record.source,
      metadata: record.source.metadata ?? null,
    });
    const existingSource = sources.get(record.source.key);
    if (existingSource && existingSource !== sourceFingerprint) {
      issues.push(`${at}.source: source key has inconsistent snapshots`);
    }
    sources.set(record.source.key, sourceFingerprint);

    const providerRevision = `${record.source.provider_key}\0${record.source.revision}`;
    const providerSourceKey = providerRevisions.get(providerRevision);
    if (providerSourceKey && providerSourceKey !== record.source.key) {
      issues.push(`${at}.source: provider/revision maps to multiple source keys`);
    }
    providerRevisions.set(providerRevision, record.source.key);

    const paperFingerprint = stableStringify({
      ...record.paper,
      regions: [...record.paper.regions].sort((left, right) => left.code.localeCompare(right.code, "en")),
      metadata: record.paper.metadata ?? null,
    });
    const existingPaper = papers.get(record.paper.paper_key);
    if (existingPaper && existingPaper !== paperFingerprint) {
      issues.push(`${at}.paper: paper key has inconsistent metadata`);
    }
    papers.set(record.paper.paper_key, paperFingerprint);

    if (sectionKeys.has(record.section.source_key)) {
      issues.push(`${at}.section.source_key: duplicate manifest key`);
    }
    sectionKeys.add(record.section.source_key);
    const sectionItem = `${record.source.key}\0${record.section.source_item_key}`;
    if (sectionItems.has(sectionItem)) issues.push(`${at}.section.source_item_key: duplicate within source`);
    sectionItems.add(sectionItem);
    const sectionSlot = `${record.paper.paper_key}\0${record.section.sort_order}`;
    if (sectionSlots.has(sectionSlot)) issues.push(`${at}.section.sort_order: duplicate within paper`);
    sectionSlots.add(sectionSlot);

    const questionOrders = new Set<number>();
    record.questions.forEach((question, questionIndex) => {
      const questionAt = `${at}.questions[${questionIndex}]`;
      if (questionKeys.has(question.source_key)) issues.push(`${questionAt}.source_key: duplicate manifest key`);
      questionKeys.add(question.source_key);
      const questionItem = `${record.source.key}\0${question.source_item_key}`;
      if (questionItems.has(questionItem)) {
        issues.push(`${questionAt}.source_item_key: duplicate within source`);
      }
      questionItems.add(questionItem);
      if (questionOrders.has(question.sort_order)) {
        issues.push(`${questionAt}.sort_order: duplicate within section`);
      }
      questionOrders.add(question.sort_order);
    });
  });
}

export async function loadAndValidateManifest(filePath: string): Promise<LoadedManifest> {
  const bytes = await readFile(filePath);
  const text = bytes.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) {
    throw new ManifestValidationError(["manifest: UTF-8 BOM is not allowed"]);
  }
  const lines = text.split(/\r?\n/);
  const records: ManifestRecord[] = [];
  const issues: string[] = [];
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      issues.push(`line ${index + 1}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
      return;
    }
    const issueCount = issues.length;
    if (validateRecord(value, `line ${index + 1}`, issues) && issues.length === issueCount) {
      records.push(value as ManifestRecord);
    }
  });
  if (records.length === 0) issues.push("manifest: no records");
  if (issues.length === 0) validateCrossRecordConstraints(records, issues);
  if (issues.length > 0) throw new ManifestValidationError(issues);
  return { bytes, manifestSha256: sha256(bytes), records };
}
