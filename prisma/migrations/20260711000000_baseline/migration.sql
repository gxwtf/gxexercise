-- Baseline for databases previously created from the main-branch schema with
-- `prisma db push`. Existing databases must mark this migration as applied:
--   prisma migrate resolve --applied 20260711000000_baseline
-- New databases can run the full history with `prisma migrate deploy`.

BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "questionType" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "options" JSONB,
    "answer" TEXT NOT NULL DEFAULT '',
    "analysis" TEXT,
    "score" INTEGER NOT NULL DEFAULT 5,
    "correctRate" REAL,
    "subject" VARCHAR(100) NOT NULL,
    "source" VARCHAR(200) NOT NULL,
    "grade" VARCHAR(50),
    "category" VARCHAR(100) NOT NULL DEFAULT '',
    "year" INTEGER,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "questionType" VARCHAR(100) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "subject" VARCHAR(100) NOT NULL,
    "source" VARCHAR(200) NOT NULL,
    "grade" VARCHAR(50),
    "category" VARCHAR(100) NOT NULL,
    "tags" TEXT[],
    "imageUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "GroupItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPaper" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "subject" VARCHAR(100) NOT NULL,
    "source" VARCHAR(200) NOT NULL,
    "grade" VARCHAR(50),
    "year" INTEGER,
    "totalScore" INTEGER,
    "duration" INTEGER,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperItem" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemType" VARCHAR(20) NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "PaperItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSubmission" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "groupSubmissionId" TEXT,
    "content" JSONB,
    "score" REAL,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionGroupSubmission" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "questionGroupId" TEXT NOT NULL,
    "testSubmissionId" TEXT,
    "score" REAL,
    "isCorrect" BOOLEAN,
    "correctNum" INTEGER,
    "totalNum" INTEGER,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionGroupSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPaperSubmission" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "testPaperId" TEXT NOT NULL,
    "content" JSONB,
    "score" REAL,
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestPaperSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_subject_idx" ON "Question"("subject");

-- CreateIndex
CREATE INDEX "Question_questionType_idx" ON "Question"("questionType");

-- CreateIndex
CREATE INDEX "Question_category_idx" ON "Question"("category");

-- CreateIndex
CREATE INDEX "Question_year_idx" ON "Question"("year");

-- CreateIndex
CREATE INDEX "QuestionGroup_subject_idx" ON "QuestionGroup"("subject");

-- CreateIndex
CREATE INDEX "QuestionGroup_category_idx" ON "QuestionGroup"("category");

-- CreateIndex
CREATE INDEX "GroupItem_groupId_idx" ON "GroupItem"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupItem_groupId_questionId_key" ON "GroupItem"("groupId", "questionId");

-- CreateIndex
CREATE INDEX "TestPaper_subject_idx" ON "TestPaper"("subject");

-- CreateIndex
CREATE INDEX "TestPaper_year_idx" ON "TestPaper"("year");

-- CreateIndex
CREATE INDEX "PaperItem_paperId_idx" ON "PaperItem"("paperId");

-- CreateIndex
CREATE UNIQUE INDEX "PaperItem_paperId_itemId_key" ON "PaperItem"("paperId", "itemId");

-- CreateIndex
CREATE INDEX "QuestionSubmission_userId_idx" ON "QuestionSubmission"("userId");

-- CreateIndex
CREATE INDEX "QuestionSubmission_questionId_idx" ON "QuestionSubmission"("questionId");

-- CreateIndex
CREATE INDEX "QuestionSubmission_userId_questionId_idx" ON "QuestionSubmission"("userId", "questionId");

-- CreateIndex
CREATE INDEX "QuestionSubmission_groupSubmissionId_idx" ON "QuestionSubmission"("groupSubmissionId");

-- CreateIndex
CREATE INDEX "QuestionGroupSubmission_userId_idx" ON "QuestionGroupSubmission"("userId");

-- CreateIndex
CREATE INDEX "QuestionGroupSubmission_questionGroupId_idx" ON "QuestionGroupSubmission"("questionGroupId");

-- CreateIndex
CREATE INDEX "QuestionGroupSubmission_userId_questionGroupId_idx" ON "QuestionGroupSubmission"("userId", "questionGroupId");

-- CreateIndex
CREATE INDEX "QuestionGroupSubmission_testSubmissionId_idx" ON "QuestionGroupSubmission"("testSubmissionId");

-- CreateIndex
CREATE INDEX "TestPaperSubmission_userId_idx" ON "TestPaperSubmission"("userId");

-- CreateIndex
CREATE INDEX "TestPaperSubmission_testPaperId_idx" ON "TestPaperSubmission"("testPaperId");

-- CreateIndex
CREATE INDEX "TestPaperSubmission_userId_testPaperId_idx" ON "TestPaperSubmission"("userId", "testPaperId");

-- CreateIndex
CREATE INDEX "User_id_idx" ON "User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- AddForeignKey
ALTER TABLE "GroupItem" ADD CONSTRAINT "GroupItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QuestionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupItem" ADD CONSTRAINT "GroupItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperItem" ADD CONSTRAINT "PaperItem_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "TestPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSubmission" ADD CONSTRAINT "QuestionSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSubmission" ADD CONSTRAINT "QuestionSubmission_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSubmission" ADD CONSTRAINT "QuestionSubmission_groupSubmissionId_fkey" FOREIGN KEY ("groupSubmissionId") REFERENCES "QuestionGroupSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroupSubmission" ADD CONSTRAINT "QuestionGroupSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroupSubmission" ADD CONSTRAINT "QuestionGroupSubmission_questionGroupId_fkey" FOREIGN KEY ("questionGroupId") REFERENCES "QuestionGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroupSubmission" ADD CONSTRAINT "QuestionGroupSubmission_testSubmissionId_fkey" FOREIGN KEY ("testSubmissionId") REFERENCES "TestPaperSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPaperSubmission" ADD CONSTRAINT "TestPaperSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPaperSubmission" ADD CONSTRAINT "TestPaperSubmission_testPaperId_fkey" FOREIGN KEY ("testPaperId") REFERENCES "TestPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
