import { NextRequest, NextResponse } from "next/server";
import { listInsights, searchInsights, stats } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const model = searchParams.get("model") || undefined;
  const category = searchParams.get("category") || undefined;
  const withStats = searchParams.get("stats") === "1";

  if (withStats) {
    return NextResponse.json({
      insights: await listInsights(),
      stats: await stats(),
    });
  }

  const insights = await searchInsights({ q, model, category });
  return NextResponse.json({ insights });
}
