import { NextRequest, NextResponse } from "next/server";
import { createAuditPdf } from "@/lib/report/pdf";
import type { AuditResult } from "@/lib/audit/types";

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/audit", request.url));
}

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
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      result = (await request.json()) as AuditResult;
    } else {
      const formData = await request.formData();
      result = JSON.parse(String(formData.get("auditResult") ?? "{}")) as AuditResult;
    }
  } catch {
    return NextResponse.json({ error: "Invalid report request body." }, { status: 400 });
  }

  if (!result?.universal?.finalUrl || !result?.scores || !Array.isArray(result.issues)) {
    return NextResponse.json({ error: "Expected a completed audit result." }, { status: 400 });
  }

  const pdf = createAuditPdf(result);
  const filename = `dimaso-audit-${filenameFromUrl(result.universal.finalUrl)}.pdf`;

  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store"
    }
  });
}
