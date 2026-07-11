import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { NextResponse } from "next/server";

import {
  parseGroupSubmissionInput,
  prepareGroupSubmission,
} from "./submission-logic";

function errorResponse(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return errorResponse("Authentication required", 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsedInput = parseGroupSubmissionInput(rawBody);
  if (!parsedInput.ok) {
    return errorResponse(parsedInput.error, 400);
  }

  const { questionGroupId, questionSubmissions, duration } = parsedInput.value;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const questionGroup = await transaction.questionGroup.findUnique({
        where: { id: questionGroupId },
        select: {
          groupItems: {
            select: {
              question: {
                select: {
                  id: true,
                  questionType: true,
                  answer: true,
                  score: true,
                },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
      });

      if (!questionGroup) {
        return { kind: "not-found" as const };
      }

      const prepared = prepareGroupSubmission(
        questionGroup.groupItems.map((item) => item.question),
        questionSubmissions,
      );
      if (!prepared.ok) {
        return {
          kind: "invalid" as const,
          error: prepared.error,
        };
      }

      await transaction.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId },
      });

      const groupSubmission = await transaction.questionGroupSubmission.create({
        data: {
          userId,
          questionGroupId,
          score: prepared.value.score,
          isCorrect: prepared.value.isCorrect,
          correctNum: prepared.value.correctNum,
          totalNum: prepared.value.totalNum,
          duration,
        },
        select: { id: true },
      });

      if (prepared.value.submissions.length > 0) {
        await transaction.questionSubmission.createMany({
          data: prepared.value.submissions.map((submission) => ({
            userId,
            questionId: submission.questionId,
            groupSubmissionId: groupSubmission.id,
            content: submission.content,
            score: submission.score,
            isCorrect: submission.isCorrect,
          })),
        });
      }

      return {
        kind: "created" as const,
        submissionId: groupSubmission.id,
      };
    });

    if (result.kind === "not-found") {
      return errorResponse("QuestionGroup not found", 404);
    }
    if (result.kind === "invalid") {
      return errorResponse(result.error, 400);
    }

    return NextResponse.json({ success: true, submissionId: result.submissionId });
  } catch (error) {
    console.error("Error creating submission:", error);
    return errorResponse("Failed to create submission", 500);
  }
}
