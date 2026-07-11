import type {
  BuildRecordResult,
  JsonValue,
  ManifestRecord,
  QuestionManifest,
  SectionManifest,
  SourceDefinition,
} from "./model";
import {
  canonicalText,
  normalizeText,
  questionPayloadCore,
  sectionPayloadCore,
  sha256,
  stableStringify,
} from "./normalize";

export interface RawGaoKaoMathRow {
  id?: unknown;
  problem?: unknown;
  answer?: unknown;
  score?: unknown;
  year?: unknown;
  number?: unknown;
  province?: unknown;
  [key: string]: unknown;
}

function jsonRow(row: RawGaoKaoMathRow): JsonValue {
  return JSON.parse(JSON.stringify(row)) as JsonValue;
}

function inferQuestionType(problem: string, answer: string): "choice" | "multiple" | "input" {
  const normalizedAnswer = answer.replace(/[\s,，、;；/]+/g, "").toUpperCase();
  const hasOptions = /(?:^|\s)A[.．、)]/.test(problem) && /(?:^|\s)B[.．、)]/.test(problem);
  if (hasOptions && /^[A-Z]{1,8}$/.test(normalizedAnswer)) {
    return normalizedAnswer.length > 1 ? "multiple" : "choice";
  }
  return "input";
}

export function buildGaoKaoMathRecord(input: {
  row: RawGaoKaoMathRow;
  source: SourceDefinition;
  sourceFile: string;
}): BuildRecordResult {
  const { row, source, sourceFile } = input;
  const year = Number(row.year);
  const id = Number(row.id);
  const problem = normalizeText(row.problem);
  const answer = normalizeText(row.answer);
  const score = Number(row.score);
  const questionNumber = normalizeText(row.number);
  const province = normalizeText(row.province);
  const errors: string[] = [];

  if (!Number.isInteger(year)) errors.push("invalid_year");
  if (!Number.isSafeInteger(id) || id < 0) errors.push("invalid_id");
  if (!problem) errors.push("empty_problem");
  if (!answer) errors.push("empty_answer");
  if (!Number.isFinite(score) || score < 0) errors.push("invalid_score");
  if (!questionNumber) errors.push("empty_question_number");
  if (province !== "Shanghai") errors.push("unsupported_or_unknown_province");

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      raw: jsonRow(row),
      source_file: sourceFile,
    };
  }

  const paperKey = `gaokao:${year}:province-shanghai:mathematics`;
  const paddedId = String(id).padStart(8, "0");
  const sourceItemKey = `${source.key}:${sourceFile}:id:${paddedId}`;
  const questionType = inferQuestionType(problem, answer);
  const sectionContentHash = sha256(canonicalText(problem));
  const questionCore = {
    source_key: `${sourceItemKey}:child:1`,
    source_item_key: `${sourceItemKey}:child:1`,
    source_question_no: questionNumber,
    sort_order: 1,
    question_type: questionType,
    score,
    correct_rate: null,
    content: "",
    sub_content: null,
    options: null,
    answer,
    analysis: null,
    metadata: {
      dataset_id: id,
      source_language: "en",
      original_exam_language: "zh",
      source_question_number: questionNumber,
      answer_format_unverified: true,
    } as JsonValue,
  };
  const question: QuestionManifest = {
    ...questionCore,
    content_hash: sha256(`${sectionContentHash}\0${0}`),
    canonical_hash: sha256(stableStringify({
      subject_code: "mathematics",
      section_content_hash: sectionContentHash,
      child_index: 0,
      question_type: questionType,
    })),
    payload_hash: sha256(stableStringify(questionPayloadCore(paperKey, questionCore))),
    review_status: "review_required",
    raw_source: jsonRow(row),
  };

  const sectionCore = {
    source_key: sourceItemKey,
    source_item_key: sourceItemKey,
    sort_order: 0,
    section_type: "math",
    question_type: questionType === "choice" || questionType === "multiple"
      ? "objective"
      : "open-ended",
    title: `${year}年上海卷数学 ${questionNumber}`,
    category: "math",
    grade: "高三",
    score,
    article: problem,
    instructions: null,
    analysis: null,
    options: null,
    tags: ["数学", "高考真题", String(year), "上海卷"],
    metadata: {
      source_file: sourceFile,
      dataset_id: id,
      source_language: "en",
      original_exam_language: "zh",
      translation_provenance: "source_dataset",
      paper_metadata_verified: true,
      answer_format_unverified: true,
    } as JsonValue,
  };
  const section: SectionManifest = {
    ...sectionCore,
    content_hash: sectionContentHash,
    payload_hash: sha256(stableStringify(sectionPayloadCore(paperKey, sectionCore, [question]))),
    review_status: "review_required",
    raw_source: jsonRow(row),
  };

  const record: ManifestRecord = {
    schema_version: 1,
    source: {
      key: `${source.key}@${source.revision}`,
      provider_key: source.key,
      name: source.name,
      url: source.url,
      revision: source.revision,
      snapshot_sha256: source.snapshotSha256,
      license_spdx: source.licenseSpdx,
      rights_status: source.rightsStatus,
      retrieved_at: source.retrievedAt,
      metadata: source.metadata,
    },
    paper: {
      paper_key: paperKey,
      exam_kind: "gaokao",
      exam_year: year,
      subject_code: "mathematics",
      subject_name: "数学",
      variant_code: "province-shanghai",
      paper_variant: "上海卷",
      region_scope: "上海",
      track: null,
      regions: [{ code: "shanghai", name: "上海" }],
      metadata: {
        paper_metadata_verified: true,
        source_language: "en",
        original_exam_language: "zh",
      },
    },
    section,
    questions: [question],
  };

  return { valid: true, record };
}
