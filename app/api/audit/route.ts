import { NextRequest, NextResponse } from "next/server";
import { runAudit } from "@/lib/audit/engine";
import { UrlSafetyError } from "@/lib/audit/urlSafety";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const url = typeof body === "object" && body && "url" in body ? (body as { url?: unknown }).url : undefined;
  if (typeof url !== "string") {
    return NextResponse.json({ error: "Expected body: { \"url\": \"https://example.com\" }" }, { status: 400 });
  }

  try {
    const result = await runAudit(url);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit failed.";
    const status = error instanceof UrlSafetyError ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
