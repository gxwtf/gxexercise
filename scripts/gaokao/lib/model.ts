export type RightsStatus = "approved" | "review_required" | "restricted";
export type ReviewStatus = "approved" | "review_required" | "invalid";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface SourceManifest {
  key: string;
  provider_key: string;
  name: string;
  url: string;
  revision: string;
  snapshot_sha256: string;
  license_spdx: string | null;
  rights_status: RightsStatus;
  retrieved_at: string | null;
  metadata?: JsonValue;
}

export interface PaperRegionManifest {
  code: string;
  name: string;
}

export interface PaperManifest {
  paper_key: string;
  exam_kind: string;
  exam_year: number;
  subject_code: string;
  subject_name: string;
  variant_code: string;
  paper_variant: string;
  region_scope: string;
  track: string | null;
  regions: PaperRegionManifest[];
  metadata?: JsonValue;
}

export interface QuestionManifest {
  source_key: string;
  source_item_key: string;
  source_question_no: string | null;
  sort_order: number;
  question_type: string;
  score: number | null;
  correct_rate: number | null;
  content: string;
  sub_content: string | null;
  options: JsonValue;
  answer: JsonValue;
  analysis: string | null;
  metadata: JsonValue;
  content_hash: string;
  canonical_hash: string;
  payload_hash: string;
  review_status: ReviewStatus;
  raw_source: JsonValue;
}

export interface SectionManifest {
  source_key: string;
  source_item_key: string;
  sort_order: number;
  section_type: string | null;
  question_type: string;
  title: string | null;
  category: string | null;
  grade: string | null;
  score: number | null;
  article: string | null;
  instructions: string | null;
  analysis: string | null;
  options: JsonValue;
  tags: string[];
  metadata: JsonValue;
  content_hash: string;
  payload_hash: string;
  review_status: ReviewStatus;
  raw_source: JsonValue;
}

export interface ManifestRecord {
  schema_version: 1;
  source: SourceManifest;
  paper: PaperManifest;
  section: SectionManifest;
  questions: QuestionManifest[];
}

export interface RawGaokaoRow {
  year?: unknown;
  category?: unknown;
  question?: unknown;
  answer?: unknown;
  analysis?: unknown;
  index?: unknown;
  score?: unknown;
  [key: string]: unknown;
}

export interface SourceDefinition {
  key: string;
  name: string;
  url: string;
  revision: string;
  snapshotSha256: string;
  retrievedAt: string | null;
  licenseSpdx: string | null;
  rightsStatus: RightsStatus;
  metadata?: JsonValue;
}

export interface NormalizedCategory {
  variant: string;
  variantCode: string;
  regionScope: string;
  track: string | null;
  regions: PaperRegionManifest[];
  verified: boolean;
}

export interface NormalizedSubject {
  code: string;
  name: string;
  track: string | null;
}

export type BuildRecordResult =
  | { valid: true; record: ManifestRecord }
  | {
      valid: false;
      errors: string[];
      raw: JsonValue;
      source_file: string;
    };
