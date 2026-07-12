import crypto from "node:crypto";
import path from "node:path";
import type {
  BuildRecordResult,
  JsonValue,
  ManifestRecord,
  NormalizedCategory,
  NormalizedSubject,
  QuestionManifest,
  RawGaokaoRow,
  SectionManifest,
  SourceDefinition,
} from "./model";

const SUBJECTS: Array<[RegExp, NormalizedSubject]> = [
  [/Math_I_/i, { code: "mathematics_science", name: "理科数学", track: "理科" }],
  [/Math_II_/i, { code: "mathematics_humanities", name: "文科数学", track: "文科" }],
  [/(?:^|_)Math(?:_|\.)/i, { code: "mathematics", name: "数学", track: null }],
  [/Chinese/i, { code: "chinese", name: "语文", track: null }],
  [/English/i, { code: "english", name: "英语", track: null }],
  [/Physics/i, { code: "physics", name: "物理", track: null }],
  [/Chemistry/i, { code: "chemistry", name: "化学", track: null }],
  [/Biology/i, { code: "biology", name: "生物", track: null }],
  [/Political_Science/i, { code: "politics", name: "思想政治", track: null }],
  [/History/i, { code: "history", name: "历史", track: null }],
  [/Geography/i, { code: "geography", name: "地理", track: null }],
];

const PROVINCES: Array<[RegExp, string, string]> = [
  [/北京/, "beijing", "北京"],
  [/上海/, "shanghai", "上海"],
  [/天津/, "tianjin", "天津"],
  [/重庆/, "chongqing", "重庆"],
  [/河北/, "hebei", "河北"],
  [/山西/, "shanxi", "山西"],
  [/辽宁/, "liaoning", "辽宁"],
  [/吉林/, "jilin", "吉林"],
  [/黑龙江/, "heilongjiang", "黑龙江"],
  [/江苏/, "jiangsu", "江苏"],
  [/浙江/, "zhejiang", "浙江"],
  [/安徽/, "anhui", "安徽"],
  [/福建/, "fujian", "福建"],
  [/江西/, "jiangxi", "江西"],
  [/山东/, "shandong", "山东"],
  [/河南/, "henan", "河南"],
  [/湖北/, "hubei", "湖北"],
  [/湖南/, "hunan", "湖南"],
  [/广东/, "guangdong", "广东"],
  [/海南/, "hainan", "海南"],
  [/四川/, "sichuan", "四川"],
  [/贵州/, "guizhou", "贵州"],
  [/云南/, "yunnan", "云南"],
  [/陕西/, "shaanxi", "陕西"],
  [/甘肃/, "gansu", "甘肃"],
  [/青海/, "qinghai", "青海"],
  [/内蒙古/, "inner-mongolia", "内蒙古"],
  [/广西/, "guangxi", "广西"],
  [/西藏/, "tibet", "西藏"],
  [/宁夏/, "ningxia", "宁夏"],
  [/新疆/, "xinjiang", "新疆"],
];

export function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function stablePositiveInt(value: string): number {
  return (Number.parseInt(sha256(value).slice(0, 8), 16) % 2_147_483_647) + 1;
}

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t \u00a0]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function canonicalText(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, " ").trim();
}

export function stableStringify(value: unknown): string {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError(`Unsupported canonical JSON value: ${typeof value}`);
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right, "en"));
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function deriveSubject(filePath: string): NormalizedSubject | null {
  const basename = path.basename(filePath);
  for (const [pattern, subject] of SUBJECTS) {
    if (pattern.test(basename)) return { ...subject };
  }
  return null;
}

function romanNumber(value: string): number | null {
  const match = value.match(/(?:卷)?(iii|ii|i|3|2|1|三|二|一)(?:卷)?/i);
  if (!match) return null;
  return (
    {
      i: 1,
      ii: 2,
      iii: 3,
      "1": 1,
      "2": 2,
      "3": 3,
      一: 1,
      二: 2,
      三: 3,
    } as Record<string, number>
  )[match[1].toLowerCase()] ?? null;
}

function romanGlyph(value: number): string {
  return ({ 1: "Ⅰ", 2: "Ⅱ", 3: "Ⅲ" } as Record<number, string>)[value] ?? String(value);
}

export function normalizeCategory(rawValue: unknown, year: number): NormalizedCategory | null {
  const raw = normalizeText(rawValue);
  const compact = raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/20\d{2}年|普通高等学校招生全国统一考试|高考试题|试题|解析版/g, "")
    .replace(/[（）()\s·:：,，。；;]+/g, "");

  let track: string | null = null;
  if (/文科/.test(compact)) track = "文科";
  if (/理科/.test(compact)) track = "理科";
  const base = compact.replace(/文科|理科/g, "");
  const national = (variant: string, variantCode: string, verified = true): NormalizedCategory => ({
    variant,
    variantCode,
    regionScope: "全国统考",
    track,
    regions: [],
    verified,
  });

  if (/^(?:全国|高考)?甲卷$/.test(base)) return national("全国甲卷", "national-a");
  if (/^(?:全国|高考)?乙卷$/.test(base)) return national("全国乙卷", "national-b");

  if (/^(?:全国新高考|新课标全国|新高考)(?:卷)?(?:iii|ii|i|3|2|1|三|二|一)(?:卷)?$/i.test(base)) {
    const number = romanNumber(base);
    if (number) return national(`新高考${romanGlyph(number)}卷`, `new-gaokao-${number}`);
  }

  if (/^全国卷?(?:iii|ii|i|3|2|1|三|二|一)(?:卷)?$/i.test(base)) {
    const number = romanNumber(base);
    if (number) return national(`全国${romanGlyph(number)}卷`, `national-${number}`);
  }

  if (/^新课标(?:卷)?(?:iii|ii|i|3|2|1|三|二|一)(?:卷)?$/i.test(base)) {
    const number = romanNumber(base);
    if (number) {
      if (year === 2021 || year === 2022) {
        return national(
          `新课标${romanGlyph(number)}卷（待核）`,
          `new-curriculum-${number}-unverified`,
          false,
        );
      }
      return year >= 2023
        ? national(`新高考${romanGlyph(number)}卷`, `new-gaokao-${number}`)
        : national(`全国${romanGlyph(number)}卷`, `national-${number}`);
    }
  }

  if (/^新课标(?:卷)?$/.test(base)) {
    return national("新课标卷（卷号未标注）", "new-curriculum-unspecified", false);
  }

  for (const [pattern, code, name] of PROVINCES) {
    if (pattern.test(base) && /卷$/.test(base)) {
      return {
        variant: `${name}卷`,
        variantCode: `province-${code}`,
        regionScope: name,
        track,
        regions: [{ code, name }],
        verified: true,
      };
    }
  }

  return null;
}

export function resolvePaperSubject(
  subject: NormalizedSubject | null,
  category: NormalizedCategory | null,
): NormalizedSubject | null {
  if (!subject || !category) return subject;
  const splitMath = ["mathematics_science", "mathematics_humanities"].includes(subject.code);
  if (splitMath && category.variantCode.startsWith("new-gaokao-")) {
    return { code: "mathematics", name: "数学", track: null };
  }
  if (subject.code === "mathematics" && category.track === "理科") {
    return { code: "mathematics_science", name: "理科数学", track: "理科" };
  }
  if (subject.code === "mathematics" && category.track === "文科") {
    return { code: "mathematics_humanities", name: "文科数学", track: "文科" };
  }
  return subject;
}

export function extractQuestionNumber(question: string): string | null {
  const match = normalizeText(question).match(
    /^\s*(?:第\s*)?(\d{1,3}(?:\s*[（(]\s*\d+\s*[）)])?)[.．、\s]/,
  );
  return match ? match[1].replace(/\s+/g, "") : null;
}

export function topicFromFilename(filePath: string): string {
  return path
    .basename(filePath, ".json")
    .replace(/^\d{4}(?:-\d{4})?_/, "")
    .replace(/_/g, " ");
}

export function publicCategoryFromSource(filePath: string, subjectName: string): string {
  const normalized = filePath.replace(/\\/g, "/");

  if (/Chinese_Lang_and_Usage|Language_and_Writing_Skills/.test(normalized)) return "语用";
  if (/Chinese_Modern_Lit|Practical_Text/.test(normalized)) return "多文本";
  if (/Classical_Chinese/.test(normalized)) return "文言文";
  if (/Ancient_Poetry/.test(normalized)) return "古诗";
  if (/Famous_Passages|Dictation/.test(normalized)) return "默写";
  if (/Literary_Text/.test(normalized)) return "文学类";

  if (/English_Fill_in_Blanks/.test(normalized)) return "完形填空";
  if (/English_Cloze_Test/.test(normalized)) return "七选五";
  if (/Language_Cloze_Passage/.test(normalized)) return "语法填空";
  if (/Error_Correction/.test(normalized)) return "阅读表达";
  if (/English_Reading_Comp/.test(normalized)) return "阅读";

  if (/Mathematics|Math/.test(normalized)) {
    if (/Fill-in-the-Blank/.test(normalized)) return "填空";
    if (/MCQs/.test(normalized)) return "选择";
    if (/Open-ended/.test(normalized)) return "解答题";
  }

  if (/MCQs/.test(normalized)) return "选择";
  if (/Open-ended/.test(normalized)) return "解答题";
  return subjectName;
}

export function inferQuestionTypes(filePath: string): {
  sectionType: string;
  childType: string;
} {
  const normalized = filePath.replace(/\\/g, "/");
  if (/English_Fill_in_Blanks/i.test(normalized)) return { sectionType: "cloze", childType: "choice" };
  if (/English_Cloze_Test/i.test(normalized)) {
    return { sectionType: "seven-choose-five", childType: "choice" };
  }
  if (/Language_Cloze_Passage/i.test(normalized)) return { sectionType: "grammar", childType: "input" };
  if (/Error_Correction/i.test(normalized)) return { sectionType: "error-correction", childType: "text" };
  if (/English_Reading_Comp/i.test(normalized)) return { sectionType: "en-reading", childType: "choice" };
  if (/Fill-in-the-Blank|Dictation|Famous_Passage/i.test(normalized)) {
    return { sectionType: "fill-blank", childType: "input" };
  }
  if (/Chinese/i.test(normalized)) return { sectionType: "chinese-reading", childType: "text" };
  if (/Objective_Questions|_MCQs/i.test(normalized)) {
    return { sectionType: "objective", childType: "choice" };
  }
  return { sectionType: "open-ended", childType: "text" };
}

export function buildPaperKey(
  year: number,
  category: NormalizedCategory,
  subjectCode: string,
): string {
  return `gaokao:${year}:${category.variantCode}:${subjectCode}`;
}

function normalizeJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return normalizeText(value);
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeJsonValue(item)]),
    );
  }
  return normalizeText(value);
}

function answerSlots(value: unknown): JsonValue[] {
  const raw = Array.isArray(value) ? value : [value];
  return raw.map(normalizeJsonValue).filter((item) => {
    if (typeof item === "string") return Boolean(item);
    return item !== null;
  });
}

function allocateScore(total: number | null, count: number): Array<number | null> {
  if (total === null) return Array.from({ length: count }, () => null);
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents % count;
  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}

export function questionPayloadCore(
  paperKey: string,
  question: Omit<QuestionManifest, "payload_hash" | "content_hash" | "canonical_hash" | "review_status" | "raw_source">,
): Record<string, unknown> {
  return {
    paper_key: paperKey,
    source_key: question.source_key,
    source_item_key: question.source_item_key,
    source_question_no: question.source_question_no,
    sort_order: question.sort_order,
    question_type: question.question_type,
    score: question.score,
    correct_rate: question.correct_rate,
    content: question.content,
    sub_content: question.sub_content,
    options: question.options,
    answer: question.answer,
    analysis: question.analysis,
    metadata: question.metadata,
  };
}

export function sectionPayloadCore(
  paperKey: string,
  section: Omit<SectionManifest, "payload_hash" | "content_hash" | "review_status" | "raw_source">,
  questions: QuestionManifest[],
): Record<string, unknown> {
  return {
    paper_key: paperKey,
    source_key: section.source_key,
    source_item_key: section.source_item_key,
    sort_order: section.sort_order,
    section_type: section.section_type,
    question_type: section.question_type,
    title: section.title,
    category: section.category,
    grade: section.grade,
    score: section.score,
    article: section.article,
    instructions: section.instructions,
    analysis: section.analysis,
    options: section.options,
    tags: section.tags,
    metadata: section.metadata,
    question_payload_hashes: questions.map((question) => question.payload_hash),
  };
}

export function buildManifestRecord(input: {
  row: RawGaokaoRow;
  relativePath: string;
  source: SourceDefinition;
  categoryOverride?: {
    category: string;
    reason: string;
    evidence: string[];
    raw_sha256: string;
  } | null;
}): BuildRecordResult {
  const { row, relativePath, source, categoryOverride = null } = input;
  const year = Number(row.year);
  const derivedSubject = deriveSubject(relativePath);
  const category = normalizeCategory(categoryOverride?.category ?? row.category, year);
  const subject = resolvePaperSubject(derivedSubject, category);
  const article = normalizeText(row.question);
  const analysis = normalizeText(row.analysis) || null;
  const answers = answerSlots(row.answer);
  const sourceIndex = Number(row.index);
  const rawScore = Number(row.score);
  const score = Number.isFinite(rawScore) ? rawScore : null;
  const errors: string[] = [];

  if (!Number.isInteger(year)) errors.push("invalid_year");
  if (!derivedSubject || !subject) errors.push("unknown_subject");
  if (!category) errors.push("unknown_or_corrupt_category");
  if (!article) errors.push("empty_question");
  if (!answers.length) errors.push("empty_answer");
  if (!Number.isInteger(sourceIndex) || sourceIndex < 0) errors.push("invalid_source_index");

  if (errors.length || !category || !subject) {
    return {
      valid: false,
      errors,
      raw: normalizeJsonValue(row),
      source_file: relativePath.replace(/\\/g, "/"),
    };
  }

  const paperKey = buildPaperKey(year, category, subject.code);
  const normalizedPath = relativePath.replace(/\\/g, "/");
  const sourceItemKey = `${source.key}:${normalizedPath}:${sourceIndex}`;
  const questionNumber = extractQuestionNumber(article);
  const topic = topicFromFilename(relativePath);
  const publicCategory = publicCategoryFromSource(relativePath, subject.name);
  const types = inferQuestionTypes(relativePath);
  const scores = allocateScore(score, answers.length);
  const sectionContentHash = sha256(canonicalText(article));

  const questions: QuestionManifest[] = answers.map((answer, index) => {
    const sourceKey = `${sourceItemKey}:child:${index + 1}`;
    const sourceQuestionNo = questionNumber
      ? answers.length === 1
        ? questionNumber
        : `${questionNumber}.${index + 1}`
      : String(index + 1);
    const metadata: JsonValue = {
      child_index: index,
      child_count: answers.length,
      score_allocation: answers.length > 1 ? "even_from_source_total" : "source_total",
    };
    const core = {
      source_key: sourceKey,
      source_item_key: sourceKey,
      source_question_no: sourceQuestionNo,
      sort_order: index + 1,
      question_type: types.childType,
      score: scores[index],
      correct_rate: null,
      content: "",
      sub_content: null,
      options: null,
      answer,
      analysis: null,
      metadata,
    };
    const identity = {
      subject_code: subject.code,
      section_content_hash: sectionContentHash,
      child_index: index,
      question_type: types.childType,
    };
    return {
      ...core,
      content_hash: sha256(`${sectionContentHash}\0${index}`),
      canonical_hash: sha256(stableStringify(identity)),
      payload_hash: sha256(stableStringify(questionPayloadCore(paperKey, core))),
      review_status: "review_required",
      raw_source: {
        source_file: normalizedPath,
        source_index: sourceIndex,
        child_index: index,
        raw_answer: normalizeJsonValue(Array.isArray(row.answer) ? row.answer[index] : row.answer),
      },
    };
  });

  const sectionCore = {
    source_key: sourceItemKey,
    source_item_key: sourceItemKey,
    sort_order: 0,
    section_type: topic,
    question_type: types.sectionType,
    title: `${year}年${category.variant}${subject.name} ${questionNumber ?? `#${sourceIndex}`}`,
    category: publicCategory,
    grade: "高三",
    score,
    article,
    instructions: null,
    analysis,
    options: null,
    tags: [subject.name, "高考真题", String(year), category.variant, publicCategory, topic],
    metadata: {
      source_file: normalizedPath,
      source_index: sourceIndex,
      source_category: normalizeText(row.category),
      paper_metadata_verified: category.verified,
      ...(categoryOverride
        ? {
            metadata_override: {
              category: categoryOverride.category,
              reason: categoryOverride.reason,
              evidence: categoryOverride.evidence,
              raw_sha256: categoryOverride.raw_sha256,
            },
          }
        : {}),
    } as JsonValue,
  };

  const section: SectionManifest = {
    ...sectionCore,
    content_hash: sectionContentHash,
    payload_hash: sha256(stableStringify(sectionPayloadCore(paperKey, sectionCore, questions))),
    review_status: "review_required",
    raw_source: normalizeJsonValue(row),
  };

  const sourceManifest = {
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
  } as const;

  const record: ManifestRecord = {
    schema_version: 1,
    source: sourceManifest,
    paper: {
      paper_key: paperKey,
      exam_kind: "gaokao",
      exam_year: year,
      subject_code: subject.code,
      subject_name: subject.name,
      variant_code: category.variantCode,
      paper_variant: category.variant,
      region_scope: category.regionScope,
      track: category.track ?? subject.track,
      regions: category.regions,
      metadata: { paper_metadata_verified: category.verified },
    },
    section,
    questions,
  };

  return { valid: true, record };
}
