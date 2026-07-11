const MAX_INT32 = 2_147_483_647;
const MAX_SUBMISSIONS_PER_GROUP = 1_000;
const MAX_ANSWER_LENGTH = 100_000;

export interface GroupSubmissionInput {
  questionGroupId: string;
  questionSubmissions: Array<{
    questionId: string;
    answer: string;
  }>;
  duration: number | null;
}

export interface ScorableQuestion {
  id: string;
  questionType: string;
  answer: string;
  score: number;
}

export interface PreparedQuestionSubmission {
  questionId: string;
  content: { answer: string };
  score: number | null;
  isCorrect: boolean | null;
}

export interface PreparedGroupSubmission {
  score: number | null;
  isCorrect: boolean | null;
  correctNum: number;
  totalNum: number;
  submissions: PreparedQuestionSubmission[];
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedUnicode(value: string): string {
  return value.normalize("NFKC");
}

/** Normalize one selected option id (for example, " a " -> "A"). */
export function normalizeSingleAnswer(value: string): string {
  return normalizedUnicode(value).trim().toLocaleUpperCase("en-US");
}

function splitMultipleAnswer(value: string): string[] {
  const normalized = normalizeSingleAnswer(value);

  if (!normalized) {
    return [];
  }

  const hasDelimiter = /[\s,，、;；|/]/u.test(normalized);
  const pieces = hasDelimiter
    ? normalized.split(/[\s,，、;；|/]+/u)
    : /^[A-Z]{2,}$/u.test(normalized)
      ? [...normalized]
      : [normalized];

  return [...new Set(pieces.filter(Boolean))].sort();
}

/** Normalize a multiple-choice answer as an order-independent option set. */
export function normalizeMultipleAnswer(value: string): string {
  return splitMultipleAnswer(value).join(",");
}

/**
 * Normalize a fill-in answer while retaining meaningful punctuation and case.
 * Whitespace runs are insignificant, as is whitespace around blank separators.
 */
export function normalizeInputAnswer(value: string): string {
  return normalizedUnicode(value)
    .replace(/\r\n?/gu, "\n")
    .trim()
    .replace(/[\t \f\v]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\s*[,，;；]\s*/gu, ",");
}

export function parseGroupSubmissionInput(
  value: unknown,
): ValidationResult<GroupSubmissionInput> {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const questionGroupId = value.questionGroupId;
  if (
    typeof questionGroupId !== "string" ||
    !questionGroupId.trim() ||
    questionGroupId.length > 255
  ) {
    return { ok: false, error: "Invalid questionGroupId" };
  }

  if (!Array.isArray(value.questionSubmissions)) {
    return { ok: false, error: "questionSubmissions must be an array" };
  }
  if (value.questionSubmissions.length > MAX_SUBMISSIONS_PER_GROUP) {
    return { ok: false, error: "Too many question submissions" };
  }

  const questionSubmissions: GroupSubmissionInput["questionSubmissions"] = [];
  const seenQuestionIds = new Set<string>();

  for (const rawSubmission of value.questionSubmissions) {
    if (!isRecord(rawSubmission)) {
      return { ok: false, error: "Invalid question submission" };
    }

    const rawQuestionId = rawSubmission.questionId;
    if (
      typeof rawQuestionId !== "string" ||
      !rawQuestionId.trim() ||
      rawQuestionId.length > 255
    ) {
      return { ok: false, error: "Invalid questionId" };
    }
    const questionId = rawQuestionId.trim();

    if (seenQuestionIds.has(questionId)) {
      return { ok: false, error: `Duplicate questionId: ${questionId}` };
    }
    seenQuestionIds.add(questionId);

    if (!isRecord(rawSubmission.content)) {
      return {
        ok: false,
        error: `Invalid submission content for questionId: ${questionId}`,
      };
    }

    const answer = rawSubmission.content.answer;
    if (typeof answer !== "string" || answer.length > MAX_ANSWER_LENGTH) {
      return {
        ok: false,
        error: `Invalid answer for questionId: ${questionId}`,
      };
    }

    questionSubmissions.push({ questionId, answer });
  }

  const rawDuration = value.duration;
  let duration: number | null = null;
  if (rawDuration !== undefined && rawDuration !== null) {
    if (
      typeof rawDuration !== "number" ||
      !Number.isInteger(rawDuration) ||
      rawDuration < 0 ||
      rawDuration > MAX_INT32
    ) {
      return { ok: false, error: "Invalid duration" };
    }
    duration = rawDuration;
  }

  // Deliberately ignore value.userId. Identity is resolved from the signed
  // server-side session by the route handler.
  return {
    ok: true,
    value: {
      questionGroupId: questionGroupId.trim(),
      questionSubmissions,
      duration,
    },
  };
}

type GradeResult = {
  score: number | null;
  isCorrect: boolean | null;
};

function gradeQuestion(question: ScorableQuestion, userAnswer: string): GradeResult {
  const questionType = question.questionType.trim().toLocaleLowerCase("en-US");
  let normalizedUserAnswer: string;
  let normalizedCorrectAnswer: string;

  switch (questionType) {
    case "single":
    case "choice":
      normalizedUserAnswer = normalizeSingleAnswer(userAnswer);
      normalizedCorrectAnswer = normalizeSingleAnswer(question.answer);
      break;
    case "multiple":
      normalizedUserAnswer = normalizeMultipleAnswer(userAnswer);
      normalizedCorrectAnswer = normalizeMultipleAnswer(question.answer);
      break;
    case "input":
      normalizedUserAnswer = normalizeInputAnswer(userAnswer);
      normalizedCorrectAnswer = normalizeInputAnswer(question.answer);
      break;
    default:
      // Free-form and unknown question types need human or specialized grading.
      return { score: null, isCorrect: null };
  }

  // An empty answer key cannot support an automatic correctness decision.
  if (!normalizedCorrectAnswer) {
    return { score: null, isCorrect: null };
  }

  const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
  return {
    score: isCorrect ? question.score : 0,
    isCorrect,
  };
}

export function prepareGroupSubmission(
  questions: ScorableQuestion[],
  submittedAnswers: GroupSubmissionInput["questionSubmissions"],
): ValidationResult<PreparedGroupSubmission> {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const seenQuestionIds = new Set<string>();
  const submissions: PreparedQuestionSubmission[] = [];
  let correctNum = 0;
  let earnedScore = 0;
  let hasPendingGrade = false;

  for (const submittedAnswer of submittedAnswers) {
    if (seenQuestionIds.has(submittedAnswer.questionId)) {
      return {
        ok: false,
        error: `Duplicate questionId: ${submittedAnswer.questionId}`,
      };
    }
    seenQuestionIds.add(submittedAnswer.questionId);

    const question = questionById.get(submittedAnswer.questionId);
    if (!question) {
      return {
        ok: false,
        error: `Question does not belong to group: ${submittedAnswer.questionId}`,
      };
    }

    const grade = gradeQuestion(question, submittedAnswer.answer);
    if (grade.isCorrect === true) {
      correctNum += 1;
    }
    if (grade.score !== null) {
      earnedScore += grade.score;
    } else {
      hasPendingGrade = true;
    }

    submissions.push({
      questionId: submittedAnswer.questionId,
      content: { answer: submittedAnswer.answer },
      ...grade,
    });
  }

  const totalNum = questions.length;
  const answeredEveryQuestion = seenQuestionIds.size === totalNum;
  const isAllCorrect =
    totalNum > 0 && answeredEveryQuestion && correctNum === totalNum;

  return {
    ok: true,
    value: {
      score: hasPendingGrade ? null : earnedScore,
      isCorrect: hasPendingGrade ? null : isAllCorrect,
      correctNum,
      totalNum,
      submissions,
    },
  };
}
