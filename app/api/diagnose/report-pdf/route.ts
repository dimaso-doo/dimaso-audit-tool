import { NextRequest, NextResponse } from "next/server";
import { createDiagnosisPdf } from "@/lib/report/pdf";
import type { DiagnosisResult } from "@/lib/diagnosis/types";

function filenameFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/[^a-z0-9.-]/gi, "-");
  } catch {
    return "website";
  }
}

export async function POST(request: NextRequest) {
  let result: DiagnosisResult;

  try {
    result = (await request.json()) as DiagnosisResult;
  } catch {
    return NextResponse.json({ error: "Invalid report request body." }, { status: 400 });
  }

  if (!result?.site?.finalUrl || !result?.rebuildRecommendation || !result?.clientReport) {
    return NextResponse.json({ error: "Expected a completed diagnosis result." }, { status: 400 });
  }

  const filename = `dimaso-diagnosis-${filenameFromUrl(result.site.finalUrl)}.pdf`;

  return new NextResponse(createDiagnosisPdf(result), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store"
    }
  });
}
