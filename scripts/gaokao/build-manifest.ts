#!/usr/bin/env tsx

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type {
  JsonValue,
  ManifestRecord,
  RawGaokaoRow,
  RightsStatus,
  SourceDefinition,
} from "./lib/model";
import {
  buildManifestRecord,
  sectionPayloadCore,
  sha256,
  stablePositiveInt,
  stableStringify,
} from "./lib/normalize";
import { loadMetadataOverrides } from "./lib/metadata-overrides";
import {
  buildGaoKaoMathRecord,
  type RawGaoKaoMathRow,
} from "./lib/gaokao-math";

interface SourceConfig {
  arg: string;
  adapter: "gaokao-bench-json" | "gaokao-math-jsonl";
  data_file?: string;
  provider_key: string;
  name: string;
  url: string;
  revision: string;
  repo_license_spdx: string | null;
  content_rights_status: RightsStatus;
}

interface Args {
  [key: string]: string | boolean | undefined;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function textArg(args: Args, key: string, fallback?: string): string | undefined {
  const value = args[key];
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new Error(`--${key} requires a value`);
  return value;
}

function git(repoRoot: string, gitArgs: string[]): string {
  return childProcess.execFileSync("git", ["-C", repoRoot, ...gitArgs], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function listJsonFiles(root: string): string[] {
  const output: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...listJsonFiles(absolute));
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) output.push(absolute);
  }
  return output.sort((left, right) => left.localeCompare(right, "en"));
}

function rowsFromJson(filePath: string): RawGaokaoRow[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  if (Array.isArray(parsed)) return parsed as RawGaokaoRow[];
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { example?: unknown }).example)) {
    return (parsed as { example: RawGaokaoRow[] }).example;
  }
  throw new Error(`Unsupported source JSON shape: ${filePath}`);
}

function rowsFromJsonLines(filePath: string): RawGaoKaoMathRow[] {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as RawGaoKaoMathRow;
      } catch (error) {
        throw new Error(
          `Invalid JSONL at ${filePath}:${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
}

function increment(root: Record<string, unknown>, keys: string[], amount = 1): void {
  let cursor = root;
  for (const key of keys.slice(0, -1)) {
    const next = cursor[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  const leaf = keys.at(-1)!;
  cursor[leaf] = Number(cursor[leaf] ?? 0) + amount;
}

function loadSourceConfigs(): SourceConfig[] {
  const file = path.join(import.meta.dirname, "sources.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as {
    schema_version?: number;
    sources?: SourceConfig[];
  };
  if (parsed.schema_version !== 1 || !Array.isArray(parsed.sources)) {
    throw new Error(`Unsupported source config: ${file}`);
  }
  return parsed.sources;
}

function sourceDefinition(repoRoot: string, config: SourceConfig, allowUnpinned: boolean): SourceDefinition {
  const revision = git(repoRoot, ["rev-parse", "HEAD"]);
  if (!allowUnpinned && revision !== config.revision) {
    throw new Error(
      `${config.provider_key} revision is ${revision}; expected pinned ${config.revision}`,
    );
  }
  const treeInventory = git(repoRoot, ["ls-tree", "-r", "--full-tree", "HEAD"]);
  const commitTimestamp = git(repoRoot, ["show", "-s", "--format=%cI", "HEAD"]) || null;
  return {
    key: config.provider_key,
    name: config.name,
    url: config.url,
    revision,
    snapshotSha256: sha256(treeInventory),
    // Clone time is not reproducible and the commit timestamp is not a
    // retrieval timestamp. Keep this null unless a future manifest format
    // accepts an operator-supplied acquisition receipt.
    retrievedAt: null,
    // A repository license does not establish rights to republish embedded
    // exam papers or third-party explanations. Keep content gated separately.
    licenseSpdx: config.repo_license_spdx,
    rightsStatus: config.content_rights_status,
    metadata: {
      repo_license_spdx: config.repo_license_spdx,
      content_license_verified: false,
      git_tree_inventory_sha256: sha256(treeInventory),
      git_commit_timestamp: commitTimestamp,
    },
  };
}

function recomputeSectionPayload(record: ManifestRecord): void {
  const { payload_hash: _payload, content_hash: _content, review_status: _review, raw_source: _raw, ...core } =
    record.section;
  void _payload;
  void _content;
  void _review;
  void _raw;
  record.section.payload_hash = sha256(
    stableStringify(sectionPayloadCore(record.paper.paper_key, core, record.questions)),
  );
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const fromYear = Number(textArg(args, "from-year", "2016"));
  const toYear = Number(textArg(args, "to-year", "2025"));
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || fromYear > toYear) {
    throw new Error("Invalid --from-year/--to-year range");
  }

  const output = path.resolve(textArg(args, "output", ".cache/gaokao/2016-2025.jsonl")!);
  const quarantineOutput = path.resolve(
    textArg(args, "quarantine", `${output}.quarantine.jsonl`)! ,
  );
  const summaryOutput = path.resolve(textArg(args, "summary", `${output}.summary.json`)!);
  const allowUnpinned = args["allow-unpinned"] === true;
  const metadataOverrides = loadMetadataOverrides(textArg(args, "overrides"));
  const records: ManifestRecord[] = [];
  const quarantine: JsonValue[] = [];
  const sources: SourceDefinition[] = [];

  for (const config of loadSourceConfigs()) {
    const configuredRoot = textArg(args, config.arg);
    if (!configuredRoot) continue;
    const repoRoot = path.resolve(configuredRoot);
    const source = sourceDefinition(repoRoot, config, allowUnpinned);
    sources.push(source);

    if (config.adapter === "gaokao-math-jsonl") {
      if (!config.data_file) throw new Error(`${config.provider_key} requires data_file`);
      const dataFile = path.join(repoRoot, config.data_file);
      if (!fs.existsSync(dataFile)) throw new Error(`Missing source data file: ${dataFile}`);
      for (const row of rowsFromJsonLines(dataFile)) {
        const year = Number(row.year);
        if (year < fromYear || year > toYear) continue;
        const result = buildGaoKaoMathRecord({
          row,
          source,
          sourceFile: config.data_file.replace(/\\/g, "/"),
        });
        if (result.valid) records.push(result.record);
        else {
          quarantine.push({
            kind: "invalid_source_record",
            source: `${source.key}@${source.revision}`,
            ...result,
          } as unknown as JsonValue);
        }
      }
      continue;
    }

    const dataRoot = path.join(repoRoot, "Data");
    if (!fs.existsSync(dataRoot)) throw new Error(`Missing source data directory: ${dataRoot}`);

    for (const filePath of listJsonFiles(dataRoot)) {
      const relativePath = path.relative(dataRoot, filePath).replace(/\\/g, "/");
      for (const row of rowsFromJson(filePath)) {
        const year = Number(row.year);
        if (year < fromYear || year > toYear) continue;
        const categoryOverride = metadataOverrides.match(source, relativePath, row);
        const result = buildManifestRecord({ row, relativePath, source, categoryOverride });
        if (result.valid) records.push(result.record);
        else {
          quarantine.push({
            kind: "invalid_source_record",
            source: `${source.key}@${source.revision}`,
            ...result,
          } as unknown as JsonValue);
        }
      }
    }
  }

  if (!sources.length) throw new Error("Provide --bench-root and/or --updates-root");
  metadataOverrides.assertApplied(new Set(sources.map((source) => source.key)), fromYear, toYear);

  records.sort((left, right) =>
    left.paper.exam_year - right.paper.exam_year ||
    left.paper.subject_code.localeCompare(right.paper.subject_code, "en") ||
    left.paper.variant_code.localeCompare(right.paper.variant_code, "en") ||
    left.section.source_key.localeCompare(right.section.source_key, "en"),
  );

  const seenSourceKeys = new Set<string>();
  const paperKeys = new Set<string>();
  const paperSortOrders = new Map<string, Map<number, string>>();
  const canonicalCandidates = new Map<string, Array<{
    source_key: string;
    payload_hash: string;
    answer: JsonValue;
    score: number | null;
  }>>();
  const sectionContentCandidates = new Map<string, Array<{
    source_key: string;
    subject_code: string;
    answers: JsonValue;
    score: number | null;
  }>>();
  const deduplicated: ManifestRecord[] = [];
  for (const record of records) {
    if (seenSourceKeys.has(record.section.source_key)) {
      quarantine.push({ kind: "duplicate_source_key", record } as unknown as JsonValue);
      continue;
    }
    seenSourceKeys.add(record.section.source_key);
    paperKeys.add(record.paper.paper_key);
    const sortOrder = stablePositiveInt(`gaokao-section-order-v1\0${record.section.source_key}`);
    const usedOrders = paperSortOrders.get(record.paper.paper_key) ?? new Map<number, string>();
    const owner = usedOrders.get(sortOrder);
    if (owner && owner !== record.section.source_key) {
      throw new Error(
        `Stable sort-order collision in ${record.paper.paper_key}: ${owner} and ${record.section.source_key}`,
      );
    }
    usedOrders.set(sortOrder, record.section.source_key);
    paperSortOrders.set(record.paper.paper_key, usedOrders);
    record.section.sort_order = sortOrder;
    recomputeSectionPayload(record);
    for (const question of record.questions) {
      const matches = canonicalCandidates.get(question.canonical_hash) ?? [];
      matches.push({
        source_key: question.source_key,
        payload_hash: question.payload_hash,
        answer: question.answer,
        score: question.score,
      });
      canonicalCandidates.set(question.canonical_hash, matches);
    }
    const contentMatches = sectionContentCandidates.get(record.section.content_hash) ?? [];
    contentMatches.push({
      source_key: record.section.source_key,
      subject_code: record.paper.subject_code,
      answers: record.questions.map((question) => question.answer),
      score: record.section.score,
    });
    sectionContentCandidates.set(record.section.content_hash, contentMatches);
    deduplicated.push(record);
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  const manifestText = deduplicated.map((record) => JSON.stringify(record)).join("\n") +
    (deduplicated.length ? "\n" : "");
  fs.writeFileSync(output, manifestText, "utf8");
  fs.writeFileSync(
    quarantineOutput,
    quarantine.map((record) => JSON.stringify(record)).join("\n") + (quarantine.length ? "\n" : ""),
    "utf8",
  );

  const duplicateGroups = [...canonicalCandidates.values()].filter((items) => items.length > 1);
  const duplicateSectionGroups = [...sectionContentCandidates.values()].filter(
    (items) => items.length > 1,
  );
  const coverage = Object.fromEntries(
    Array.from({ length: toYear - fromYear + 1 }, (_, index) => [String(fromYear + index), {}]),
  );
  const coverageYearTotals = Object.fromEntries(
    Array.from({ length: toYear - fromYear + 1 }, (_, index) => [String(fromYear + index), 0]),
  );
  const summary: Record<string, unknown> = {
    schema_version: 1,
    year_range: { from: fromYear, to: toYear },
    manifest_sha256: sha256(manifestText),
    record_count: deduplicated.length,
    child_question_count: deduplicated.reduce((total, record) => total + record.questions.length, 0),
    paper_count: paperKeys.size,
    quarantine_count: quarantine.length,
    metadata_override_count: metadataOverrides.appliedCount,
    canonical_candidate_groups: duplicateGroups.length,
    canonical_answer_conflict_groups: duplicateGroups.filter(
      (items) => new Set(items.map((item) => stableStringify(item.answer))).size > 1,
    ).length,
    canonical_score_conflict_groups: duplicateGroups.filter(
      (items) => new Set(items.map((item) => String(item.score))).size > 1,
    ).length,
    section_content_candidate_groups: duplicateSectionGroups.length,
    section_content_cross_subject_groups: duplicateSectionGroups.filter(
      (items) => new Set(items.map((item) => item.subject_code)).size > 1,
    ).length,
    section_content_answer_conflict_groups: duplicateSectionGroups.filter(
      (items) => new Set(items.map((item) => stableStringify(item.answers))).size > 1,
    ).length,
    section_content_score_conflict_groups: duplicateSectionGroups.filter(
      (items) => new Set(items.map((item) => String(item.score))).size > 1,
    ).length,
    sources,
    coverage,
    coverage_year_totals: coverageYearTotals,
    rights: {},
    section_types: {},
  };
  for (const record of deduplicated) {
    increment(summary.coverage as Record<string, unknown>, [
      String(record.paper.exam_year),
      record.paper.paper_variant,
      record.paper.subject_code,
    ]);
    increment(summary.coverage_year_totals as Record<string, unknown>, [
      String(record.paper.exam_year),
    ]);
    increment(summary.rights as Record<string, unknown>, [record.source.rights_status]);
    increment(summary.section_types as Record<string, unknown>, [record.section.question_type]);
  }

  fs.writeFileSync(summaryOutput, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify({ output, quarantine: quarantineOutput, summary: summaryOutput, ...summary })}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
