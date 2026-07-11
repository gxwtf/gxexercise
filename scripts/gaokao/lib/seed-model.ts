import type { JsonValue } from "./model";
import { canonicalText, sha256, stableStringify } from "./normalize";

const SUBJECT_CODES = new Map([
  ["语文", "chinese"],
  ["数学", "mathematics"],
  ["英语", "english"],
  ["物理", "physics"],
  ["化学", "chemistry"],
  ["生物", "biology"],
  ["历史", "history"],
  ["地理", "geography"],
  ["思想政治", "politics"],
  ["政治", "politics"],
]);

export interface SeedQuestionModel {
  sourceLocalId: string;
  sourceKeySuffix: string;
  orderIndex: number;
  blankIndex: number | null;
  questionType: string;
  content: string;
  options: JsonValue;
  answer: JsonValue;
  analysis: string | null;
  score: number;
  correctRate: number | null;
  metadata: JsonValue;
  rawPayload: JsonValue;
  payloadHash: string;
}

export interface SeedSectionModel {
  sourceKeySuffix: string;
  orderIndex: number;
  sectionType: string;
  questionType: string;
  title: string;
  category: string;
  score: number;
  grade: string;
  source: string;
  tags: string[];
  article: string;
  instructions: string | null;
  options: JsonValue;
  questions: SeedQuestionModel[];
  rawPayload: JsonValue;
  payloadHash: string;
}

export interface SeedDocumentModel {
  subject: { code: string; name: string; sourceField: "subject" | "subjects" };
  sections: SeedSectionModel[];
  sectionCount: number;
  questionCount: number;
  totalScore: number;
  canonicalJsonHash: string;
  rawPayload: JsonValue;
}

function error(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) error(path, "must be an object");
  return value as Record<string, unknown>;
}

function string(
  value: unknown,
  path: string,
  options: { allowEmpty?: boolean; max?: number } = {},
): string {
  const { allowEmpty = false, max = Number.MAX_SAFE_INTEGER } = options;
  if (typeof value !== "string") error(path, "must be a string");
  if (!allowEmpty && !value.trim()) error(path, "must not be empty");
  if (value.length > max) error(path, `must be at most ${max} characters`);
  return value;
}

function number(value: unknown, path: string, min = 0, max = 999999.99): number {
  if (typeof value !== "number" || !Number.isFinite(value)) error(path, "must be a number");
  if (value < min || value > max) error(path, `must be between ${min} and ${max}`);
  return value;
}

function json(value: unknown, path: string): JsonValue {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) error(path, "must be JSON-compatible");
    return JSON.parse(serialized) as JsonValue;
  } catch {
    return error(path, "must be JSON-compatible");
  }
}

function identifier(value: unknown, path: string, max: number): string {
  const result = string(value, path, { max });
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(result)) {
    error(path, "must use ASCII letters, digits, underscore or hyphen");
  }
  return result;
}

function normalizeSeedQuestion(
  raw: unknown,
  context: {
    path: string;
    sectionOrder: number;
    questionIndex: number;
    sectionQuestionType: string;
    sectionOptions: JsonValue;
  },
): SeedQuestionModel {
  const path = `${context.path}.questions[${context.questionIndex}]`;
  const question = object(raw, path);
  if (!("id" in question)) error(`${path}.id`, "is required");
  const sourceLocalId = string(String(question.id), `${path}.id`, { max: 100 });
  const questionType = question.questionType === undefined
    ? context.sectionQuestionType === "seven-choose-five"
      ? "choice"
      : context.sectionQuestionType
    : identifier(question.questionType, `${path}.questionType`, 100);
  const content = question.content === undefined
    ? ""
    : string(question.content, `${path}.content`, { allowEmpty: true });
  const options = question.options === undefined
    ? context.sectionOptions
    : json(question.options, `${path}.options`);
  if (!("answer" in question)) error(`${path}.answer`, "is required");
  const answer = json(question.answer, `${path}.answer`);
  const analysis = question.analysis === undefined || question.analysis === null
    ? null
    : string(question.analysis, `${path}.analysis`, { allowEmpty: true });
  const score = number(question.score, `${path}.score`);
  const correctRate = question.correctRate === undefined || question.correctRate === null
    ? null
    : number(question.correctRate, `${path}.correctRate`, 0, 1);
  let blankIndex: number | null = null;
  if (question.blankIndex !== undefined && question.blankIndex !== null) {
    if (!Number.isInteger(question.blankIndex) || Number(question.blankIndex) < 0) {
      error(`${path}.blankIndex`, "must be a non-negative integer");
    }
    blankIndex = Number(question.blankIndex);
  }
  const metadata: JsonValue = {
    source_local_id: sourceLocalId,
    ...(question.questionType === undefined ? { inherited_question_type: true } : {}),
  };
  const core = {
    source_local_id: sourceLocalId,
    order_index: context.questionIndex,
    blank_index: blankIndex,
    question_type: questionType,
    content,
    options,
    answer,
    analysis,
    score,
    correct_rate: correctRate,
    metadata,
  };
  return {
    sourceLocalId,
    sourceKeySuffix: `section-${context.sectionOrder}/question-${sourceLocalId}`,
    orderIndex: context.questionIndex,
    blankIndex,
    questionType,
    content,
    options,
    answer,
    analysis,
    score,
    correctRate,
    metadata,
    rawPayload: json(question, path),
    payloadHash: sha256(stableStringify(core)),
  };
}

function normalizeSeedSection(
  raw: unknown,
  index: number,
): SeedSectionModel {
  const path = `$.sections[${index}]`;
  const section = object(raw, path);
  const sectionType = string(section.type, `${path}.type`, { max: 100 });
  const questionType = identifier(section.questionType, `${path}.questionType`, 100);
  const title = string(section.title, `${path}.title`, { max: 255 });
  const category = string(section.category, `${path}.category`, { max: 100 });
  const score = number(section.score, `${path}.score`);
  const grade = string(section.grade, `${path}.grade`, { max: 50 });
  const source = string(section.source, `${path}.source`, { max: 200 });
  if (!Array.isArray(section.tags)) error(`${path}.tags`, "must be an array");
  const tags = section.tags.map((tag, tagIndex) =>
    string(tag, `${path}.tags[${tagIndex}]`, { max: 191 }),
  );
  const article = section.article === undefined
    ? ""
    : string(section.article, `${path}.article`, { allowEmpty: true });
  const instructions = section.content === undefined || section.content === null
    ? null
    : string(section.content, `${path}.content`, { allowEmpty: true });
  const options = section.options === undefined ? null : json(section.options, `${path}.options`);
  if (!Array.isArray(section.questions) || !section.questions.length) {
    error(`${path}.questions`, "must be a non-empty array");
  }
  const questions = section.questions.map((question, questionIndex) =>
    normalizeSeedQuestion(question, {
      path,
      sectionOrder: index + 1,
      questionIndex,
      sectionQuestionType: questionType,
      sectionOptions: options,
    }),
  );
  const seenIds = new Set<string>();
  for (const question of questions) {
    if (seenIds.has(question.sourceLocalId)) error(path, "question ids must be unique within a section");
    seenIds.add(question.sourceLocalId);
  }
  const childScore = questions.reduce((total, question) => total + question.score, 0);
  if (Math.abs(childScore - score) > 0.001) {
    error(`${path}.score`, `does not equal child question score ${childScore}`);
  }
  const core = {
    section_type: sectionType,
    question_type: questionType,
    title,
    category,
    score,
    grade,
    source,
    tags,
    article: canonicalText(article),
    instructions: canonicalText(instructions),
    options,
    question_payload_hashes: questions.map((question) => question.payloadHash),
  };
  return {
    sourceKeySuffix: `section-${index + 1}`,
    orderIndex: index,
    sectionType,
    questionType,
    title,
    category,
    score,
    grade,
    source,
    tags,
    article,
    instructions,
    options,
    questions,
    rawPayload: json(section, path),
    payloadHash: sha256(stableStringify(core)),
  };
}

export function normalizeSeedDocument(raw: unknown): SeedDocumentModel {
  const document = object(raw, "$");
  const singular = document.subject;
  const plural = document.subjects;
  if (singular !== undefined && plural !== undefined && singular !== plural) {
    error("$", "subject and subjects disagree");
  }
  const name = string(singular ?? plural, "$.subject");
  const code = SUBJECT_CODES.get(name);
  if (!code) error("$.subject", `unsupported subject: ${name}`);
  if (!Array.isArray(document.sections) || !document.sections.length) {
    error("$.sections", "must be a non-empty array");
  }
  const sections = document.sections.map(normalizeSeedSection);
  const rawPayload = json(document, "$");
  return {
    subject: {
      code,
      name,
      sourceField: singular !== undefined ? "subject" : "subjects",
    },
    sections,
    sectionCount: sections.length,
    questionCount: sections.reduce((total, section) => total + section.questions.length, 0),
    totalScore: sections.reduce((total, section) => total + section.score, 0),
    canonicalJsonHash: sha256(stableStringify(rawPayload)),
    rawPayload,
  };
}
