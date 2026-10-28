import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getAdminViewer } from "@/lib/admin-guard"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  answerText,
  formatDateTime,
  gradingStatusText,
  round1,
  scoreText,
} from "@/lib/submission-records"
import { isSubjectiveQuestion, meetsExcellentStandard } from "@/lib/excellent-answer-rules"

export const dynamic = "force-dynamic"

const STATUS_CLASS: Record<string, string> = {
  graded: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
}

/** AI 反馈里可直接展示的文本字段（按展示顺序） */
const FEEDBACK_TEXT_FIELDS: { key: string; label: string }[] = [
  { key: "feedback", label: "评语" },
  { key: "overallComment", label: "总评" },
  { key: "lineCorrections", label: "逐句批改" },
  { key: "corrections", label: "修改建议" },
  { key: "betterExpressions", label: "更佳表达" },
  { key: "modelEssay", label: "参考范文" },
]

const SUB_SCORE_LABELS: Record<string, string> = {
  content: "内容",
  language: "语言",
  structure: "结构",
  task: "任务完成",
  grammar: "语法",
  vocabulary: "词汇",
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = status ?? ""
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_CLASS[key] ?? "bg-muted text-muted-foreground"
      )}
    >
      {gradingStatusText(status)}
    </span>
  )
}

interface PageProps {
  params: Promise<{ id: string }>
}

/** 管理员：单次作答详情（只读，展示作答内容与 AI 批改反馈） */
export default async function AdminSubmissionDetailPage({ params }: PageProps) {
  // 权限校验必须放在查库之前：layout 的校验拦不住 page 的执行与 RSC 载荷
  const viewer = await getAdminViewer()
  if (!viewer.ok) {
    if (viewer.reason === "anonymous") redirect("/login?back=/admin/submissions")
    return null
  }

  const { id } = await params

  const submission = await prisma.questionGroupSubmission.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, userName: true } },
      questionGroup: {
        select: {
          id: true,
          title: true,
          subject: true,
          category: true,
          questionType: true,
          score: true,
          source: true,
          groupItems: {
            select: {
              orderIndex: true,
              question: {
                select: { id: true, questionType: true, score: true, answer: true, analysis: true },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
      submissions: true,
      testSubmission: {
        select: {
          id: true,
          testPaperId: true,
          testPaper: { select: { title: true, totalScore: true } },
        },
      },
    },
  })

  if (!submission) notFound()

  const group = submission.questionGroup
  const inPaper = submission.testSubmission
  const byQuestionId = new Map(submission.submissions.map((s) => [s.questionId, s]))

  return (
    <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-5">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 h-7 px-2">
          <Link href="/admin/submissions">← 返回全部作答记录</Link>
        </Button>

        <h1 className="text-xl font-bold sm:text-2xl">作答详情</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {submission.user.userName || `同学${submission.user.id}`}（#{submission.user.id}）
          {" · "}
          {formatDateTime(submission.createdAt)}
          {" · "}
          {group.subject}
          {" · 得分 "}
          {scoreText(submission.score, group.score)}
        </p>
      </div>

      {/* 作答概况 */}
      <div className="mb-6 grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
        <div>
          <span className="text-muted-foreground">题组：</span>
          <Link href={`/question/${group.id}`} className="font-medium hover:text-primary">
            {group.title}
          </Link>
        </div>
        <div>
          <span className="text-muted-foreground">来源：</span>
          {group.source || "-"}
        </div>
        <div>
          <span className="text-muted-foreground">题型：</span>
          {group.questionType}
          {group.category ? ` · ${group.category}` : ""}
        </div>
        <div>
          <span className="text-muted-foreground">归属：</span>
          {inPaper ? (
            <>
              套卷小节 ·{" "}
              <Link href={`/test-paper/${inPaper.testPaperId}`} className="font-medium hover:text-primary">
                {inPaper.testPaper?.title ?? inPaper.testPaperId}
              </Link>
            </>
          ) : (
            "单节练习"
          )}
        </div>
      </div>

      <div className="space-y-4">
        {group.groupItems.map((item, index) => {
          const question = item.question
          const sub = byQuestionId.get(question.id)
          const answer = answerText(sub?.content)
          const feedback = (sub?.aiFeedback ?? null) as Record<string, unknown> | null
          const subScores = (feedback?.subScores ?? null) as Record<string, number> | null
          const subjective = isSubjectiveQuestion(question.questionType, group.questionType)
          const excellent = subjective && sub
            ? meetsExcellentStandard(group.questionType, sub.score, question.score)
            : false

          return (
            <section key={question.id} className="rounded-lg border border-border p-4">
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-semibold">第 {index + 1} 题</span>
                <span className="text-muted-foreground">{question.questionType}</span>
                <span className="text-muted-foreground">
                  满分 {round1(question.score)}
                </span>
                <span className="font-medium">
                  得分 {sub?.score == null ? "-" : round1(sub.score)}
                </span>
                <StatusBadge status={sub?.gradingStatus} />
                {excellent && (
                  <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                    达到优秀标准
                  </span>
                )}
                {sub?.shareAsExcellent === false && (
                  <span className="text-xs text-muted-foreground">（已关闭「作为优秀解答展示」）</span>
                )}
              </div>

              <div className="mb-4">
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">作答内容</h3>
                {answer ? (
                  <p className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm">
                    {answer}
                  </p>
                ) : (
                  <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">（未作答）</p>
                )}
              </div>

              {feedback && (subScores || FEEDBACK_TEXT_FIELDS.some((f) => feedback[f.key])) ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">AI 批改反馈</h3>
                  {subScores && Object.keys(subScores).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(subScores).map(([key, value]) => (
                        <span
                          key={key}
                          className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                        >
                          {SUB_SCORE_LABELS[key] ?? key}：{value}
                        </span>
                      ))}
                    </div>
                  )}
                  {FEEDBACK_TEXT_FIELDS.map(({ key, label }) => {
                    const text = feedback[key]
                    if (typeof text !== "string" || !text.trim()) return null
                    return (
                      <div key={key}>
                        <h4 className="mb-1 text-sm font-medium">{label}</h4>
                        <p className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm">
                          {text}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {sub?.gradingStatus === "pending" ? "AI 批改中，暂无反馈。" : "暂无 AI 批改反馈。"}
                </p>
              )}

              {(question.answer || question.analysis) && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">参考答案与解析</summary>
                  {question.answer && (
                    <p className="mt-2 whitespace-pre-wrap break-words">
                      <span className="text-muted-foreground">答案：</span>
                      {question.answer}
                    </p>
                  )}
                  {question.analysis && (
                    <p className="mt-2 whitespace-pre-wrap break-words">
                      <span className="text-muted-foreground">解析：</span>
                      {question.analysis}
                    </p>
                  )}
                </details>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
