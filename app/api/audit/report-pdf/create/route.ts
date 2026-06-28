import { NextRequest, NextResponse } from "next/server";
import { createAuditPdf } from "@/lib/report/pdf";
import { saveReport } from "@/lib/report/store";
import type { AuditResult } from "@/lib/audit/types";

function filenameFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/[^a-z0-9.-]/gi, "-");
  } catch {
    return "website";
  }
}

export async function POST(request: NextRequest) {
  let result: AuditResult;

  try {
    result = (await request.json()) as AuditResult;
  } catch {
    return NextResponse.json({ error: "Invalid report request body." }, { status: 400 });
  }

  if (!result?.universal?.finalUrl || !result?.scores || !Array.isArray(result.issues)) {
    return NextResponse.json({ error: "Expected a completed audit result." }, { status: 400 });
  }

  const filename = `dimaso-audit-${filenameFromUrl(result.universal.finalUrl)}.pdf`;
  const id = saveReport(createAuditPdf(result), filename);

  return NextResponse.json({
    id,
    downloadUrl: `/api/audit/report-pdf?id=${encodeURIComponent(id)}`,
    filename
  });
}
