import { NextResponse } from "next/server"

/** 把生成好的 PDF 包成「附件下载」响应（中文文件名用 RFC 5987 编码） */
export function pdfAttachment(pdf: Uint8Array, filename: string): NextResponse {
  const safe = String(filename || "paper.pdf").replace(/[\\/:*?"<>|]/g, "_")
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="paper.pdf"; filename*=UTF-8''${encodeURIComponent(safe)}`,
      "Cache-Control": "no-store",
    },
  })
}
