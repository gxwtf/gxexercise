import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface Option {
  id: string;
  label: string;
}

interface QuestionData {
  id: number;
  questionType: string;
  content?: string;
  options?: Option[];
  answer: string;
  analysis?: string;
  score: number;
  correctRate?: number;
  blankIndex?: number;
}

interface SectionData {
  type: string;
  questionType: string;
  title: string;
  category: string;
  score: number;
  grade: string;
  source: string;
  tags: string[];
  article?: string;
  content?: string;
  options?: Option[];
  questions: QuestionData[];
}

interface PaperData {
  title: string;
  subject: string;
  source: string;
  grade: string;
  year: number | null;
  totalScore: number | null;
  duration: number | null;
  description: string | null;
  tags: string[];
}

interface ExamData {
  paper: PaperData;
  sections: SectionData[];
}

async function importExam(jsonPath: string) {
  if (!fs.existsSync(jsonPath)) {
    console.error(`File not found: ${jsonPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data: ExamData = JSON.parse(raw);

  const { paper, sections } = data;

  console.log(`Importing: ${paper.title}`);
  console.log(`  Grade: ${paper.grade}, Year: ${paper.year}`);
  console.log(`  Sections: ${sections.length}`);

  const testPaper = await prisma.testPaper.create({
    data: {
      title: paper.title,
      description: paper.description || "",
      subject: paper.subject,
      source: paper.source,
      grade: paper.grade,
      year: paper.year,
      totalScore: paper.totalScore,
      duration: paper.duration,
      tags: paper.tags,
    },
  });

  console.log(`Created TestPaper: ${testPaper.id}`);

  let groupOrderIndex = 0;

  for (const section of sections) {
    const content = section.article || section.content || "";

    const questionGroup = await prisma.questionGroup.create({
      data: {
        title: section.title,
        content,
        questionType: section.questionType,
        score: section.score,
        subject: paper.subject,
        source: section.source || paper.source,
        category: section.category,
        grade: section.grade || paper.grade,
        tags: section.tags,
      },
    });

    console.log(`  Created QuestionGroup: ${questionGroup.title} (${section.questions.length} questions)`);

    await prisma.paperItem.create({
      data: {
        paperId: testPaper.id,
        itemId: questionGroup.id,
        itemType: "questionGroup",
        orderIndex: groupOrderIndex,
      },
    });

    groupOrderIndex++;

    let questionOrderIndex = 0;

    for (const q of section.questions) {
      const questionContent = q.content || "";

      const question = await prisma.question.create({
        data: {
          content: questionContent,
          questionType: q.questionType,
          options: (q.options || []) as any,
          answer: q.answer || "",
          analysis: q.analysis || "",
          score: q.score,
          subject: paper.subject,
          source: section.source || paper.source,
          category: section.category,
          grade: section.grade || paper.grade,
          year: paper.year,
          tags: section.tags,
        },
      });

      await prisma.groupItem.create({
        data: {
          groupId: questionGroup.id,
          questionId: question.id,
          orderIndex: questionOrderIndex,
        },
      });

      questionOrderIndex++;
      console.log(`    Created Question #${q.id}: ${questionContent.substring(0, 50)}...`);
    }
  }

  console.log(`\nImport complete!`);
  console.log(`  TestPaper: ${testPaper.id}`);
  console.log(`  Sections: ${sections.length}`);
  console.log(`  Total questions: ${sections.reduce((sum, s) => sum + s.questions.length, 0)}`);

  await prisma.$disconnect();
}

async function deleteAllEnglish() {
  const englishPapers = await prisma.testPaper.findMany({
    where: { subject: "英语" },
    select: { id: true },
  });
  const paperIds = englishPapers.map((p) => p.id);

  const englishGroups = await prisma.questionGroup.findMany({
    where: { subject: "英语" },
    select: { id: true },
  });
  const groupIds = englishGroups.map((g) => g.id);

  const englishQuestions = await prisma.question.findMany({
    where: { subject: "英语" },
    select: { id: true },
  });
  const questionIds = englishQuestions.map((q) => q.id);

  if (paperIds.length > 0) {
    await prisma.testPaperSubmission.deleteMany({
      where: { testPaperId: { in: paperIds } },
    });
  }
  if (groupIds.length > 0) {
    await prisma.questionGroupSubmission.deleteMany({
      where: { questionGroupId: { in: groupIds } },
    });
  }
  if (questionIds.length > 0) {
    await prisma.questionSubmission.deleteMany({
      where: { questionId: { in: questionIds } },
    });
  }

  await prisma.testPaper.deleteMany({ where: { subject: "英语" } });
  await prisma.questionGroup.deleteMany({ where: { subject: "英语" } });
  await prisma.question.deleteMany({ where: { subject: "英语" } });

  console.log(
    `Deleted ${paperIds.length} test papers, ${groupIds.length} question groups, ${questionIds.length} questions`
  );
}

async function deletePaperByTitle(title: string) {
  const papers = await prisma.testPaper.findMany({
    where: { title },
    select: { id: true, title: true, subject: true },
  });

  if (papers.length === 0) {
    console.error(`No test paper found with title: ${title}`);
    process.exit(1);
  }

  const paperIds = papers.map((p) => p.id);

  const paperItems = await prisma.paperItem.findMany({
    where: { paperId: { in: paperIds } },
    select: { itemId: true, itemType: true },
  });
  const groupIds = paperItems
    .filter((pi) => pi.itemType === "questionGroup")
    .map((pi) => pi.itemId);

  const groupItems = await prisma.groupItem.findMany({
    where: { groupId: { in: groupIds } },
    select: { questionId: true },
  });
  const questionIds = groupItems.map((gi) => gi.questionId);

  if (questionIds.length > 0) {
    await prisma.questionSubmission.deleteMany({
      where: { questionId: { in: questionIds } },
    });
  }
  if (groupIds.length > 0) {
    await prisma.questionGroupSubmission.deleteMany({
      where: { questionGroupId: { in: groupIds } },
    });
  }
  if (paperIds.length > 0) {
    await prisma.testPaperSubmission.deleteMany({
      where: { testPaperId: { in: paperIds } },
    });
  }

  if (questionIds.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
  }
  if (groupIds.length > 0) {
    await prisma.questionGroup.deleteMany({ where: { id: { in: groupIds } } });
  }
  await prisma.testPaper.deleteMany({ where: { id: { in: paperIds } } });

  console.log(
    `Deleted ${paperIds.length} test paper(s), ${groupIds.length} question groups, ${questionIds.length} questions`
  );
  for (const p of papers) {
    console.log(`  - [${p.subject}] ${p.title}`);
  }
}

function main() {
  const args = process.argv.slice(2);

  const hasDelete = args.includes("--delete");
  const hasAll = args.includes("--all");

  if (hasDelete) {
    const titleArgs = args.filter((a) => a !== "--delete" && a !== "--all");

    (async () => {
      if (hasAll) {
        console.log("Deleting all English questions...");
        await deleteAllEnglish();
      } else {
        if (titleArgs.length < 1) {
          console.error(
            'Usage: npx tsx problem_generate/import-exam.ts --delete "<paper title>"'
          );
          console.error("       npx tsx problem_generate/import-exam.ts --delete --all");
          process.exit(1);
        }
        const title = titleArgs[0];
        console.log(`Deleting paper: ${title}`);
        await deletePaperByTitle(title);
      }
      await prisma.$disconnect();
    })().catch((err) => {
      console.error("Delete failed:", err);
      process.exit(1);
    });
    return;
  }

  const inputPaths = args;

  if (inputPaths.length < 1) {
    console.error("Usage: npx tsx problem_generate/import-exam.ts <folder-name-or-json-path>");
    console.error("       npx tsx problem_generate/import-exam.ts --delete \"<paper title>\"");
    console.error("       npx tsx problem_generate/import-exam.ts --delete --all");
    console.error("  Examples:");
    console.error("    npx tsx problem_generate/import-exam.ts 2025北京西城高二（下）期末英语（教师版）.json");
    console.error("    npx tsx problem_generate/import-exam.ts --delete \"2026北京丰台高三二模英语\"");
    console.error("    npx tsx problem_generate/import-exam.ts --delete --all");
    process.exit(1);
  }

  let inputPath = inputPaths[0];

  if (!fs.existsSync(inputPath)) {
    if (inputPath.endsWith(".json")) {
      const folderName = inputPath.replace(/\.json$/, "");
      inputPath = path.join(__dirname, folderName, inputPath);
    } else {
      inputPath = path.join(__dirname, inputPath);
    }

    if (!fs.existsSync(inputPath)) {
      console.error(`Error: file not found: ${inputPaths[0]}`);
      process.exit(1);
    }
  }

  (async () => {
    if (fs.statSync(inputPath).isDirectory()) {
      const files = fs.readdirSync(inputPath).filter((f) => f.endsWith(".json"));
      console.log(`Found ${files.length} JSON files in ${inputPath}`);

      for (const file of files) {
        const fullPath = path.join(inputPath, file);
        console.log(`\n--- Processing: ${file} ---`);
        await importExam(fullPath);
      }
      console.log("\nAll imports complete!");
    } else {
      await importExam(inputPath);
    }

    await prisma.$disconnect();
  })().catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
}

main();