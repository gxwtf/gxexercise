import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { stableStringify } from "../gaokao/lib/normalize";

type QuestionKind = "single" | "multiple" | "input" | "text";

interface ReviewedQuestion {
  number: number;
  pages: number[];
  score: number;
  category: string;
  groupType: string;
  questionType: QuestionKind;
  content: string;
  options?: Array<{ id: string; label: string }>;
  answer: string;
  analysis?: string;
}

interface ReviewedPaper {
  schemaVersion: 1;
  sourcePdf: string;
  sourcePdfSha256: string;
  year: number;
  subject: string;
  track: string | null;
  title: string;
  totalScore: number;
  duration: number;
  questions: ReviewedQuestion[];
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function usage(): never {
  throw new Error("Usage: tsx scripts/beijing/import-reviewed.ts --input <reviewed.json> [--apply]");
}

function parseArgs(argv: string[]): { input: string; apply: boolean } {
  let input = "";
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") input = argv[++index] || "";
    else if (argv[index] === "--apply") apply = true;
    else usage();
  }
  if (!input) usage();
  return { input: path.resolve(input), apply };
}

function validatePaper(value: unknown): asserts value is ReviewedPaper {
  if (!value || typeof value !== "object") throw new Error("Reviewed input must be an object");
  const paper = value as Partial<ReviewedPaper>;
  if (paper.schemaVersion !== 1) throw new Error("schemaVersion must be 1");
  if (!Number.isInteger(paper.year) || !paper.subject || !paper.title) throw new Error("Paper metadata is incomplete");
  if (!Array.isArray(paper.questions) || paper.questions.length === 0) throw new Error("questions must be non-empty");

  const seen = new Set<number>();
  for (const question of paper.questions) {
    if (!Number.isInteger(question.number) || seen.has(question.number)) throw new Error("Question numbers must be unique integers");
    seen.add(question.number);
    if (!question.content.trim() || !Number.isFinite(question.score) || question.score <= 0) {
      throw new Error(`Question ${question.number} is incomplete`);
    }
    if (!question.pages.length || question.pages.some(page => !Number.isInteger(page) || page <= 0)) {
      throw new Error(`Question ${question.number} has invalid page evidence`);
    }
    if (!question.category || !question.groupType || !question.questionType) {
      throw new Error(`Question ${question.number} is missing classification`);
    }
    if ((question.questionType === "single" || question.questionType === "multiple") && (!question.options || question.options.length < 2)) {
      throw new Error(`Question ${question.number} is missing options`);
    }
  }
}

async function main() {
  const { input, apply } = parseArgs(process.argv.slice(2));
  const paper = JSON.parse(await readFile(input, "utf8")) as unknown;
  validatePaper(paper);

  const sourcePath = path.resolve(path.dirname(input), paper.sourcePdf);
  const sourceHash = sha256(await readFile(sourcePath));
  if (sourceHash !== paper.sourcePdfSha256) throw new Error("Source PDF checksum does not match reviewed input");

  const prefix = `manual:beijing:${paper.year}:${paper.subject}:${paper.track ?? "general"}`;
  const source = "北京卷（用户提供 PDF，逐页人工核对）";
  const plan = paper.questions.map(question => ({
    number: question.number,
    groupSourceKey: `${prefix}:group:${question.number}`,
    questionSourceKey: `${prefix}:question:${question.number}`,
    hash: sha256(stableStringify(question)),
  }));

  console.log(JSON.stringify({ apply, paper: paper.title, questions: plan.length, sourcePdfSha256: sourceHash }, null, 2));
  if (!apply) return;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL environment variable is not set");
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    await prisma.$transaction(async tx => {
      const paperSourceKey = `${prefix}:paper`;
      const testPaper = await tx.testPaper.upsert({
        where: { sourceKey: paperSourceKey },
        create: {
          title: paper.title,
          description: "题目与答案均由用户提供的 PDF 逐页人工核对录入。",
          subject: paper.subject,
          source,
          grade: "高三",
          year: paper.year,
          totalScore: paper.totalScore,
          duration: paper.duration,
          tags: [paper.subject, "高考真题", "北京卷", String(paper.year)],
          sourceKey: paperSourceKey,
          payloadHash: sha256(stableStringify(paper)),
          metadata: { source_pdf_sha256: sourceHash, track: paper.track, reviewed: true },
        },
        update: {},
      });

      for (const question of paper.questions) {
        const keys = plan.find(item => item.number === question.number)!;
        const tags = [paper.subject, "高考真题", "北京卷", String(paper.year), question.category];
        const group = await tx.questionGroup.upsert({
          where: { sourceKey: keys.groupSourceKey },
          create: {
            title: `${paper.year}年北京卷${paper.subject} ${question.number}`,
            content: "",
            questionType: question.groupType,
            score: question.score,
            subject: paper.subject,
            source,
            grade: "高三",
            category: question.category,
            tags,
            year: paper.year,
            sourceKey: keys.groupSourceKey,
            payloadHash: keys.hash,
            metadata: { source_pdf_sha256: sourceHash, pages: question.pages, track: paper.track, reviewed: true },
          },
          update: {},
        });

        const item = await tx.question.upsert({
          where: { sourceKey: keys.questionSourceKey },
          create: {
            questionType: question.questionType,
            content: question.content,
            options: question.options,
            answer: question.answer,
            analysis: question.analysis ?? null,
            score: question.score,
            subject: paper.subject,
            source,
            grade: "高三",
            category: question.category,
            year: paper.year,
            tags,
            sourceKey: keys.questionSourceKey,
            payloadHash: keys.hash,
            metadata: { source_pdf_sha256: sourceHash, pages: question.pages, track: paper.track, reviewed: true },
          },
          update: {},
        });

        await tx.groupItem.upsert({
          where: { groupId_questionId: { groupId: group.id, questionId: item.id } },
          create: { groupId: group.id, questionId: item.id, orderIndex: 0 },
          update: {},
        });
        await tx.paperItem.upsert({
          where: { paperId_itemId: { paperId: testPaper.id, itemId: group.id } },
          create: { paperId: testPaper.id, itemId: group.id, itemType: "group", orderIndex: question.number },
          update: {},
        });
      }
    }, { timeout: 30_000 });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
