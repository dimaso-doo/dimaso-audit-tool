import { NextRequest, NextResponse } from "next/server";
import { diagnoseSite } from "@/lib/diagnosis";
import { UrlSafetyError } from "@/lib/audit/urlSafety";
import type { DiagnosisInput } from "@/lib/diagnosis/types";

const organizationTypes = ["ngo", "membership", "service_business", "ecommerce", "healthcare", "education", "travel", "local_business", "saas", "unknown"];
const goals = ["leads", "ecommerce", "resources", "members", "donations", "events", "bookings", "credibility", "rebuild", "unknown"];

export async function POST(request: NextRequest) {
  let body: Partial<DiagnosisInput>;
  try {
    body = (await request.json()) as Partial<DiagnosisInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.url !== "string") return NextResponse.json({ error: "URL is required." }, { status: 400 });
  if (!organizationTypes.includes(body.organizationType ?? "")) return NextResponse.json({ error: "Invalid organizationType." }, { status: 400 });
  if (!goals.includes(body.primaryGoal ?? "")) return NextResponse.json({ error: "Invalid primaryGoal." }, { status: 400 });

  try {
    return NextResponse.json(await diagnoseSite(body as DiagnosisInput));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Diagnosis failed.";
    return NextResponse.json({ error: message }, { status: error instanceof UrlSafetyError ? 400 : 502 });
  }
}
