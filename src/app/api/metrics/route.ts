import { NextResponse } from "next/server";
import { getMetricsSummary } from "@/lib/metrics";

export const runtime = "nodejs";

/** Lightweight ops summary (no PII) — useful for cost awareness */
export async function GET() {
  const summary = await getMetricsSummary();
  return NextResponse.json(summary);
}
