"use client"

import * as React from "react"
import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote"
import { useMDXComponents } from "@/mdx-components"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

const REPORT_CSS = `
  .essay-report {
    font-family: "Times New Roman", SimSun, "宋体", "Songti SC", STSong, serif;
    color: #111;
    font-size: 12pt;
    line-height: 1.75;
    background: #fff;
  }
  .essay-report h1 { font-size: 17pt; font-weight: 700; text-align: center; margin: 0 0 4pt; letter-spacing: .5pt; }
  .essay-report .meta { font-size: 10.5pt; color: #444; text-align: center; margin: 0 0 16pt; }
  .essay-report h2 { font-size: 13.5pt; font-weight: 700; margin: 18pt 0 8pt; padding-bottom: 3pt; border-bottom: 1.2pt solid #333; }
  .essay-report h3 { font-size: 12pt; font-weight: 700; margin: 12pt 0 6pt; }
  .essay-report p { margin: 0 0 8pt; text-align: justify; }
  .essay-report ul, .essay-report ol { margin: 0 0 8pt 18pt; }
  .essay-report li { margin-bottom: 3pt; }
  .essay-report table { width: 100%; border-collapse: collapse; margin: 6pt 0 12pt; }
  .essay-report th, .essay-report td { border: 1pt solid #888; padding: 5pt 7pt; font-size: 11pt; }
  .essay-report th { background: #f2f2f2; font-weight: 700; text-align: center; }
  .essay-report .box { border: 1pt solid #bbb; padding: 8pt 10pt; margin-bottom: 10pt; }
  .essay-report .score-line { font-size: 12.5pt; font-weight: 700; margin: 0 0 10pt; }
  .essay-report img { max-width: 100%; }
  .essay-report .katex { font-size: 0.92em; }
  .essay-report .footer { margin-top: 20pt; padding-top: 6pt; border-top: .8pt solid #999; font-size: 9.5pt; color: #666; text-align: center; }
  @media screen {
    .essay-report { max-width: 820px; margin: 24px auto 48px; padding: 36px 40px; box-shadow: 0 1px 8px rgba(0,0,0,.15); }
  }
  @media print {
    @page { size: A4; margin: 16mm 14mm; }
    .no-print { display: none !important; }
    .essay-report { max-width: none; margin: 0; padding: 0; box-shadow: none; }
    .essay-report h2 { break-after: avoid; }
    .essay-report .box, .essay-report table { break-inside: avoid; }
  }
`

interface EssayReportProps {
  title: string
  questionType: string
  questionIndex: number
  stemMdx: MDXRemoteSerializeResult | null
  answerMdx: MDXRemoteSerializeResult | null
  overallCommentMdx: MDXRemoteSerializeResult | null
  lineCorrectionsMdx: MDXRemoteSerializeResult | null
  correctionsMdx: MDXRemoteSerializeResult | null
  betterExpressionsMdx: MDXRemoteSerializeResult | null
  modelEssayMdx: MDXRemoteSerializeResult | null
  subScores: Record<string, number> | null
  score: number | null
  maxScore: number | null
  feedbackText: string | null
  generatedAt: string
}

export function EssayReport(props: EssayReportProps) {
  const {
    title,
    questionIndex,
    stemMdx,
    answerMdx,
    overallCommentMdx,
    lineCorrectionsMdx,
    correctionsMdx,
    betterExpressionsMdx,
    modelEssayMdx,
    subScores,
    score,
    maxScore,
    feedbackText,
    generatedAt,
  } = props
  const components = useMDXComponents()

  // 打开即调起打印（用户选择「另存为 PDF」即可下载）
  React.useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.print()
      } catch {}
    }, 700)
    return () => clearTimeout(timer)
  }, [])

  const subScoreRows = subScores
    ? ["内容", "语言", "结构"].filter((k) => typeof subScores[k] === "number")
    : []
  const subScoreTotal = subScores
    ? subScoreRows.reduce((sum, k) => sum + (subScores[k] || 0), 0)
    : null

  return (
    <div className="min-h-screen bg-muted/40 py-2">
      <style>{REPORT_CSS}</style>

      <div className="no-print mx-auto mb-3 flex max-w-[820px] items-center justify-between gap-3 px-4">
        <p className="text-sm text-muted-foreground">
          回车/点击右侧按钮打开打印窗口，在「目标打印机」里选「另存为 PDF」即可下载
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="size-4" />
          打印 / 保存为 PDF
        </Button>
      </div>

      <article className="essay-report">
        <h1>{title}</h1>
        <p className="meta">
          第 {questionIndex} 篇 · 得分 {score ?? "-"} / {maxScore ?? "-"} · 生成于 {generatedAt}
        </p>

        <h2>一、题目</h2>
        <div className="box">
          {stemMdx ? <MDXRemote {...stemMdx} components={components} /> : <p>（无题目内容）</p>}
        </div>

        <h2>二、我的原稿</h2>
        <div className="box">
          {answerMdx ? <MDXRemote {...answerMdx} components={components} /> : <p>（未作答）</p>}
        </div>

        <h2>三、评分与批改</h2>
        <p className="score-line">
          总得分：{score ?? "-"} / {maxScore ?? "-"}
          {subScoreTotal != null ? `（分项合计 ${subScoreTotal} 分）` : ""}
        </p>

        {subScoreRows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th style={{ width: "28%" }}>评分维度</th>
                {subScoreRows.map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>得分</td>
                {subScoreRows.map((k) => (
                  <td key={k}>{subScores?.[k] ?? "-"}</td>
                ))}
              </tr>
            </tbody>
          </table>
        )}

        {overallCommentMdx && (
          <>
            <h3>整体评价</h3>
            <MDXRemote {...overallCommentMdx} components={components} />
          </>
        )}

        {(lineCorrectionsMdx || correctionsMdx) && (
          <>
            <h3>逐句修改</h3>
            <MDXRemote {...((lineCorrectionsMdx || correctionsMdx) as MDXRemoteSerializeResult)} components={components} />
          </>
        )}

        {betterExpressionsMdx && (
          <>
            <h3>更优表达</h3>
            <MDXRemote {...betterExpressionsMdx} components={components} />
          </>
        )}

        {!overallCommentMdx && feedbackText && (
          <>
            <h3>评语</h3>
            <p>{feedbackText}</p>
          </>
        )}

        <h2>四、最终修改稿</h2>
        <div className="box">
          {modelEssayMdx ? <MDXRemote {...modelEssayMdx} components={components} /> : <p>（暂无修改稿）</p>}
        </div>

        <p className="footer">广学题库 · 英语作文 AI 批改报告</p>
      </article>
    </div>
  )
}
