import "dotenv/config";

import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import type {
  JsonValue,
  ManifestRecord,
  PaperManifest,
  QuestionManifest,
  SectionManifest,
  SourceManifest,
} from "./lib/model";
import {
  canonicalText,
  questionPayloadCore,
  sectionPayloadCore,
  sha256,
  stableStringify,
} from "./lib/normalize";
import {
  loadAndValidateManifest,
  ManifestValidationError,
  type LoadedManifest,
} from "./lib/validate-manifest";

const IMPORTER_VERSION = "gaokao-apply-v1";
const ADVISORY_LOCK_NAMESPACE = "gxexercise";
const ADVISORY_LOCK_NAME = "gaokao-bank-v1";
const SOURCE_ROLE = "QUESTION";

type PlanAction = "insert" | "skip_identical" | "link_canonical" | "conflict";

interface CliOptions {
  manifestPath: string;
  apply: boolean;
  allowReviewRequired: boolean;
  validateOnly: boolean;
  json: boolean;
  planOutput: string | null;
  batchSize: number;
}

interface SourceRow {
  id: string;
  sourceKey: string;
  providerKey: string;
  name: string;
  sourceUrl: string;
  revision: string;
  snapshotSha256: string;
  licenseSpdx: string | null;
  rightsStatus: string;
  retrievedAt: Date | null;
  metadata: unknown;
}

interface PaperRow {
  id: string;
  paperKey: string;
  examKind: string;
  examYear: number;
  subjectCode: string;
  subjectName: string;
  variantCode: string;
  paperVariant: string;
  regionScope: string;
  track: string | null;
  metadata: unknown;
}

interface PaperSourceRow {
  paperId: string;
  paperKey: string;
  sourceId: string;
  snapshotSourceKey: string;
  role: string;
}

interface RegionRow {
  paperId: string;
  paperKey: string;
  regionCode: string;
  regionName: string;
  sourceId: string | null;
  snapshotSourceKey: string | null;
  evidence: unknown;
}

interface SectionRow {
  id: string;
  paperId: string;
  paperKey: string;
  sourceId: string;
  snapshotSourceKey: string;
  sourceKey: string;
  sortOrder: number;
  sectionType: string | null;
  questionType: string;
  category: string | null;
  grade: string | null;
  score: string | number | null;
  article: string | null;
  instructions: string | null;
  analysis: string | null;
  options: unknown;
  contentHash: string;
  payloadHash: string;
  reviewStatus: string;
  rawSource: unknown;
}

interface SectionSourceRow {
  sectionId: string;
  paperId: string;
  paperKey: string;
  sectionSourceKey: string;
  sourceId: string;
  snapshotSourceKey: string;
  sourceItemKey: string;
  role: string;
  payloadHash: string;
  sourcePayload: unknown;
  rawSource: unknown;
}

interface QuestionRow {
  id: string;
  paperId: string;
  paperKey: string;
  sectionId: string | null;
  sourceId: string;
  snapshotSourceKey: string;
  sourceKey: string;
  sortOrder: number;
  questionType: string;
  score: string | number | null;
  correctRate: string | number | null;
  content: string;
  subContent: string | null;
  options: unknown;
  answer: unknown;
  contentHash: string;
  canonicalHash: string;
  payloadHash: string;
  reviewStatus: string;
  rawSource: unknown;
}

interface QuestionSourceRow {
  questionId: string;
  paperId: string;
  paperKey: string;
  sectionId: string | null;
  questionSourceKey: string;
  sourceId: string;
  snapshotSourceKey: string;
  sourceItemKey: string;
  role: string;
  payloadHash: string;
  sourcePayload: unknown;
  rawSource: unknown;
}

interface LegacyQuestionRow {
  id: string;
  orderIndex: number;
  questionType: string;
  content: string;
  options: unknown;
  answer: string;
}

interface LegacyGroupRow {
  id: string;
  title: string;
  content: string;
  instructions: string | null;
  options: unknown;
  analysis: string | null;
  questionType: string;
  score: number;
  subject: string;
  category: string;
  year: number | null;
  items: LegacyQuestionRow[];
}

export interface RemoteInventory {
  sources: SourceRow[];
  papers: PaperRow[];
  paperSources: PaperSourceRow[];
  regions: RegionRow[];
  sections: SectionRow[];
  sectionSources: SectionSourceRow[];
  questions: QuestionRow[];
  questionSources: QuestionSourceRow[];
  legacyGroups: LegacyGroupRow[];
  databaseIdentitySha256: string;
  sha256: string;
}

interface PlanIssue {
  kind: "source" | "paper" | "region" | "section" | "question";
  key: string;
  reason: string;
  details?: Record<string, unknown>;
}

interface PlannedSection {
  recordIndex: number;
  sourceKey: string;
  sourceItemKey: string;
  paperKey: string;
  action: PlanAction;
  reason: string;
  targetId: string | null;
  existingPayloadHash: string | null;
  /** Payload hash of the canonical BankSection row, distinct from a source-link hash. */
  targetPayloadHash?: string | null;
  legacyCandidateIds: string[];
}

interface PlannedQuestion {
  recordIndex: number;
  questionIndex: number;
  sourceKey: string;
  sourceItemKey: string;
  paperKey: string;
  action: PlanAction;
  reason: string;
  targetId: string | null;
  targetSectionId: string | null;
  existingPayloadHash: string | null;
  /** Payload hash of the canonical BankQuestion row, distinct from a source-link hash. */
  targetPayloadHash?: string | null;
  legacyCandidateIds: string[];
}

export interface IngestPlan {
  manifestSha256: string;
  planSha256: string;
  databaseIdentitySha256: string;
  remoteInventorySha256: string;
  batchSize: number;
  recordCount: number;
  questionCount: number;
  issues: PlanIssue[];
  sections: PlannedSection[];
  questions: PlannedQuestion[];
  preparation: {
    sourceSnapshots: { insert: number; existing: number };
    papers: { insert: number; existing: number };
    paperSourceLinks: { insert: number; existing: number };
    regions: { insert: number; existing: number };
    staleRunRecovery: "mark_all_running_failed_after_advisory_lock";
  };
  counts: {
    sections: Record<PlanAction, number>;
    questions: Record<PlanAction, number>;
    legacySectionCandidates: number;
    legacyQuestionCandidates: number;
  };
}

function usage(): string {
  return [
    "Usage:",
    "  pnpm tsx scripts/gaokao/apply-manifest.ts --manifest <records.jsonl> [options]",
    "",
    "Options:",
    "  --apply                       Execute the planned bank-only writes",
    "  --allow-review-required       Required to apply REVIEW_REQUIRED records",
    "  --validate-only               Validate JSONL structure and every bound hash, without a DB",
    "  --batch-size <n>              Records per transaction (default: 25, max: 250)",
    "  --plan-output <path>          Write the complete plan as JSON",
    "  --json                        Print the complete plan as JSON",
    "  --help                        Show this help",
    "",
    "Apply confirmations (exact lowercase SHA-256 values):",
    "  GAOKAO_APPLY_CONFIRM=<manifest_sha256>",
    "  GAOKAO_PLAN_CONFIRM=<plan_sha256>",
    "  GAOKAO_DATABASE_CONFIRM=<database_identity_sha256>",
    "  GAOKAO_REMOTE_INVENTORY_CONFIRM=<remote_inventory_sha256>",
  ].join("\n");
}

function parseArgs(argv: string[]): CliOptions {
  let manifestPath: string | null = null;
  let apply = false;
  let allowReviewRequired = false;
  let validateOnly = false;
  let json = false;
  let planOutput: string | null = null;
  let batchSize = 25;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (argument === "--manifest") {
      manifestPath = argv[++index] ?? null;
      if (!manifestPath) throw new Error("--manifest requires a path");
      continue;
    }
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--allow-review-required") {
      allowReviewRequired = true;
      continue;
    }
    if (argument === "--validate-only") {
      validateOnly = true;
      continue;
    }
    if (argument === "--json") {
      json = true;
      continue;
    }
    if (argument === "--plan-output") {
      planOutput = argv[++index] ?? null;
      if (!planOutput) throw new Error("--plan-output requires a path");
      continue;
    }
    if (argument === "--batch-size") {
      const raw = argv[++index];
      batchSize = Number(raw);
      if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 250) {
        throw new Error("--batch-size must be an integer from 1 to 250");
      }
      continue;
    }
    if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    if (manifestPath) throw new Error(`Unexpected positional argument: ${argument}`);
    manifestPath = argument;
  }
  if (!manifestPath) throw new Error("A manifest path is required\n\n" + usage());
  if (apply && validateOnly) throw new Error("--apply and --validate-only cannot be combined");
  return {
    manifestPath: path.resolve(manifestPath),
    apply,
    allowReviewRequired,
    validateOnly,
    json,
    planOutput: planOutput ? path.resolve(planOutput) : null,
    batchSize,
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function mapKey(...parts: Array<string | number | null>): string {
  return parts.map((part) => String(part ?? "")).join("\0");
}

function deterministicTargetId(kind: "section" | "question", sourceKey: string): string {
  const prefix = kind === "section" ? "gks" : "gkq";
  return `${prefix}_${sha256(`${kind}\0${sourceKey}`).slice(0, 40)}`;
}

function normalizeForHash(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeForHash(item)]),
    );
  }
  return value;
}

function sortedForHash<T>(rows: T[]): unknown[] {
  return rows
    .map(normalizeForHash)
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right), "en"));
}

function jsonParam(value: unknown): string {
  return JSON.stringify(value ?? null);
}

async function queryRows<T>(client: Client, text: string, values: unknown[] = []): Promise<T[]> {
  const result = await client.query(text, values);
  return result.rows as T[];
}

async function assertDatabaseShape(client: Client): Promise<void> {
  const requiredTables = [
    "BankSourceSnapshot",
    "BankPaper",
    "BankPaperSource",
    "BankPaperRegion",
    "BankSection",
    "BankSectionSource",
    "BankQuestion",
    "BankQuestionSource",
    "BankIngestRun",
    "BankIngestItem",
    "QuestionGroup",
    "GroupItem",
    "Question",
  ];
  const tableRows = await queryRows<{ tableName: string; relation: string | null }>(
    client,
    `SELECT requested AS "tableName", to_regclass('public."' || requested || '"')::text AS relation
       FROM unnest($1::text[]) AS requested`,
    [requiredTables],
  );
  const missingTables = tableRows.filter((row) => row.relation === null).map((row) => row.tableName);
  if (missingTables.length > 0) {
    throw new Error(
      `Database schema is not ready; missing table(s): ${missingTables.join(", ")}. Apply the Prisma schema before planning ingestion.`,
    );
  }

  const requiredColumns: Record<string, string[]> = {
    BankSourceSnapshot: ["sourceKey", "providerKey", "revision", "snapshotSha256", "rightsStatus"],
    BankSection: ["sourceKey", "payloadHash", "contentHash", "paperId", "sortOrder"],
    BankQuestion: ["sourceKey", "payloadHash", "contentHash", "canonicalHash", "paperId", "sectionId"],
    BankIngestRun: [
      "manifestSha256",
      "planSha256",
      "databaseIdentityHash",
      "remoteInventoryHash",
      "status",
    ],
    QuestionGroup: ["content", "subject", "year", "instructions", "options", "analysis"],
    Question: ["content", "options", "answer", "subContent"],
  };
  const columnRows = await queryRows<{ tableName: string; columnName: string }>(
    client,
    `SELECT table_name AS "tableName", column_name AS "columnName"
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [Object.keys(requiredColumns)],
  );
  const available = new Set(columnRows.map((row) => mapKey(row.tableName, row.columnName)));
  const missingColumns = Object.entries(requiredColumns).flatMap(([tableName, columns]) =>
    columns
      .filter((columnName) => !available.has(mapKey(tableName, columnName)))
      .map((columnName) => `${tableName}.${columnName}`),
  );
  if (missingColumns.length > 0) {
    throw new Error(
      `Database schema is not ready; missing column(s): ${missingColumns.join(", ")}. Apply the Prisma schema before ingestion.`,
    );
  }
}

async function loadRemoteInventory(
  client: Client,
  records: ManifestRecord[],
  connectionString: string,
): Promise<RemoteInventory> {
  const sourceKeys = unique(records.map((record) => record.source.key));
  const providerKeys = unique(records.map((record) => record.source.provider_key));
  const revisions = unique(records.map((record) => record.source.revision));
  const paperKeys = unique(records.map((record) => record.paper.paper_key));
  const sectionSourceKeys = unique(records.map((record) => record.section.source_key));
  const sectionItemKeys = unique(records.map((record) => record.section.source_item_key));
  const questionSourceKeys = unique(
    records.flatMap((record) => record.questions.map((question) => question.source_key)),
  );
  const questionItemKeys = unique(
    records.flatMap((record) => record.questions.map((question) => question.source_item_key)),
  );
  const subjects = unique(records.map((record) => record.paper.subject_name));
  const years = unique(records.map((record) => record.paper.exam_year));
  const databaseIdentity = await queryRows<{
    databaseName: string;
    currentUser: string;
    serverAddress: string | null;
    serverPort: number | null;
  }>(
    client,
    `SELECT current_database() AS "databaseName",
            current_user AS "currentUser",
            inet_server_addr()::text AS "serverAddress",
            inet_server_port() AS "serverPort"`,
  );
  if (!databaseIdentity[0]) throw new Error("Unable to identify the target database");
  const parsedConnection = new URL(connectionString);
  const databaseIdentitySha256 = sha256(stableStringify({
    connection_host: parsedConnection.hostname.toLowerCase(),
    connection_port: parsedConnection.port || "5432",
    connection_database: decodeURIComponent(parsedConnection.pathname).replace(/^\//, ""),
    database_name: databaseIdentity[0].databaseName,
    current_user: databaseIdentity[0].currentUser,
    server_address: databaseIdentity[0].serverAddress,
    server_port: databaseIdentity[0].serverPort,
  }));

  const sources = await queryRows<SourceRow>(
    client,
    `SELECT id, "sourceKey", "providerKey", name, "sourceUrl", revision, "snapshotSha256", "licenseSpdx",
            "rightsStatus"::text AS "rightsStatus", "retrievedAt", metadata
       FROM "BankSourceSnapshot"
      WHERE "sourceKey" = ANY($1::text[])
         OR ("providerKey" = ANY($2::text[]) AND revision = ANY($3::text[]))`,
    [sourceKeys, providerKeys, revisions],
  );
  const papers = await queryRows<PaperRow>(
    client,
    `SELECT id, "paperKey", "examKind", "examYear", "subjectCode", "subjectName", "variantCode",
            "paperVariant", "regionScope", track, metadata
       FROM "BankPaper"
      WHERE "paperKey" = ANY($1::text[])`,
    [paperKeys],
  );
  const paperSources = await queryRows<PaperSourceRow>(
    client,
    `SELECT ps."paperId", p."paperKey", ps."sourceId", s."sourceKey" AS "snapshotSourceKey",
            ps.role::text AS role
       FROM "BankPaperSource" ps
       JOIN "BankPaper" p ON p.id = ps."paperId"
       JOIN "BankSourceSnapshot" s ON s.id = ps."sourceId"
      WHERE p."paperKey" = ANY($1::text[])`,
    [paperKeys],
  );
  const regions = await queryRows<RegionRow>(
    client,
    `SELECT r."paperId", p."paperKey", r."regionCode", r."regionName", r."sourceId",
            s."sourceKey" AS "snapshotSourceKey", r.evidence
       FROM "BankPaperRegion" r
       JOIN "BankPaper" p ON p.id = r."paperId"
       LEFT JOIN "BankSourceSnapshot" s ON s.id = r."sourceId"
      WHERE p."paperKey" = ANY($1::text[])`,
    [paperKeys],
  );
  const sections = await queryRows<SectionRow>(
    client,
    `SELECT section.id, section."paperId", paper."paperKey", section."sourceId",
            snapshot."sourceKey" AS "snapshotSourceKey", section."sourceKey", section."sortOrder",
            section."sectionType", section."questionType", section.category, section.grade,
            section.score, section.article, section.instructions, section.analysis, section.options,
            section."contentHash", section."payloadHash",
            section."reviewStatus"::text AS "reviewStatus", section."rawSource"
       FROM "BankSection" section
       JOIN "BankPaper" paper ON paper.id = section."paperId"
       JOIN "BankSourceSnapshot" snapshot ON snapshot.id = section."sourceId"
      WHERE paper."paperKey" = ANY($1::text[]) OR section."sourceKey" = ANY($2::text[])`,
    [paperKeys, sectionSourceKeys],
  );
  const sectionSources = await queryRows<SectionSourceRow>(
    client,
    `SELECT link."sectionId", section."paperId", paper."paperKey",
            section."sourceKey" AS "sectionSourceKey", link."sourceId",
            snapshot."sourceKey" AS "snapshotSourceKey", link."sourceItemKey",
            link.role::text AS role, link."payloadHash", link."sourcePayload", link."rawSource"
       FROM "BankSectionSource" link
       JOIN "BankSection" section ON section.id = link."sectionId"
       JOIN "BankPaper" paper ON paper.id = section."paperId"
       JOIN "BankSourceSnapshot" snapshot ON snapshot.id = link."sourceId"
      WHERE paper."paperKey" = ANY($1::text[])
         OR (snapshot."sourceKey" = ANY($2::text[]) AND link."sourceItemKey" = ANY($3::text[]))`,
    [paperKeys, sourceKeys, sectionItemKeys],
  );
  const questions = await queryRows<QuestionRow>(
    client,
    `SELECT question.id, question."paperId", paper."paperKey", question."sectionId", question."sourceId",
            snapshot."sourceKey" AS "snapshotSourceKey", question."sourceKey", question."sortOrder",
            question."questionType", question.score, question."correctRate", question.content,
            question."subContent", question.options, question.answer,
            question."contentHash", question."canonicalHash",
            question."payloadHash", question."reviewStatus"::text AS "reviewStatus",
            question."rawSource"
       FROM "BankQuestion" question
       JOIN "BankPaper" paper ON paper.id = question."paperId"
       JOIN "BankSourceSnapshot" snapshot ON snapshot.id = question."sourceId"
      WHERE paper."paperKey" = ANY($1::text[]) OR question."sourceKey" = ANY($2::text[])`,
    [paperKeys, questionSourceKeys],
  );
  const questionSources = await queryRows<QuestionSourceRow>(
    client,
    `SELECT link."questionId", question."paperId", paper."paperKey", question."sectionId",
            question."sourceKey" AS "questionSourceKey", link."sourceId",
            snapshot."sourceKey" AS "snapshotSourceKey", link."sourceItemKey",
            link.role::text AS role, link."payloadHash", link."sourcePayload", link."rawSource"
       FROM "BankQuestionSource" link
       JOIN "BankQuestion" question ON question.id = link."questionId"
       JOIN "BankPaper" paper ON paper.id = question."paperId"
       JOIN "BankSourceSnapshot" snapshot ON snapshot.id = link."sourceId"
      WHERE paper."paperKey" = ANY($1::text[])
         OR (snapshot."sourceKey" = ANY($2::text[]) AND link."sourceItemKey" = ANY($3::text[]))`,
    [paperKeys, sourceKeys, questionItemKeys],
  );
  const legacyGroups = await queryRows<LegacyGroupRow>(
    client,
    `SELECT legacy.id, legacy.title, legacy.content, legacy.instructions, legacy.options,
            legacy.analysis, legacy."questionType", legacy.score, legacy.subject, legacy.category,
            legacy.year,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', question.id,
                  'orderIndex', item."orderIndex",
                  'questionType', question."questionType",
                  'content', question.content,
                  'options', question.options,
                  'answer', question.answer
                ) ORDER BY item."orderIndex"
              ) FILTER (WHERE question.id IS NOT NULL),
              '[]'::jsonb
            ) AS items
       FROM "QuestionGroup" legacy
       LEFT JOIN "GroupItem" item ON item."groupId" = legacy.id
       LEFT JOIN "Question" question ON question.id = item."questionId"
      WHERE legacy.subject = ANY($1::text[])
        AND (legacy.year IS NULL OR legacy.year = ANY($2::int[]))
      GROUP BY legacy.id, legacy.title, legacy.content, legacy.instructions, legacy.options,
               legacy.analysis, legacy."questionType", legacy.score, legacy.subject, legacy.category,
               legacy.year`,
    [subjects, years],
  );

  const inventoryMaterial = {
    database_identity_sha256: databaseIdentitySha256,
    sources: sortedForHash(sources),
    papers: sortedForHash(papers),
    paper_sources: sortedForHash(paperSources),
    regions: sortedForHash(regions),
    sections: sortedForHash(sections),
    section_sources: sortedForHash(sectionSources),
    questions: sortedForHash(questions),
    question_sources: sortedForHash(questionSources),
    legacy_groups: sortedForHash(legacyGroups),
  };
  return {
    sources,
    papers,
    paperSources,
    regions,
    sections,
    sectionSources,
    questions,
    questionSources,
    legacyGroups,
    databaseIdentitySha256,
    sha256: sha256(stableStringify(inventoryMaterial)),
  };
}

function sourceMetadata(source: SourceManifest): JsonValue {
  return source.metadata ?? null;
}

function sourceComparableFromManifest(source: SourceManifest): unknown {
  return {
    sourceKey: source.key,
    providerKey: source.provider_key,
    name: source.name,
    sourceUrl: source.url,
    revision: source.revision,
    snapshotSha256: source.snapshot_sha256,
    licenseSpdx: source.license_spdx,
    rightsStatus: source.rights_status.toUpperCase(),
    retrievedAt: source.retrieved_at ? new Date(source.retrieved_at).toISOString() : null,
    metadata: sourceMetadata(source),
  };
}

function sourceComparableFromRow(source: SourceRow): unknown {
  return {
    sourceKey: source.sourceKey,
    providerKey: source.providerKey,
    name: source.name,
    sourceUrl: source.sourceUrl,
    revision: source.revision,
    snapshotSha256: source.snapshotSha256,
    licenseSpdx: source.licenseSpdx,
    rightsStatus: source.rightsStatus,
    retrievedAt: source.retrievedAt ? source.retrievedAt.toISOString() : null,
    metadata: source.metadata,
  };
}

function paperComparableFromManifest(paper: PaperManifest): unknown {
  return {
    paperKey: paper.paper_key,
    examKind: paper.exam_kind,
    examYear: paper.exam_year,
    subjectCode: paper.subject_code,
    subjectName: paper.subject_name,
    variantCode: paper.variant_code,
    paperVariant: paper.paper_variant,
    regionScope: paper.region_scope,
    track: paper.track,
    metadata: paper.metadata ?? null,
  };
}

function paperComparableFromRow(paper: PaperRow): unknown {
  return {
    paperKey: paper.paperKey,
    examKind: paper.examKind,
    examYear: paper.examYear,
    subjectCode: paper.subjectCode,
    subjectName: paper.subjectName,
    variantCode: paper.variantCode,
    paperVariant: paper.paperVariant,
    regionScope: paper.regionScope,
    track: paper.track,
    metadata: paper.metadata,
  };
}

function sameValue(left: unknown, right: unknown): boolean {
  return stableStringify(normalizeForHash(left)) === stableStringify(normalizeForHash(right));
}

/**
 * Source-link payloads bind review state and raw evidence independently from
 * the canonical content payload hash. This makes an immutable source item fail
 * closed if its provenance changes while its normalized question content does
 * not.
 */
export function sectionSourcePayload(record: ManifestRecord): Record<string, unknown> {
  return {
    schema_version: 1,
    payload: sectionCore(record),
    review_status: record.section.review_status,
    raw_source_sha256: sha256(stableStringify(record.section.raw_source)),
  };
}

export function questionSourcePayload(
  record: ManifestRecord,
  question: QuestionManifest,
): Record<string, unknown> {
  return {
    schema_version: 1,
    payload: questionCore(record, question),
    review_status: question.review_status,
    raw_source_sha256: sha256(stableStringify(question.raw_source)),
  };
}

function sectionSourceProvenanceMatches(
  record: ManifestRecord,
  link: Pick<SectionSourceRow, "sourcePayload" | "rawSource">,
): boolean {
  return (
    sameValue(link.sourcePayload, sectionSourcePayload(record)) &&
    sameValue(link.rawSource, record.section.raw_source)
  );
}

function questionSourceProvenanceMatches(
  record: ManifestRecord,
  question: QuestionManifest,
  link: Pick<QuestionSourceRow, "sourcePayload" | "rawSource">,
): boolean {
  return (
    sameValue(link.sourcePayload, questionSourcePayload(record, question)) &&
    sameValue(link.rawSource, question.raw_source)
  );
}

function deepNormalizeText(value: unknown): unknown {
  if (typeof value === "string") return canonicalText(value);
  if (Array.isArray(value)) return value.map(deepNormalizeText);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, deepNormalizeText(item)]),
    );
  }
  return value;
}

function legacyQuestionFingerprint(question: {
  questionType: string;
  content: string;
  options: unknown;
  answer: unknown;
}): string {
  return sha256(
    stableStringify({
      question_type: canonicalText(question.questionType),
      content: canonicalText(question.content),
      options: deepNormalizeText(question.options),
      answer: deepNormalizeText(question.answer),
    }),
  );
}

function decimalNumber(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}

function canonicalSectionComparable(section: SectionManifest | SectionRow): unknown {
  if ("payload_hash" in section) {
    return {
      section_type: section.section_type,
      question_type: section.question_type,
      category: section.category,
      grade: section.grade,
      score: section.score,
      article: section.article === null ? null : canonicalText(section.article),
      instructions: section.instructions === null ? null : canonicalText(section.instructions),
      analysis: section.analysis === null ? null : canonicalText(section.analysis),
      options: deepNormalizeText(section.options),
    };
  }
  return {
    section_type: section.sectionType,
    question_type: section.questionType,
    category: section.category,
    grade: section.grade,
    score: decimalNumber(section.score),
    article: section.article === null ? null : canonicalText(section.article),
    instructions: section.instructions === null ? null : canonicalText(section.instructions),
    analysis: section.analysis === null ? null : canonicalText(section.analysis),
    options: deepNormalizeText(section.options),
  };
}

function canonicalSectionMatches(incoming: SectionManifest, candidate: SectionRow): boolean {
  return sameValue(canonicalSectionComparable(incoming), canonicalSectionComparable(candidate));
}

function canonicalQuestionComparable(question: QuestionManifest | QuestionRow): unknown {
  if ("payload_hash" in question) {
    return {
      sort_order: question.sort_order,
      question_type: question.question_type,
      score: question.score,
      content: canonicalText(question.content),
      sub_content: question.sub_content === null ? null : canonicalText(question.sub_content),
      options: deepNormalizeText(question.options),
      answer: deepNormalizeText(question.answer),
    };
  }
  return {
    sort_order: question.sortOrder,
    question_type: question.questionType,
    score: decimalNumber(question.score),
    content: canonicalText(question.content),
    sub_content: question.subContent === null ? null : canonicalText(question.subContent),
    options: deepNormalizeText(question.options),
    answer: deepNormalizeText(question.answer),
  };
}

function canonicalQuestionMatches(
  incoming: QuestionManifest,
  candidate: QuestionRow,
): boolean {
  return sameValue(canonicalQuestionComparable(incoming), canonicalQuestionComparable(candidate));
}

function emptyActionCounts(): Record<PlanAction, number> {
  return { insert: 0, skip_identical: 0, link_canonical: 0, conflict: 0 };
}

export function buildPlan(
  loaded: LoadedManifest,
  inventory: RemoteInventory,
  batchSize = 25,
): IngestPlan {
  const { records } = loaded;
  const issues: PlanIssue[] = [];
  const plannedSections: PlannedSection[] = [];
  const plannedQuestions: PlannedQuestion[] = [];

  const sourcesByKey = new Map(inventory.sources.map((source) => [source.sourceKey, source]));
  const sourcesByProviderRevision = new Map(
    inventory.sources.map((source) => [mapKey(source.providerKey, source.revision), source]),
  );
  const papersByKey = new Map(inventory.papers.map((paper) => [paper.paperKey, paper]));
  const regionsByKey = new Map(
    inventory.regions.map((region) => [mapKey(region.paperKey, region.regionCode), region]),
  );

  const uniqueSources = new Map(records.map((record) => [record.source.key, record.source]));
  for (const source of uniqueSources.values()) {
    const direct = sourcesByKey.get(source.key);
    if (direct && !sameValue(sourceComparableFromManifest(source), sourceComparableFromRow(direct))) {
      issues.push({ kind: "source", key: source.key, reason: "source_snapshot_mismatch" });
    }
    const providerRevision = sourcesByProviderRevision.get(mapKey(source.provider_key, source.revision));
    if (providerRevision && providerRevision.sourceKey !== source.key) {
      issues.push({
        kind: "source",
        key: source.key,
        reason: "provider_revision_owned_by_different_source_key",
        details: { existing_source_key: providerRevision.sourceKey },
      });
    }
  }

  const uniquePapers = new Map(records.map((record) => [record.paper.paper_key, record.paper]));
  for (const paper of uniquePapers.values()) {
    const existing = papersByKey.get(paper.paper_key);
    if (existing && !sameValue(paperComparableFromManifest(paper), paperComparableFromRow(existing))) {
      issues.push({ kind: "paper", key: paper.paper_key, reason: "paper_metadata_mismatch" });
    }
    for (const region of paper.regions) {
      const existingRegion = regionsByKey.get(mapKey(paper.paper_key, region.code));
      if (existingRegion && existingRegion.regionName !== region.name) {
        issues.push({
          kind: "region",
          key: `${paper.paper_key}:${region.code}`,
          reason: "region_name_mismatch",
          details: { expected: region.name, existing: existingRegion.regionName },
        });
      }
    }
  }

  const sectionsBySourceKey = new Map(
    inventory.sections.map((section) => [section.sourceKey, section]),
  );
  const effectiveSectionPayloadHashes = new Map(
    inventory.sections.map((section) => [section.id, section.payloadHash]),
  );
  const sectionLinksBySourceItem = new Map(
    inventory.sectionSources.map((link) => [
      mapKey(link.snapshotSourceKey, link.sourceItemKey, link.role),
      link,
    ]),
  );
  const sectionsBySlot = new Map(
    inventory.sections.map((section) => [mapKey(section.paperKey, section.sortOrder), section]),
  );
  const sectionsByContent = new Map<string, SectionRow[]>();
  for (const section of inventory.sections) {
    const key = mapKey(section.paperKey, section.contentHash);
    sectionsByContent.set(key, [...(sectionsByContent.get(key) ?? []), section]);
  }
  const manifestSectionsByContent = new Map<
    string,
    { plan: PlannedSection; comparable: unknown }
  >();

  const questionsBySourceKey = new Map(
    inventory.questions.map((question) => [question.sourceKey, question]),
  );
  const effectiveQuestionPayloadHashes = new Map(
    inventory.questions.map((question) => [question.id, question.payloadHash]),
  );
  const questionLinksBySourceItem = new Map(
    inventory.questionSources.map((link) => [
      mapKey(link.snapshotSourceKey, link.sourceItemKey, link.role),
      link,
    ]),
  );
  const effectiveQuestionsBySectionSlot = new Map(
    inventory.questions
      .filter((question) => question.sectionId !== null)
      .map((question) => [
        mapKey(question.sectionId, question.sortOrder),
        {
          id: question.id,
          canonicalHash: question.canonicalHash,
          contentHash: question.contentHash,
          questionType: question.questionType,
          payloadHash: question.payloadHash,
          comparable: canonicalQuestionComparable(question),
        },
      ]),
  );
  const questionsBySectionCanonical = new Map<string, QuestionRow[]>();
  for (const question of inventory.questions) {
    if (!question.sectionId) continue;
    const key = mapKey(question.sectionId, question.canonicalHash);
    questionsBySectionCanonical.set(key, [
      ...(questionsBySectionCanonical.get(key) ?? []),
      question,
    ]);
  }
  const manifestQuestionsBySectionCanonical = new Map<
    string,
    { plan: PlannedQuestion; comparable: unknown }
  >();

  const legacyGroupsByContent = new Map<string, LegacyGroupRow[]>();
  for (const group of inventory.legacyGroups) {
    const key = sha256(canonicalText(group.content));
    legacyGroupsByContent.set(key, [...(legacyGroupsByContent.get(key) ?? []), group]);
  }

  records.forEach((record, recordIndex) => {
    const { source, paper, section } = record;
    const legacyGroups = (legacyGroupsByContent.get(section.content_hash) ?? []).filter(
      (group) =>
        group.subject === paper.subject_name && (group.year === null || group.year === paper.exam_year),
    );
    const legacyCandidateIds = legacyGroups.map((group) => group.id).sort();
    const direct = sectionsBySourceKey.get(section.source_key);
    const sourceLink = sectionLinksBySourceItem.get(
      mapKey(source.key, section.source_item_key, SOURCE_ROLE),
    );
    const slot = sectionsBySlot.get(mapKey(paper.paper_key, section.sort_order));
    const contentCandidates = sectionsByContent.get(mapKey(paper.paper_key, section.content_hash)) ?? [];
    const manifestCandidate = manifestSectionsByContent.get(
      mapKey(paper.paper_key, section.content_hash, section.question_type),
    );

    let sectionPlan: PlannedSection;
    if (direct) {
      if (direct.paperKey !== paper.paper_key) {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "conflict",
          reason: "source_key_owned_by_different_paper",
          targetId: direct.id,
          existingPayloadHash: direct.payloadHash,
          legacyCandidateIds,
        };
      } else if (direct.payloadHash !== section.payload_hash) {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "conflict",
          reason: "source_key_payload_hash_mismatch",
          targetId: direct.id,
          existingPayloadHash: direct.payloadHash,
          legacyCandidateIds,
        };
      } else if (
        direct.reviewStatus !== section.review_status.toUpperCase() ||
        !sameValue(direct.rawSource, section.raw_source)
      ) {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "conflict",
          reason: "source_key_provenance_mismatch",
          targetId: direct.id,
          existingPayloadHash: direct.payloadHash,
          legacyCandidateIds,
        };
      } else if (
        sourceLink &&
        (sourceLink.sectionId !== direct.id ||
          sourceLink.payloadHash !== section.payload_hash ||
          !sectionSourceProvenanceMatches(record, sourceLink))
      ) {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "conflict",
          reason: "source_item_link_disagrees_with_direct_section",
          targetId: direct.id,
          existingPayloadHash: direct.payloadHash,
          legacyCandidateIds,
        };
      } else {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "skip_identical",
          reason: "source_key_payload_hash_identical",
          targetId: direct.id,
          existingPayloadHash: direct.payloadHash,
          legacyCandidateIds,
        };
      }
    } else if (sourceLink) {
      if (
        sourceLink.paperKey !== paper.paper_key ||
        sourceLink.payloadHash !== section.payload_hash ||
        !sectionSourceProvenanceMatches(record, sourceLink)
      ) {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "conflict",
          reason: "source_item_link_or_provenance_mismatch",
          targetId: sourceLink.sectionId,
          existingPayloadHash: sourceLink.payloadHash,
          legacyCandidateIds,
        };
      } else {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "skip_identical",
          reason: "source_item_payload_hash_identical",
          targetId: sourceLink.sectionId,
          existingPayloadHash: sourceLink.payloadHash,
          legacyCandidateIds,
        };
      }
    } else if (slot) {
      if (
        slot.contentHash === section.content_hash &&
        slot.questionType === section.question_type &&
        canonicalSectionMatches(section, slot)
      ) {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "link_canonical",
          reason: "paper_sort_slot_content_hash_identical",
          targetId: slot.id,
          existingPayloadHash: slot.payloadHash,
          legacyCandidateIds,
        };
      } else {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "conflict",
          reason: "paper_sort_slot_occupied",
          targetId: slot.id,
          existingPayloadHash: slot.payloadHash,
          legacyCandidateIds,
        };
      }
    } else {
      const typeCompatibleCandidates = contentCandidates.filter(
        (candidate) => candidate.questionType === section.question_type,
      );
      const compatibleCandidates = typeCompatibleCandidates.filter(
        (candidate) => canonicalSectionMatches(section, candidate),
      );
      if (contentCandidates.length > 0 && typeCompatibleCandidates.length === 0) {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "conflict",
          reason: "content_hash_candidate_question_type_mismatch",
          targetId: null,
          existingPayloadHash: null,
          legacyCandidateIds,
        };
      } else if (typeCompatibleCandidates.length > 0 && compatibleCandidates.length === 0) {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "conflict",
          reason: "content_hash_candidate_semantic_mismatch",
          targetId: null,
          existingPayloadHash: null,
          legacyCandidateIds,
        };
      } else if (compatibleCandidates.length === 1) {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "link_canonical",
          reason: "unique_same_paper_content_hash_candidate",
          targetId: compatibleCandidates[0].id,
          existingPayloadHash: compatibleCandidates[0].payloadHash,
          legacyCandidateIds,
        };
      } else if (compatibleCandidates.length > 1) {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "conflict",
          reason: "ambiguous_same_paper_content_hash_candidates",
          targetId: null,
          existingPayloadHash: null,
          legacyCandidateIds,
        };
      } else if (
        manifestCandidate?.plan.targetId &&
        sameValue(manifestCandidate.comparable, canonicalSectionComparable(section))
      ) {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "link_canonical",
          reason: "same_manifest_content_hash_candidate",
          targetId: manifestCandidate.plan.targetId,
          existingPayloadHash: null,
          legacyCandidateIds,
        };
      } else {
        sectionPlan = {
          recordIndex,
          sourceKey: section.source_key,
          sourceItemKey: section.source_item_key,
          paperKey: paper.paper_key,
          action: "insert",
          reason: legacyCandidateIds.length > 0 ? "new_bank_section_with_legacy_candidate" : "new_section",
          targetId: deterministicTargetId("section", section.source_key),
          existingPayloadHash: null,
          legacyCandidateIds,
        };
      }
    }
    const sectionTargetPayloadHash = sectionPlan.action === "insert"
      ? section.payload_hash
      : sectionPlan.targetId
        ? effectiveSectionPayloadHashes.get(sectionPlan.targetId) ?? null
        : null;
    sectionPlan.targetPayloadHash = sectionTargetPayloadHash;
    if (sectionPlan.action !== "conflict" && sectionTargetPayloadHash === null) {
      sectionPlan = {
        ...sectionPlan,
        action: "conflict",
        reason: "target_payload_hash_unavailable",
      };
    }
    if (
      sectionPlan.action !== "conflict" &&
      sectionPlan.targetId &&
      sectionPlan.targetPayloadHash
    ) {
      effectiveSectionPayloadHashes.set(sectionPlan.targetId, sectionPlan.targetPayloadHash);
    }
    plannedSections.push(sectionPlan);
    if (sectionPlan.action === "conflict") {
      issues.push({ kind: "section", key: section.source_key, reason: sectionPlan.reason });
    } else if (sectionPlan.targetId) {
      manifestSectionsByContent.set(
        mapKey(paper.paper_key, section.content_hash, section.question_type),
        { plan: sectionPlan, comparable: canonicalSectionComparable(section) },
      );
    }

    record.questions.forEach((question, questionIndex) => {
      const legacyQuestionIds = legacyGroups
        .flatMap((group) => group.items)
        .filter(
          (legacyQuestion) =>
            legacyQuestionFingerprint(legacyQuestion) === legacyQuestionFingerprint({
              questionType: question.question_type,
              content: question.content,
              options: question.options,
              answer: question.answer,
            }),
        )
        .map((legacyQuestion) => legacyQuestion.id)
        .sort();
      const directQuestion = questionsBySourceKey.get(question.source_key);
      const questionSourceLink = questionLinksBySourceItem.get(
        mapKey(source.key, question.source_item_key, SOURCE_ROLE),
      );
      const targetSectionId = sectionPlan.targetId;
      const occupiedSlot = targetSectionId
        ? effectiveQuestionsBySectionSlot.get(mapKey(targetSectionId, question.sort_order))
        : undefined;
      const canonicalCandidates = targetSectionId
        ? questionsBySectionCanonical.get(mapKey(targetSectionId, question.canonical_hash)) ?? []
        : [];
      const manifestQuestionCandidate = targetSectionId
        ? manifestQuestionsBySectionCanonical.get(mapKey(targetSectionId, question.canonical_hash))
        : undefined;

      let questionPlan: PlannedQuestion;
      const base = {
        recordIndex,
        questionIndex,
        sourceKey: question.source_key,
        sourceItemKey: question.source_item_key,
        paperKey: paper.paper_key,
        targetSectionId,
        legacyCandidateIds: legacyQuestionIds,
      };
      if (sectionPlan.action === "conflict" || !targetSectionId) {
        questionPlan = {
          ...base,
          action: "conflict",
          reason: "parent_section_conflict",
          targetId: null,
          existingPayloadHash: null,
        };
      } else if (directQuestion) {
        if (
          directQuestion.paperKey !== paper.paper_key ||
          directQuestion.sectionId !== targetSectionId
        ) {
          questionPlan = {
            ...base,
            action: "conflict",
            reason: "source_key_owned_by_different_paper_or_section",
            targetId: directQuestion.id,
            existingPayloadHash: directQuestion.payloadHash,
          };
        } else if (directQuestion.payloadHash !== question.payload_hash) {
          questionPlan = {
            ...base,
            action: "conflict",
            reason: "source_key_payload_hash_mismatch",
            targetId: directQuestion.id,
            existingPayloadHash: directQuestion.payloadHash,
          };
        } else if (
          directQuestion.reviewStatus !== question.review_status.toUpperCase() ||
          !sameValue(directQuestion.rawSource, question.raw_source)
        ) {
          questionPlan = {
            ...base,
            action: "conflict",
            reason: "source_key_provenance_mismatch",
            targetId: directQuestion.id,
            existingPayloadHash: directQuestion.payloadHash,
          };
        } else if (
          questionSourceLink &&
          (questionSourceLink.questionId !== directQuestion.id ||
            questionSourceLink.payloadHash !== question.payload_hash ||
            !questionSourceProvenanceMatches(record, question, questionSourceLink))
        ) {
          questionPlan = {
            ...base,
            action: "conflict",
            reason: "source_item_link_disagrees_with_direct_question",
            targetId: directQuestion.id,
            existingPayloadHash: directQuestion.payloadHash,
          };
        } else {
          questionPlan = {
            ...base,
            action: "skip_identical",
            reason: "source_key_payload_hash_identical",
            targetId: directQuestion.id,
            existingPayloadHash: directQuestion.payloadHash,
          };
        }
      } else if (questionSourceLink) {
        if (
          questionSourceLink.paperKey !== paper.paper_key ||
          questionSourceLink.sectionId !== targetSectionId ||
          questionSourceLink.payloadHash !== question.payload_hash ||
          !questionSourceProvenanceMatches(record, question, questionSourceLink)
        ) {
          questionPlan = {
            ...base,
            action: "conflict",
            reason: "source_item_link_or_provenance_mismatch",
            targetId: questionSourceLink.questionId,
            existingPayloadHash: questionSourceLink.payloadHash,
          };
        } else {
          questionPlan = {
            ...base,
            action: "skip_identical",
            reason: "source_item_payload_hash_identical",
            targetId: questionSourceLink.questionId,
            existingPayloadHash: questionSourceLink.payloadHash,
          };
        }
      } else if (occupiedSlot) {
        if (
          occupiedSlot.canonicalHash === question.canonical_hash &&
          occupiedSlot.contentHash === question.content_hash &&
          occupiedSlot.questionType === question.question_type &&
          sameValue(occupiedSlot.comparable, canonicalQuestionComparable(question))
        ) {
          questionPlan = {
            ...base,
            action: "link_canonical",
            reason: "section_sort_slot_canonical_hash_identical",
            targetId: occupiedSlot.id,
            existingPayloadHash: occupiedSlot.payloadHash,
          };
        } else {
          questionPlan = {
            ...base,
            action: "conflict",
            reason: "section_sort_slot_occupied",
            targetId: occupiedSlot.id,
            existingPayloadHash: occupiedSlot.payloadHash,
          };
        }
      } else if (
        canonicalCandidates.length === 1 &&
        canonicalQuestionMatches(question, canonicalCandidates[0])
      ) {
        questionPlan = {
          ...base,
          action: "link_canonical",
          reason: "unique_same_section_canonical_hash_candidate",
          targetId: canonicalCandidates[0].id,
          existingPayloadHash: canonicalCandidates[0].payloadHash,
        };
      } else if (canonicalCandidates.length > 1) {
        questionPlan = {
          ...base,
          action: "conflict",
          reason: "ambiguous_same_section_canonical_hash_candidates",
          targetId: null,
          existingPayloadHash: null,
        };
      } else if (canonicalCandidates.length === 1) {
        questionPlan = {
          ...base,
          action: "conflict",
          reason: "canonical_hash_candidate_semantic_mismatch",
          targetId: canonicalCandidates[0].id,
          existingPayloadHash: canonicalCandidates[0].payloadHash,
        };
      } else if (
        manifestQuestionCandidate?.plan.targetId &&
        sameValue(manifestQuestionCandidate.comparable, canonicalQuestionComparable(question))
      ) {
        questionPlan = {
          ...base,
          action: "link_canonical",
          reason: "same_manifest_canonical_hash_candidate",
          targetId: manifestQuestionCandidate.plan.targetId,
          existingPayloadHash: null,
        };
      } else if (manifestQuestionCandidate) {
        questionPlan = {
          ...base,
          action: "conflict",
          reason: "same_manifest_canonical_semantic_mismatch",
          targetId: manifestQuestionCandidate.plan.targetId,
          existingPayloadHash: null,
        };
      } else {
        questionPlan = {
          ...base,
          action: "insert",
          reason: legacyQuestionIds.length > 0 ? "new_bank_question_with_legacy_candidate" : "new_question",
          targetId: deterministicTargetId("question", question.source_key),
          existingPayloadHash: null,
        };
      }
      const questionTargetPayloadHash = questionPlan.action === "insert"
        ? question.payload_hash
        : questionPlan.targetId
          ? effectiveQuestionPayloadHashes.get(questionPlan.targetId) ?? null
          : null;
      questionPlan.targetPayloadHash = questionTargetPayloadHash;
      if (questionPlan.action !== "conflict" && questionTargetPayloadHash === null) {
        questionPlan = {
          ...questionPlan,
          action: "conflict",
          reason: "target_payload_hash_unavailable",
        };
      }
      if (
        questionPlan.action !== "conflict" &&
        questionPlan.targetId &&
        questionPlan.targetPayloadHash
      ) {
        effectiveQuestionPayloadHashes.set(questionPlan.targetId, questionPlan.targetPayloadHash);
      }
      plannedQuestions.push(questionPlan);
      if (questionPlan.action === "conflict") {
        issues.push({ kind: "question", key: question.source_key, reason: questionPlan.reason });
      } else if (questionPlan.targetId && targetSectionId) {
        effectiveQuestionsBySectionSlot.set(
          mapKey(targetSectionId, question.sort_order),
          {
            id: questionPlan.targetId,
            canonicalHash: question.canonical_hash,
            contentHash: question.content_hash,
            questionType: question.question_type,
            payloadHash: question.payload_hash,
            comparable: canonicalQuestionComparable(question),
          },
        );
        manifestQuestionsBySectionCanonical.set(
          mapKey(targetSectionId, question.canonical_hash),
          { plan: questionPlan, comparable: canonicalQuestionComparable(question) },
        );
      }
    });
  });

  const sectionCounts = emptyActionCounts();
  plannedSections.forEach((section) => {
    sectionCounts[section.action] += 1;
  });
  const questionCounts = emptyActionCounts();
  plannedQuestions.forEach((question) => {
    questionCounts[question.action] += 1;
  });
  const paperSourceKeys = new Set(
    records.map((record) => mapKey(record.paper.paper_key, record.source.key, SOURCE_ROLE)),
  );
  const existingPaperSourceKeys = new Set(
    inventory.paperSources.map((link) => mapKey(link.paperKey, link.snapshotSourceKey, link.role)),
  );
  const regionKeys = new Set(
    records.flatMap((record) =>
      record.paper.regions.map((region) => mapKey(record.paper.paper_key, region.code)),
    ),
  );
  const preparation = {
    sourceSnapshots: {
      insert: [...uniqueSources.keys()].filter((key) => !sourcesByKey.has(key)).length,
      existing: [...uniqueSources.keys()].filter((key) => sourcesByKey.has(key)).length,
    },
    papers: {
      insert: [...uniquePapers.keys()].filter((key) => !papersByKey.has(key)).length,
      existing: [...uniquePapers.keys()].filter((key) => papersByKey.has(key)).length,
    },
    paperSourceLinks: {
      insert: [...paperSourceKeys].filter((key) => !existingPaperSourceKeys.has(key)).length,
      existing: [...paperSourceKeys].filter((key) => existingPaperSourceKeys.has(key)).length,
    },
    regions: {
      insert: [...regionKeys].filter((key) => !regionsByKey.has(key)).length,
      existing: [...regionKeys].filter((key) => regionsByKey.has(key)).length,
    },
    staleRunRecovery: "mark_all_running_failed_after_advisory_lock" as const,
  };
  const planCore = {
    manifestSha256: loaded.manifestSha256,
    databaseIdentitySha256: inventory.databaseIdentitySha256,
    remoteInventorySha256: inventory.sha256,
    batchSize,
    recordCount: records.length,
    questionCount: records.reduce((count, record) => count + record.questions.length, 0),
    issues,
    sections: plannedSections,
    questions: plannedQuestions,
    preparation,
    counts: {
      sections: sectionCounts,
      questions: questionCounts,
      legacySectionCandidates: plannedSections.filter((section) => section.legacyCandidateIds.length > 0)
        .length,
      legacyQuestionCandidates: plannedQuestions.filter((question) => question.legacyCandidateIds.length > 0)
        .length,
    },
  };
  return {
    ...planCore,
    planSha256: sha256(stableStringify({
      importer_version: IMPORTER_VERSION,
      ...planCore,
    })),
  };
}

function reviewRequired(records: ManifestRecord[]): boolean {
  return records.some(
    (record) =>
      record.source.rights_status === "review_required" ||
      record.section.review_status === "review_required" ||
      record.questions.some((question) => question.review_status === "review_required"),
  );
}

function assertIngestPolicy(records: ManifestRecord[], options: CliOptions): void {
  const restrictedSources = unique(
    records
      .filter((record) => record.source.rights_status === "restricted")
      .map((record) => record.source.key),
  );
  if (restrictedSources.length > 0) {
    throw new Error(
      `RESTRICTED sources are never ingestible: ${restrictedSources.join(", ")}`,
    );
  }
  const invalidItems = records.flatMap((record) => [
    ...(record.section.review_status === "invalid" ? [record.section.source_key] : []),
    ...record.questions
      .filter((question) => question.review_status === "invalid")
      .map((question) => question.source_key),
  ]);
  if (invalidItems.length > 0) {
    throw new Error(`INVALID manifest items are never ingestible: ${invalidItems.slice(0, 20).join(", ")}`);
  }
  if (options.apply && reviewRequired(records) && !options.allowReviewRequired) {
    throw new Error(
      "Manifest contains REVIEW_REQUIRED data. Re-run with --allow-review-required only after accepting staging-only review status.",
    );
  }
}

function summarizePlan(plan: IngestPlan): Record<string, unknown> {
  return {
    manifest_sha256: plan.manifestSha256,
    plan_sha256: plan.planSha256,
    database_identity_sha256: plan.databaseIdentitySha256,
    remote_inventory_sha256: plan.remoteInventorySha256,
    records: plan.recordCount,
    questions: plan.questionCount,
    preparation: plan.preparation,
    counts: plan.counts,
    conflict_count: plan.issues.length,
    issues: plan.issues,
  };
}

async function emitPlan(
  plan: IngestPlan,
  options: CliOptions,
  requiresReviewOverride: boolean,
): Promise<void> {
  if (options.planOutput) {
    await writeFile(options.planOutput, JSON.stringify(plan, null, 2) + "\n", "utf8");
  }
  console.log(JSON.stringify(options.json ? plan : summarizePlan(plan), null, 2));
  if (!options.apply) {
    console.error(
      `\nRead-only plan complete. To apply this exact snapshot, set:\n` +
        `GAOKAO_APPLY_CONFIRM=${plan.manifestSha256}\n` +
        `GAOKAO_PLAN_CONFIRM=${plan.planSha256}\n` +
        `GAOKAO_DATABASE_CONFIRM=${plan.databaseIdentitySha256}\n` +
        `GAOKAO_REMOTE_INVENTORY_CONFIRM=${plan.remoteInventorySha256}\n` +
        `and add --apply${requiresReviewOverride ? " --allow-review-required" : ""}`,
    );
  }
}

async function acquireAdvisoryLock(client: Client): Promise<void> {
  await client.query(
    "SELECT pg_advisory_lock(hashtext($1), hashtext($2))",
    [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_NAME],
  );
}

async function releaseAdvisoryLock(client: Client): Promise<void> {
  await client.query(
    "SELECT pg_advisory_unlock(hashtext($1), hashtext($2))",
    [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_NAME],
  );
}

async function inTransaction<T>(client: Client, operation: () => Promise<T>): Promise<T> {
  await client.query("BEGIN");
  try {
    const value = await operation();
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function ensureSource(client: Client, source: SourceManifest): Promise<string> {
  const inserted = await queryRows<{ id: string }>(
    client,
     `INSERT INTO "BankSourceSnapshot" (
       id, "sourceKey", "providerKey", name, "sourceUrl", revision, "snapshotSha256", "licenseSpdx",
       "rightsStatus", "retrievedAt", metadata, "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9::"BankRightsStatus", $10, $11::jsonb, NOW(), NOW()
     )
     ON CONFLICT ("sourceKey") DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      source.key,
      source.provider_key,
      source.name,
      source.url,
      source.revision,
      source.snapshot_sha256,
      source.license_spdx,
      source.rights_status.toUpperCase(),
      source.retrieved_at ? new Date(source.retrieved_at) : null,
      jsonParam(sourceMetadata(source)),
    ],
  );
  if (inserted[0]) return inserted[0].id;
  const existing = await queryRows<SourceRow>(
    client,
    `SELECT id, "sourceKey", "providerKey", name, "sourceUrl", revision, "snapshotSha256", "licenseSpdx",
            "rightsStatus"::text AS "rightsStatus", "retrievedAt", metadata
       FROM "BankSourceSnapshot" WHERE "sourceKey" = $1`,
    [source.key],
  );
  if (!existing[0]) throw new Error(`Source disappeared during apply: ${source.key}`);
  if (!sameValue(sourceComparableFromManifest(source), sourceComparableFromRow(existing[0]))) {
    throw new Error(`Source changed after planning: ${source.key}`);
  }
  return existing[0].id;
}

async function ensurePaper(client: Client, paper: PaperManifest): Promise<string> {
  const inserted = await queryRows<{ id: string }>(
    client,
    `INSERT INTO "BankPaper" (
       id, "paperKey", "examKind", "examYear", "subjectCode", "subjectName", "variantCode",
       "paperVariant", "regionScope", track, metadata, "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW(), NOW())
     ON CONFLICT ("paperKey") DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      paper.paper_key,
      paper.exam_kind,
      paper.exam_year,
      paper.subject_code,
      paper.subject_name,
      paper.variant_code,
      paper.paper_variant,
      paper.region_scope,
      paper.track,
      jsonParam(paper.metadata ?? null),
    ],
  );
  if (inserted[0]) return inserted[0].id;
  const existing = await queryRows<PaperRow>(
    client,
    `SELECT id, "paperKey", "examKind", "examYear", "subjectCode", "subjectName", "variantCode",
            "paperVariant", "regionScope", track, metadata
       FROM "BankPaper" WHERE "paperKey" = $1`,
    [paper.paper_key],
  );
  if (!existing[0]) throw new Error(`Paper disappeared during apply: ${paper.paper_key}`);
  if (!sameValue(paperComparableFromManifest(paper), paperComparableFromRow(existing[0]))) {
    throw new Error(`Paper changed after planning: ${paper.paper_key}`);
  }
  return existing[0].id;
}

async function createRun(
  client: Client,
  loaded: LoadedManifest,
  plan: IngestPlan,
  recoveredStaleRunIds: string[],
): Promise<string> {
  const runId = randomUUID();
  const revisions = unique(
    loaded.records.map((record) => `${record.source.provider_key}@${record.source.revision}`),
  )
    .sort()
    .join(",");
  const sourceRevision = revisions.length <= 512 ? revisions : `sha256:${sha256(revisions)}`;
  await client.query(
    `INSERT INTO "BankIngestRun" (
       id, "manifestSha256", "planSha256", "databaseIdentityHash", "remoteInventoryHash", "sourceRevision", "importerVersion",
       status, "startedAt", stats
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'RUNNING'::"BankIngestStatus", NOW(), $8::jsonb)`,
    [
      runId,
      loaded.manifestSha256,
      plan.planSha256,
      plan.databaseIdentitySha256,
      plan.remoteInventorySha256,
      sourceRevision,
      IMPORTER_VERSION,
      jsonParam({
        planned: plan.counts,
        preparation: plan.preparation,
        plan_sha256: plan.planSha256,
        recovered_stale_run_ids: recoveredStaleRunIds,
      }),
    ],
  );
  return runId;
}

async function recoverStaleRuns(client: Client, plan: IngestPlan): Promise<string[]> {
  const recovered = await queryRows<{ id: string }>(
    client,
    `UPDATE "BankIngestRun"
        SET status = 'FAILED'::"BankIngestStatus",
            "completedAt" = NOW(),
            "errorMessage" = $1
      WHERE status = 'RUNNING'::"BankIngestStatus"
      RETURNING id::text AS id`,
    [
      `Recovered as stale after acquiring the ingest lock; superseded by plan ${plan.planSha256}`,
    ],
  );
  return recovered.map((row) => row.id).sort();
}

async function prepareRun(
  client: Client,
  loaded: LoadedManifest,
  plan: IngestPlan,
): Promise<{
  runId: string;
  sourceIds: Map<string, string>;
  paperIds: Map<string, string>;
}> {
  return inTransaction(client, async () => {
    const recoveredStaleRunIds = await recoverStaleRuns(client, plan);
    const sourceIds = new Map<string, string>();
    const paperIds = new Map<string, string>();
    const uniqueSources = new Map(loaded.records.map((record) => [record.source.key, record.source]));
    const uniquePapers = new Map(
      loaded.records.map((record) => [record.paper.paper_key, record.paper]),
    );
    for (const source of uniqueSources.values()) {
      sourceIds.set(source.key, await ensureSource(client, source));
    }
    for (const paper of uniquePapers.values()) {
      paperIds.set(paper.paper_key, await ensurePaper(client, paper));
    }
    for (const record of loaded.records) {
      const sourceId = sourceIds.get(record.source.key);
      const paperId = paperIds.get(record.paper.paper_key);
      if (!sourceId || !paperId) throw new Error("Internal source/paper ID resolution failure");
      await client.query(
        `INSERT INTO "BankPaperSource" ("paperId", "sourceId", role)
         VALUES ($1, $2, $3::"BankSourceRole")
         ON CONFLICT ("paperId", "sourceId", role) DO NOTHING`,
        [paperId, sourceId, SOURCE_ROLE],
      );
      for (const region of record.paper.regions) {
        await client.query(
          `INSERT INTO "BankPaperRegion" (
             "paperId", "regionCode", "regionName", "sourceId", evidence
           ) VALUES ($1, $2, $3, $4, $5::jsonb)
           ON CONFLICT ("paperId", "regionCode") DO NOTHING`,
          [
            paperId,
            region.code,
            region.name,
            sourceId,
            jsonParam({
              source_key: record.source.key,
              revision: record.source.revision,
              snapshot_sha256: record.source.snapshot_sha256,
            }),
          ],
        );
        const storedRegion = await queryRows<{ regionName: string }>(
          client,
          `SELECT "regionName" FROM "BankPaperRegion"
            WHERE "paperId" = $1 AND "regionCode" = $2`,
          [paperId, region.code],
        );
        if (!storedRegion[0] || storedRegion[0].regionName !== region.name) {
          throw new Error(
            `Region changed after planning: ${record.paper.paper_key}:${region.code}`,
          );
        }
      }
    }
    const runId = await createRun(client, loaded, plan, recoveredStaleRunIds);
    return { runId, sourceIds, paperIds };
  });
}

function sectionCore(record: ManifestRecord): Record<string, unknown> {
  const { payload_hash, content_hash, review_status, raw_source, ...core } = record.section;
  void payload_hash;
  void content_hash;
  void review_status;
  void raw_source;
  return sectionPayloadCore(record.paper.paper_key, core, record.questions);
}

function questionCore(record: ManifestRecord, question: QuestionManifest): Record<string, unknown> {
  const { payload_hash, content_hash, canonical_hash, review_status, raw_source, ...core } = question;
  void payload_hash;
  void content_hash;
  void canonical_hash;
  void review_status;
  void raw_source;
  return questionPayloadCore(record.paper.paper_key, core);
}

function resolutionEvidence(
  reason: string,
  legacyCandidateIds: string[],
): Record<string, unknown> | null {
  if (reason === "new_section" || reason === "new_question") return null;
  return {
    planner: IMPORTER_VERSION,
    reason,
    legacy_candidate_ids: legacyCandidateIds,
  };
}

async function assertExistingSectionTarget(
  client: Client,
  record: ManifestRecord,
  sectionPlan: PlannedSection,
  paperId: string,
): Promise<void> {
  if (!sectionPlan.targetId) throw new Error(`Missing section target ID: ${sectionPlan.sourceKey}`);
  if (!sectionPlan.targetPayloadHash) {
    throw new Error(`Missing section target payload hash: ${sectionPlan.sourceKey}`);
  }
  const rows = await queryRows<SectionRow>(
    client,
    `SELECT id, "paperId", "sortOrder", "sectionType", "questionType", category, grade, score,
            article, instructions, analysis, options, "contentHash", "payloadHash"
       FROM "BankSection"
      WHERE id = $1
      FOR SHARE`,
    [sectionPlan.targetId],
  );
  const target = rows[0];
  if (
    !target ||
    target.paperId !== paperId ||
    target.payloadHash !== sectionPlan.targetPayloadHash ||
    !canonicalSectionMatches(record.section, target)
  ) {
    throw new Error(`Section target changed after planning: ${sectionPlan.sourceKey}`);
  }
}

async function assertExistingQuestionTarget(
  client: Client,
  question: QuestionManifest,
  questionPlan: PlannedQuestion,
  paperId: string,
): Promise<void> {
  if (!questionPlan.targetId || !questionPlan.targetSectionId) {
    throw new Error(`Missing question target ID: ${questionPlan.sourceKey}`);
  }
  if (!questionPlan.targetPayloadHash) {
    throw new Error(`Missing question target payload hash: ${questionPlan.sourceKey}`);
  }
  const rows = await queryRows<QuestionRow>(
    client,
    `SELECT id, "paperId", "sectionId", "sortOrder", "questionType", score, "correctRate",
            content, "subContent", options, answer, "contentHash", "canonicalHash", "payloadHash"
       FROM "BankQuestion"
      WHERE id = $1
      FOR SHARE`,
    [questionPlan.targetId],
  );
  const target = rows[0];
  if (
    !target ||
    target.paperId !== paperId ||
    target.sectionId !== questionPlan.targetSectionId ||
    target.payloadHash !== questionPlan.targetPayloadHash ||
    !canonicalQuestionMatches(question, target)
  ) {
    throw new Error(`Question target changed after planning: ${questionPlan.sourceKey}`);
  }
}

async function insertSection(
  client: Client,
  record: ManifestRecord,
  sectionPlan: PlannedSection,
  sourceId: string,
  paperId: string,
): Promise<void> {
  if (!sectionPlan.targetId) throw new Error(`Missing section target ID: ${sectionPlan.sourceKey}`);
  if (sectionPlan.action === "insert") {
    const section = record.section;
    await client.query(
      `INSERT INTO "BankSection" (
         id, "paperId", "sourceId", "sourceKey", "sortOrder", "sectionType", "questionType",
         title, category, grade, score, article, instructions, analysis, options, tags, metadata,
         "contentHash", "payloadHash", "reviewStatus", "rawSource", "createdAt", "updatedAt"
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
         $15::jsonb, $16::text[], $17::jsonb, $18, $19, $20::"BankReviewStatus", $21::jsonb,
         NOW(), NOW()
       )`,
      [
        sectionPlan.targetId,
        paperId,
        sourceId,
        section.source_key,
        section.sort_order,
        section.section_type,
        section.question_type,
        section.title,
        section.category,
        section.grade,
        section.score,
        section.article,
        section.instructions,
        section.analysis,
        jsonParam(section.options),
        section.tags,
        jsonParam(section.metadata),
        section.content_hash,
        section.payload_hash,
        section.review_status.toUpperCase(),
        jsonParam(section.raw_source),
      ],
    );
  } else {
    await assertExistingSectionTarget(client, record, sectionPlan, paperId);
  }
  await client.query(
    `INSERT INTO "BankSectionSource" (
       "sectionId", "sourceId", "sourceItemKey", role, "payloadHash", "sourcePayload",
       "rawSource", "resolutionEvidence", "createdAt"
     ) VALUES ($1, $2, $3, $4::"BankSourceRole", $5, $6::jsonb, $7::jsonb, $8::jsonb, NOW())
     ON CONFLICT ("sourceId", "sourceItemKey", role) DO NOTHING`,
    [
      sectionPlan.targetId,
      sourceId,
      record.section.source_item_key,
      SOURCE_ROLE,
      record.section.payload_hash,
      jsonParam(sectionSourcePayload(record)),
      jsonParam(record.section.raw_source),
      jsonParam(resolutionEvidence(sectionPlan.reason, sectionPlan.legacyCandidateIds)),
    ],
  );
  const storedLink = await queryRows<
    Pick<SectionSourceRow, "sectionId" | "payloadHash" | "sourcePayload" | "rawSource">
  >(
    client,
    `SELECT "sectionId", "payloadHash", "sourcePayload", "rawSource"
       FROM "BankSectionSource"
      WHERE "sourceId" = $1 AND "sourceItemKey" = $2 AND role = $3::"BankSourceRole"`,
    [sourceId, record.section.source_item_key, SOURCE_ROLE],
  );
  if (
    !storedLink[0] ||
    storedLink[0].sectionId !== sectionPlan.targetId ||
    storedLink[0].payloadHash !== record.section.payload_hash ||
    !sectionSourceProvenanceMatches(record, storedLink[0])
  ) {
    throw new Error(`Section source link changed after planning: ${sectionPlan.sourceKey}`);
  }
}

async function insertQuestion(
  client: Client,
  record: ManifestRecord,
  question: QuestionManifest,
  questionPlan: PlannedQuestion,
  sourceId: string,
  paperId: string,
): Promise<void> {
  if (!questionPlan.targetId || !questionPlan.targetSectionId) {
    throw new Error(`Missing question target ID: ${questionPlan.sourceKey}`);
  }
  if (questionPlan.action === "insert") {
    await client.query(
      `INSERT INTO "BankQuestion" (
         id, "paperId", "sectionId", "sourceId", "sourceKey", "sourceQuestionNo", "sortOrder",
         "questionType", score, "correctRate", content, "subContent", options, answer, analysis,
         metadata, "contentHash", "canonicalHash", "payloadHash", "reviewStatus", "rawSource",
         "createdAt", "updatedAt"
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb,
         $15, $16::jsonb, $17, $18, $19, $20::"BankReviewStatus", $21::jsonb, NOW(), NOW()
       )`,
      [
        questionPlan.targetId,
        paperId,
        questionPlan.targetSectionId,
        sourceId,
        question.source_key,
        question.source_question_no,
        question.sort_order,
        question.question_type,
        question.score,
        question.correct_rate,
        question.content,
        question.sub_content,
        jsonParam(question.options),
        jsonParam(question.answer),
        question.analysis,
        jsonParam(question.metadata),
        question.content_hash,
        question.canonical_hash,
        question.payload_hash,
        question.review_status.toUpperCase(),
        jsonParam(question.raw_source),
      ],
    );
  } else {
    await assertExistingQuestionTarget(client, question, questionPlan, paperId);
  }
  await client.query(
    `INSERT INTO "BankQuestionSource" (
       "questionId", "sourceId", "sourceItemKey", role, "payloadHash", "sourcePayload",
       "rawSource", "resolutionEvidence", "createdAt"
     ) VALUES ($1, $2, $3, $4::"BankSourceRole", $5, $6::jsonb, $7::jsonb, $8::jsonb, NOW())
     ON CONFLICT ("sourceId", "sourceItemKey", role) DO NOTHING`,
    [
      questionPlan.targetId,
      sourceId,
      question.source_item_key,
      SOURCE_ROLE,
      question.payload_hash,
      jsonParam(questionSourcePayload(record, question)),
      jsonParam(question.raw_source),
      jsonParam(resolutionEvidence(questionPlan.reason, questionPlan.legacyCandidateIds)),
    ],
  );
  const storedLink = await queryRows<
    Pick<QuestionSourceRow, "questionId" | "payloadHash" | "sourcePayload" | "rawSource">
  >(
    client,
    `SELECT "questionId", "payloadHash", "sourcePayload", "rawSource"
       FROM "BankQuestionSource"
      WHERE "sourceId" = $1 AND "sourceItemKey" = $2 AND role = $3::"BankSourceRole"`,
    [sourceId, question.source_item_key, SOURCE_ROLE],
  );
  if (
    !storedLink[0] ||
    storedLink[0].questionId !== questionPlan.targetId ||
    storedLink[0].payloadHash !== question.payload_hash ||
    !questionSourceProvenanceMatches(record, question, storedLink[0])
  ) {
    throw new Error(`Question source link changed after planning: ${questionPlan.sourceKey}`);
  }
}

function ingestAction(action: PlanAction): string {
  if (action === "insert") return "INSERTED";
  if (action === "skip_identical") return "SKIPPED_IDENTICAL";
  if (action === "link_canonical") return "LINKED_EXISTING";
  return "CONFLICT";
}

async function insertIngestItem(
  client: Client,
  runId: string,
  item: PlannedSection | PlannedQuestion,
  itemKind: "section" | "question",
  paperId: string,
  afterHash: string,
): Promise<void> {
  const sectionId =
    itemKind === "section"
      ? item.targetId
      : "targetSectionId" in item
        ? item.targetSectionId
        : null;
  await client.query(
    `INSERT INTO "BankIngestItem" (
       id, "runId", "sourceKey", "itemKind", action, "paperId", "sectionId", "questionId",
       "beforeHash", "afterHash", details, "createdAt"
     ) VALUES (
       $1, $2::uuid, $3, $4, $5::"BankIngestAction", $6, $7, $8, $9, $10, $11::jsonb, NOW()
     )`,
    [
      randomUUID(),
      runId,
      item.sourceKey,
      itemKind,
      ingestAction(item.action),
      paperId,
      sectionId,
      itemKind === "question" ? item.targetId : null,
      item.existingPayloadHash,
      item.action === "conflict" ? null : afterHash,
      jsonParam({
        reason: item.reason,
        source_item_key: item.sourceItemKey,
        paper_key: item.paperKey,
        legacy_candidate_ids: item.legacyCandidateIds,
      }),
    ],
  );
}

async function markRunFailed(client: Client, runId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await client.query(
    `UPDATE "BankIngestRun"
        SET status = 'FAILED'::"BankIngestStatus", "completedAt" = NOW(), "errorMessage" = $2
      WHERE id = $1::uuid`,
    [runId, message],
  );
}

async function markRunCompleted(client: Client, runId: string, plan: IngestPlan): Promise<void> {
  await client.query(
    `UPDATE "BankIngestRun"
        SET status = 'COMPLETED'::"BankIngestStatus",
            "completedAt" = NOW(),
            stats = COALESCE(stats, '{}'::jsonb) || $2::jsonb
      WHERE id = $1::uuid`,
    [
      runId,
      jsonParam({
        completed: plan.counts,
        preparation: plan.preparation,
        plan_sha256: plan.planSha256,
      }),
    ],
  );
}

async function applyPlan(
  client: Client,
  loaded: LoadedManifest,
  plan: IngestPlan,
  batchSize: number,
): Promise<string> {
  const prepared = await prepareRun(client, loaded, plan);
  const sectionPlans = new Map(plan.sections.map((section) => [section.recordIndex, section]));
  const questionPlans = new Map(
    plan.questions.map((question) => [mapKey(question.recordIndex, question.questionIndex), question]),
  );
  try {
    for (let offset = 0; offset < loaded.records.length; offset += batchSize) {
      const batch = loaded.records.slice(offset, offset + batchSize);
      await inTransaction(client, async () => {
        for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
          const recordIndex = offset + batchIndex;
          const record = batch[batchIndex];
          const sectionPlan = sectionPlans.get(recordIndex);
          const sourceId = prepared.sourceIds.get(record.source.key);
          const paperId = prepared.paperIds.get(record.paper.paper_key);
          if (!sectionPlan || !sourceId || !paperId) {
            throw new Error(`Internal plan resolution failure at record ${recordIndex}`);
          }
          await insertSection(client, record, sectionPlan, sourceId, paperId);
          await insertIngestItem(
            client,
            prepared.runId,
            sectionPlan,
            "section",
            paperId,
            record.section.payload_hash,
          );
          for (let questionIndex = 0; questionIndex < record.questions.length; questionIndex += 1) {
            const question = record.questions[questionIndex];
            const questionPlan = questionPlans.get(mapKey(recordIndex, questionIndex));
            if (!questionPlan) {
              throw new Error(`Internal question plan resolution failure at ${recordIndex}:${questionIndex}`);
            }
            await insertQuestion(client, record, question, questionPlan, sourceId, paperId);
            await insertIngestItem(
              client,
              prepared.runId,
              questionPlan,
              "question",
              paperId,
              question.payload_hash,
            );
          }
        }
      });
    }
    await markRunCompleted(client, prepared.runId, plan);
    return prepared.runId;
  } catch (error) {
    try {
      await markRunFailed(client, prepared.runId, error);
    } catch (markError) {
      console.error(
        `Failed to mark ingest run ${prepared.runId} as FAILED: ${markError instanceof Error ? markError.message : String(markError)}`,
      );
    }
    throw error;
  }
}

export function assertApplyConfirmations(loaded: LoadedManifest, plan: IngestPlan): void {
  if (process.env.GAOKAO_APPLY_CONFIRM !== loaded.manifestSha256) {
    throw new Error(
      `GAOKAO_APPLY_CONFIRM must exactly equal manifest SHA-256 ${loaded.manifestSha256}`,
    );
  }
  if (process.env.GAOKAO_PLAN_CONFIRM !== plan.planSha256) {
    throw new Error(
      `GAOKAO_PLAN_CONFIRM must exactly equal plan SHA-256 ${plan.planSha256}`,
    );
  }
  if (process.env.GAOKAO_DATABASE_CONFIRM !== plan.databaseIdentitySha256) {
    throw new Error(
      `GAOKAO_DATABASE_CONFIRM must exactly equal database identity SHA-256 ${plan.databaseIdentitySha256}`,
    );
  }
  if (process.env.GAOKAO_REMOTE_INVENTORY_CONFIRM !== plan.remoteInventorySha256) {
    throw new Error(
      `GAOKAO_REMOTE_INVENTORY_CONFIRM must exactly equal remote inventory SHA-256 ${plan.remoteInventorySha256}`,
    );
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const loaded = await loadAndValidateManifest(options.manifestPath);
  assertIngestPolicy(loaded.records, options);
  if (options.validateOnly) {
    console.log(
      JSON.stringify(
        {
          valid: true,
          manifest_sha256: loaded.manifestSha256,
          records: loaded.records.length,
          questions: loaded.records.reduce((count, record) => count + record.questions.length, 0),
          review_required: reviewRequired(loaded.records),
        },
        null,
        2,
      ),
    );
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for remote inventory planning (or use --validate-only)");
  }
  const client = new Client({ connectionString });
  let lockHeld = false;
  await client.connect();
  try {
    await assertDatabaseShape(client);
    if (options.apply) {
      await acquireAdvisoryLock(client);
      lockHeld = true;
    }
    const inventory = await loadRemoteInventory(client, loaded.records, connectionString);
    const plan = buildPlan(loaded, inventory, options.batchSize);
    await emitPlan(plan, options, reviewRequired(loaded.records));
    if (plan.issues.length > 0) {
      throw new Error(`Apply blocked by ${plan.issues.length} conflict(s); resolve and re-plan`);
    }
    if (!options.apply) return;
    assertApplyConfirmations(loaded, plan);
    const runId = await applyPlan(client, loaded, plan, plan.batchSize);
    console.log(
      JSON.stringify(
        {
          applied: true,
          ingest_run_id: runId,
          manifest_sha256: loaded.manifestSha256,
          plan_sha256: plan.planSha256,
          database_identity_sha256: plan.databaseIdentitySha256,
          confirmed_remote_inventory_sha256: plan.remoteInventorySha256,
          counts: plan.counts,
        },
        null,
        2,
      ),
    );
  } finally {
    if (lockHeld) {
      try {
        await releaseAdvisoryLock(client);
      } catch (error) {
        console.error(
          `Failed to release advisory lock cleanly: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    await client.end();
  }
}

const isMainModule = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;

if (isMainModule) {
  main().catch((error: unknown) => {
    if (error instanceof ManifestValidationError) {
      console.error(error.message);
      error.issues.forEach((issue) => console.error(`- ${issue}`));
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  });
}
