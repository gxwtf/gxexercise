-- Incremental migration from the main-branch baseline to the audited Gaokao
-- staging/import schema. Run this after the baseline is applied or resolved.
-- The migration is transactional: any failed preflight or DDL statement rolls back.

BEGIN;

-- Preflight legacy rows before adding new unique indexes. Each exception names the
-- duplicate set that must be repaired before this migration can be retried.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "GroupItem"
        GROUP BY "groupId", "orderIndex"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23505',
            MESSAGE = 'gaokao migration preflight failed: duplicate GroupItem(groupId, orderIndex) rows exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "PaperItem"
        GROUP BY "paperId", "orderIndex"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23505',
            MESSAGE = 'gaokao migration preflight failed: duplicate PaperItem(paperId, orderIndex) rows exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "QuestionSubmission"
        WHERE "groupSubmissionId" IS NOT NULL
        GROUP BY "groupSubmissionId", "questionId"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23505',
            MESSAGE = 'gaokao migration preflight failed: duplicate QuestionSubmission(groupSubmissionId, questionId) rows exist';
    END IF;
END
$$;

-- CreateEnum
CREATE TYPE "BankRightsStatus" AS ENUM ('APPROVED', 'REVIEW_REQUIRED', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "BankReviewStatus" AS ENUM ('APPROVED', 'REVIEW_REQUIRED', 'INVALID');

-- CreateEnum
CREATE TYPE "BankSourceRole" AS ENUM ('QUESTION', 'ANSWER', 'ANALYSIS', 'CROSS_CHECK');

-- CreateEnum
CREATE TYPE "BankIngestStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BankIngestAction" AS ENUM ('INSERTED', 'SKIPPED_IDENTICAL', 'LINKED_EXISTING', 'CONFLICT', 'REJECTED');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "payloadHash" CHAR(64),
ADD COLUMN     "sourceKey" VARCHAR(512),
ADD COLUMN     "subContent" TEXT,
ALTER COLUMN "score" SET DEFAULT 5,
ALTER COLUMN "score" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "QuestionGroup" ADD COLUMN     "analysis" TEXT,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "options" JSONB,
ADD COLUMN     "payloadHash" CHAR(64),
ADD COLUMN     "sourceKey" VARCHAR(512),
ADD COLUMN     "year" INTEGER,
ALTER COLUMN "score" SET DEFAULT 0,
ALTER COLUMN "score" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "GroupItem" ADD COLUMN     "blankIndex" INTEGER;

-- AlterTable
ALTER TABLE "TestPaper" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "payloadHash" CHAR(64),
ADD COLUMN     "sourceKey" VARCHAR(512),
ALTER COLUMN "totalScore" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "BankSourceSnapshot" (
    "id" TEXT NOT NULL,
    "sourceKey" VARCHAR(255) NOT NULL,
    "providerKey" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sourceUrl" VARCHAR(2048) NOT NULL,
    "revision" VARCHAR(128) NOT NULL,
    "snapshotSha256" CHAR(64) NOT NULL,
    "licenseSpdx" VARCHAR(64),
    "rightsStatus" "BankRightsStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "retrievedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankSourceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankPaper" (
    "id" TEXT NOT NULL,
    "paperKey" VARCHAR(255) NOT NULL,
    "examKind" VARCHAR(32) NOT NULL DEFAULT 'gaokao',
    "examYear" INTEGER NOT NULL,
    "subjectCode" VARCHAR(64) NOT NULL,
    "subjectName" VARCHAR(64) NOT NULL,
    "variantCode" VARCHAR(100) NOT NULL,
    "paperVariant" VARCHAR(160) NOT NULL,
    "regionScope" VARCHAR(160) NOT NULL,
    "track" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankPaperSource" (
    "paperId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "role" "BankSourceRole" NOT NULL DEFAULT 'QUESTION',

    CONSTRAINT "BankPaperSource_pkey" PRIMARY KEY ("paperId","sourceId","role")
);

-- CreateTable
CREATE TABLE "BankPaperRegion" (
    "paperId" TEXT NOT NULL,
    "regionCode" VARCHAR(32) NOT NULL,
    "regionName" VARCHAR(64) NOT NULL,
    "sourceId" TEXT,
    "evidence" JSONB,

    CONSTRAINT "BankPaperRegion_pkey" PRIMARY KEY ("paperId","regionCode")
);

-- CreateTable
CREATE TABLE "BankSection" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceKey" VARCHAR(512) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "sectionType" VARCHAR(100),
    "questionType" VARCHAR(100) NOT NULL,
    "title" VARCHAR(512),
    "category" VARCHAR(160),
    "grade" VARCHAR(50),
    "score" DECIMAL(8,2),
    "article" TEXT,
    "instructions" TEXT,
    "analysis" TEXT,
    "options" JSONB,
    "tags" TEXT[],
    "metadata" JSONB,
    "contentHash" CHAR(64) NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "reviewStatus" "BankReviewStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "rawSource" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankSectionSource" (
    "sectionId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceItemKey" VARCHAR(512) NOT NULL,
    "role" "BankSourceRole" NOT NULL DEFAULT 'QUESTION',
    "payloadHash" CHAR(64) NOT NULL,
    "sourcePayload" JSONB NOT NULL,
    "rawSource" JSONB,
    "resolutionEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankSectionSource_pkey" PRIMARY KEY ("sectionId","sourceId","sourceItemKey","role")
);

-- CreateTable
CREATE TABLE "BankQuestion" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "sectionId" TEXT,
    "sourceId" TEXT NOT NULL,
    "sourceKey" VARCHAR(512) NOT NULL,
    "sourceQuestionNo" VARCHAR(100),
    "sortOrder" INTEGER NOT NULL,
    "questionType" VARCHAR(100) NOT NULL,
    "score" DECIMAL(8,2),
    "correctRate" DECIMAL(7,6),
    "content" TEXT NOT NULL DEFAULT '',
    "subContent" TEXT,
    "options" JSONB,
    "answer" JSONB,
    "analysis" TEXT,
    "metadata" JSONB,
    "contentHash" CHAR(64) NOT NULL,
    "canonicalHash" CHAR(64) NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "reviewStatus" "BankReviewStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "rawSource" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankQuestionSource" (
    "questionId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceItemKey" VARCHAR(512) NOT NULL,
    "role" "BankSourceRole" NOT NULL DEFAULT 'QUESTION',
    "payloadHash" CHAR(64) NOT NULL,
    "sourcePayload" JSONB NOT NULL,
    "rawSource" JSONB,
    "resolutionEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankQuestionSource_pkey" PRIMARY KEY ("questionId","sourceId","sourceItemKey","role")
);

-- CreateTable
CREATE TABLE "BankQuestionAsset" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "assetRole" VARCHAR(32) NOT NULL DEFAULT 'question',
    "sourceUrl" VARCHAR(2048) NOT NULL,
    "storageUrl" VARCHAR(2048),
    "contentSha256" CHAR(64),
    "mimeType" VARCHAR(100),
    "byteSize" BIGINT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankQuestionAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankSectionAsset" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "assetRole" VARCHAR(32) NOT NULL DEFAULT 'section',
    "sourceUrl" VARCHAR(2048) NOT NULL,
    "storageUrl" VARCHAR(2048),
    "contentSha256" CHAR(64),
    "mimeType" VARCHAR(100),
    "byteSize" BIGINT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankSectionAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankPaperPublication" (
    "bankPaperId" TEXT NOT NULL,
    "testPaperId" TEXT NOT NULL,
    "reviewedBy" VARCHAR(191) NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankPaperPublication_pkey" PRIMARY KEY ("bankPaperId")
);

-- CreateTable
CREATE TABLE "BankSectionPublication" (
    "bankSectionId" TEXT NOT NULL,
    "questionGroupId" TEXT NOT NULL,
    "reviewedBy" VARCHAR(191) NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankSectionPublication_pkey" PRIMARY KEY ("bankSectionId")
);

-- CreateTable
CREATE TABLE "BankQuestionPublication" (
    "bankQuestionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reviewedBy" VARCHAR(191) NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankQuestionPublication_pkey" PRIMARY KEY ("bankQuestionId")
);

-- CreateTable
CREATE TABLE "BankIngestRun" (
    "id" UUID NOT NULL,
    "manifestSha256" CHAR(64) NOT NULL,
    "planSha256" CHAR(64) NOT NULL,
    "databaseIdentityHash" CHAR(64) NOT NULL,
    "remoteInventoryHash" CHAR(64),
    "sourceRevision" VARCHAR(512),
    "importerVersion" VARCHAR(64) NOT NULL,
    "status" "BankIngestStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "stats" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "BankIngestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankIngestItem" (
    "id" TEXT NOT NULL,
    "runId" UUID NOT NULL,
    "sourceKey" VARCHAR(512) NOT NULL,
    "itemKind" VARCHAR(32) NOT NULL,
    "action" "BankIngestAction" NOT NULL,
    "paperId" TEXT,
    "sectionId" TEXT,
    "questionId" TEXT,
    "beforeHash" CHAR(64),
    "afterHash" CHAR(64),
    "details" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankIngestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankSourceSnapshot_sourceKey_key" ON "BankSourceSnapshot"("sourceKey");

-- CreateIndex
CREATE INDEX "BankSourceSnapshot_rightsStatus_idx" ON "BankSourceSnapshot"("rightsStatus");

-- CreateIndex
CREATE UNIQUE INDEX "BankSourceSnapshot_providerKey_revision_key" ON "BankSourceSnapshot"("providerKey", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "BankPaper_paperKey_key" ON "BankPaper"("paperKey");

-- CreateIndex
CREATE INDEX "BankPaper_examYear_subjectCode_variantCode_idx" ON "BankPaper"("examYear", "subjectCode", "variantCode");

-- CreateIndex
CREATE INDEX "BankPaperSource_sourceId_idx" ON "BankPaperSource"("sourceId");

-- CreateIndex
CREATE INDEX "BankPaperRegion_regionCode_paperId_idx" ON "BankPaperRegion"("regionCode", "paperId");

-- CreateIndex
CREATE INDEX "BankPaperRegion_sourceId_idx" ON "BankPaperRegion"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "BankSection_sourceKey_key" ON "BankSection"("sourceKey");

-- CreateIndex
CREATE INDEX "BankSection_sourceId_idx" ON "BankSection"("sourceId");

-- CreateIndex
CREATE INDEX "BankSection_contentHash_idx" ON "BankSection"("contentHash");

-- CreateIndex
CREATE INDEX "BankSection_reviewStatus_idx" ON "BankSection"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "BankSection_id_paperId_key" ON "BankSection"("id", "paperId");

-- CreateIndex
CREATE UNIQUE INDEX "BankSection_paperId_sortOrder_key" ON "BankSection"("paperId", "sortOrder");

-- CreateIndex
CREATE INDEX "BankSectionSource_sourceItemKey_idx" ON "BankSectionSource"("sourceItemKey");

-- CreateIndex
CREATE UNIQUE INDEX "BankSectionSource_sourceId_sourceItemKey_role_key" ON "BankSectionSource"("sourceId", "sourceItemKey", "role");

-- CreateIndex
CREATE UNIQUE INDEX "BankQuestion_sourceKey_key" ON "BankQuestion"("sourceKey");

-- CreateIndex
CREATE INDEX "BankQuestion_paperId_sortOrder_idx" ON "BankQuestion"("paperId", "sortOrder");

-- CreateIndex
CREATE INDEX "BankQuestion_sourceId_idx" ON "BankQuestion"("sourceId");

-- CreateIndex
CREATE INDEX "BankQuestion_contentHash_idx" ON "BankQuestion"("contentHash");

-- CreateIndex
CREATE INDEX "BankQuestion_canonicalHash_idx" ON "BankQuestion"("canonicalHash");

-- CreateIndex
CREATE INDEX "BankQuestion_reviewStatus_idx" ON "BankQuestion"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "BankQuestion_sectionId_sortOrder_key" ON "BankQuestion"("sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "BankQuestionSource_sourceItemKey_idx" ON "BankQuestionSource"("sourceItemKey");

-- CreateIndex
CREATE UNIQUE INDEX "BankQuestionSource_sourceId_sourceItemKey_role_key" ON "BankQuestionSource"("sourceId", "sourceItemKey", "role");

-- CreateIndex
CREATE INDEX "BankQuestionAsset_questionId_idx" ON "BankQuestionAsset"("questionId");

-- CreateIndex
CREATE INDEX "BankQuestionAsset_contentSha256_idx" ON "BankQuestionAsset"("contentSha256");

-- CreateIndex
CREATE INDEX "BankSectionAsset_sectionId_idx" ON "BankSectionAsset"("sectionId");

-- CreateIndex
CREATE INDEX "BankSectionAsset_contentSha256_idx" ON "BankSectionAsset"("contentSha256");

-- CreateIndex
CREATE INDEX "BankPaperPublication_testPaperId_idx" ON "BankPaperPublication"("testPaperId");

-- CreateIndex
CREATE INDEX "BankSectionPublication_questionGroupId_idx" ON "BankSectionPublication"("questionGroupId");

-- CreateIndex
CREATE INDEX "BankQuestionPublication_questionId_idx" ON "BankQuestionPublication"("questionId");

-- CreateIndex
CREATE INDEX "BankIngestRun_manifestSha256_status_idx" ON "BankIngestRun"("manifestSha256", "status");

-- CreateIndex
CREATE INDEX "BankIngestItem_paperId_idx" ON "BankIngestItem"("paperId");

-- CreateIndex
CREATE INDEX "BankIngestItem_sectionId_idx" ON "BankIngestItem"("sectionId");

-- CreateIndex
CREATE INDEX "BankIngestItem_questionId_idx" ON "BankIngestItem"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "BankIngestItem_runId_itemKind_sourceKey_key" ON "BankIngestItem"("runId", "itemKind", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "Question_sourceKey_key" ON "Question"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionGroup_sourceKey_key" ON "QuestionGroup"("sourceKey");

-- CreateIndex
CREATE INDEX "QuestionGroup_year_idx" ON "QuestionGroup"("year");

-- CreateIndex
CREATE UNIQUE INDEX "GroupItem_groupId_orderIndex_key" ON "GroupItem"("groupId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "GroupItem_groupId_blankIndex_key" ON "GroupItem"("groupId", "blankIndex");

-- CreateIndex
CREATE UNIQUE INDEX "TestPaper_sourceKey_key" ON "TestPaper"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaperItem_paperId_orderIndex_key" ON "PaperItem"("paperId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSubmission_groupSubmissionId_questionId_key" ON "QuestionSubmission"("groupSubmissionId", "questionId");

-- AddForeignKey
ALTER TABLE "BankPaperSource" ADD CONSTRAINT "BankPaperSource_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "BankPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPaperSource" ADD CONSTRAINT "BankPaperSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BankSourceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPaperRegion" ADD CONSTRAINT "BankPaperRegion_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "BankPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPaperRegion" ADD CONSTRAINT "BankPaperRegion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BankSourceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSection" ADD CONSTRAINT "BankSection_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "BankPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSection" ADD CONSTRAINT "BankSection_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BankSourceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSectionSource" ADD CONSTRAINT "BankSectionSource_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BankSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSectionSource" ADD CONSTRAINT "BankSectionSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BankSourceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestion" ADD CONSTRAINT "BankQuestion_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "BankPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestion" ADD CONSTRAINT "BankQuestion_sectionId_paperId_fkey" FOREIGN KEY ("sectionId", "paperId") REFERENCES "BankSection"("id", "paperId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestion" ADD CONSTRAINT "BankQuestion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BankSourceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestionSource" ADD CONSTRAINT "BankQuestionSource_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "BankQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestionSource" ADD CONSTRAINT "BankQuestionSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BankSourceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestionAsset" ADD CONSTRAINT "BankQuestionAsset_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "BankQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSectionAsset" ADD CONSTRAINT "BankSectionAsset_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BankSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPaperPublication" ADD CONSTRAINT "BankPaperPublication_bankPaperId_fkey" FOREIGN KEY ("bankPaperId") REFERENCES "BankPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPaperPublication" ADD CONSTRAINT "BankPaperPublication_testPaperId_fkey" FOREIGN KEY ("testPaperId") REFERENCES "TestPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSectionPublication" ADD CONSTRAINT "BankSectionPublication_bankSectionId_fkey" FOREIGN KEY ("bankSectionId") REFERENCES "BankSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSectionPublication" ADD CONSTRAINT "BankSectionPublication_questionGroupId_fkey" FOREIGN KEY ("questionGroupId") REFERENCES "QuestionGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestionPublication" ADD CONSTRAINT "BankQuestionPublication_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "BankQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankQuestionPublication" ADD CONSTRAINT "BankQuestionPublication_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankIngestItem" ADD CONSTRAINT "BankIngestItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BankIngestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankIngestItem" ADD CONSTRAINT "BankIngestItem_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "BankPaper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankIngestItem" ADD CONSTRAINT "BankIngestItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BankSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankIngestItem" ADD CONSTRAINT "BankIngestItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "BankQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Database-level invariants that Prisma cannot currently express in schema.prisma.
ALTER TABLE "BankSection"
    ADD CONSTRAINT "BankSection_score_nonnegative_check"
        CHECK ("score" IS NULL OR "score" >= 0),
    ADD CONSTRAINT "BankSection_sortOrder_positive_check"
        CHECK ("sortOrder" > 0),
    ADD CONSTRAINT "BankSection_contentHash_sha256_check"
        CHECK ("contentHash"::text ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "BankSection_payloadHash_sha256_check"
        CHECK ("payloadHash"::text ~ '^[0-9a-f]{64}$');

ALTER TABLE "BankQuestion"
    ADD CONSTRAINT "BankQuestion_score_nonnegative_check"
        CHECK ("score" IS NULL OR "score" >= 0),
    ADD CONSTRAINT "BankQuestion_sortOrder_positive_check"
        CHECK ("sortOrder" > 0),
    ADD CONSTRAINT "BankQuestion_correctRate_range_check"
        CHECK ("correctRate" IS NULL OR ("correctRate" >= 0 AND "correctRate" <= 1)),
    ADD CONSTRAINT "BankQuestion_contentHash_sha256_check"
        CHECK ("contentHash"::text ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "BankQuestion_canonicalHash_sha256_check"
        CHECK ("canonicalHash"::text ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "BankQuestion_payloadHash_sha256_check"
        CHECK ("payloadHash"::text ~ '^[0-9a-f]{64}$');

ALTER TABLE "BankSourceSnapshot"
    ADD CONSTRAINT "BankSourceSnapshot_snapshotSha256_sha256_check"
        CHECK ("snapshotSha256"::text ~ '^[0-9a-f]{64}$');

ALTER TABLE "BankPaper"
    ADD CONSTRAINT "BankPaper_examYear_range_check"
        CHECK ("examYear" BETWEEN 1900 AND 2100);

ALTER TABLE "BankSectionSource"
    ADD CONSTRAINT "BankSectionSource_payloadHash_sha256_check"
        CHECK ("payloadHash"::text ~ '^[0-9a-f]{64}$');

ALTER TABLE "BankQuestionSource"
    ADD CONSTRAINT "BankQuestionSource_payloadHash_sha256_check"
        CHECK ("payloadHash"::text ~ '^[0-9a-f]{64}$');

ALTER TABLE "BankQuestionAsset"
    ADD CONSTRAINT "BankQuestionAsset_contentSha256_sha256_check"
        CHECK ("contentSha256" IS NULL OR "contentSha256"::text ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "BankQuestionAsset_byteSize_nonnegative_check"
        CHECK ("byteSize" IS NULL OR "byteSize" >= 0);

ALTER TABLE "BankSectionAsset"
    ADD CONSTRAINT "BankSectionAsset_contentSha256_sha256_check"
        CHECK ("contentSha256" IS NULL OR "contentSha256"::text ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "BankSectionAsset_byteSize_nonnegative_check"
        CHECK ("byteSize" IS NULL OR "byteSize" >= 0);

ALTER TABLE "BankIngestRun"
    ADD CONSTRAINT "BankIngestRun_manifestSha256_sha256_check"
        CHECK ("manifestSha256"::text ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "BankIngestRun_planSha256_sha256_check"
        CHECK ("planSha256"::text ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "BankIngestRun_databaseIdentityHash_sha256_check"
        CHECK ("databaseIdentityHash"::text ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "BankIngestRun_remoteInventoryHash_sha256_check"
        CHECK ("remoteInventoryHash" IS NULL OR "remoteInventoryHash"::text ~ '^[0-9a-f]{64}$');

ALTER TABLE "BankIngestItem"
    ADD CONSTRAINT "BankIngestItem_beforeHash_sha256_check"
        CHECK ("beforeHash" IS NULL OR "beforeHash"::text ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "BankIngestItem_afterHash_sha256_check"
        CHECK ("afterHash" IS NULL OR "afterHash"::text ~ '^[0-9a-f]{64}$');

ALTER TABLE "Question"
    ADD CONSTRAINT "Question_payloadHash_sha256_check"
        CHECK ("payloadHash" IS NULL OR "payloadHash"::text ~ '^[0-9a-f]{64}$');

ALTER TABLE "QuestionGroup"
    ADD CONSTRAINT "QuestionGroup_payloadHash_sha256_check"
        CHECK ("payloadHash" IS NULL OR "payloadHash"::text ~ '^[0-9a-f]{64}$');

ALTER TABLE "TestPaper"
    ADD CONSTRAINT "TestPaper_payloadHash_sha256_check"
        CHECK ("payloadHash" IS NULL OR "payloadHash"::text ~ '^[0-9a-f]{64}$');

COMMIT;
