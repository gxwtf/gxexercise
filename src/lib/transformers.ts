import type { QuestionModel, QuestionGroupModel, TestPaperModel } from "@/generated/prisma/models";

export function transformQuestion(question: QuestionModel): Omit<QuestionModel, 'correctRate'> & { correctRate: number | null } {
  return {
    ...question,
    correctRate: question.correctRate ? Number(question.correctRate) : null,
  };
}

export function transformQuestions(questions: QuestionModel[]): (Omit<QuestionModel, 'correctRate'> & { correctRate: number | null })[] {
  return questions.map(transformQuestion);
}

export function transformQuestionGroup(group: QuestionGroupModel): QuestionGroupModel {
  return group;
}

export function transformQuestionGroups(groups: QuestionGroupModel[]): QuestionGroupModel[] {
  return groups.map(transformQuestionGroup);
}

export function transformTestPaper(paper: TestPaperModel): TestPaperModel {
  return paper;
}

export function transformTestPapers(papers: TestPaperModel[]): TestPaperModel[] {
  return papers.map(transformTestPaper);
}
