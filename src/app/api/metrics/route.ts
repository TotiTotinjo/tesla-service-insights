import { NextResponse } from "next/server";
import { getMetricsSummary } from "@/lib/metrics";

export const runtime = "nodejs";

/**
 * Public metrics: totals only (no event log).
 * Full history requires METRICS_ADMIN_TOKEN header match.
 */
export async function GET(req: Request) {
  const summary = await getMetricsSummary();
  const admin = process.env.METRICS_ADMIN_TOKEN;
  const provided = req.headers.get("x-metrics-token");

  if (admin && provided === admin) {
    return NextResponse.json(summary);
  }

  // Public: no recent event stream (avoids leaking operational detail)
  return NextResponse.json({
    totals: summary.totals,
    note: "Early beta counters only. No PII.",
  });
}
