import { NextRequest, NextResponse } from "next/server";
import { analyzePatterns, heuristicClusters } from "@/lib/extract";
import { recordMetric } from "@/lib/metrics";
import { listInsights, listPatterns, savePatterns } from "@/lib/store";
import type { VehicleModel } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const patterns = await listPatterns();
  return NextResponse.json({ patterns });
}

/**
 * Cluster insights.
 * Default: free local heuristic (no Grok tokens).
 * Pass { "useAi": true } only when you want a paid Grok clustering pass.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { useAi?: boolean };
    const useAi = body.useAi === true;

    if (useAi && !process.env.XAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing XAI_API_KEY on server." },
        { status: 503 }
      );
    }

    const insights = await listInsights();
    if (insights.length === 0) {
      return NextResponse.json({
        patterns: [],
        message: "No insights yet. Upload invoices first.",
        usedGrok: false,
      });
    }

    const input = insights.map((i) => ({
      id: i.id,
      title: i.title,
      vehicleModel: i.vehicleModel,
      categories: i.categories,
      symptoms: i.symptoms,
      diagnosis: i.diagnosis,
      resolution: i.resolution,
      partsReplaced: i.partsReplaced,
      issueKey: i.issueKey,
      issueSlug: i.issueSlug,
      fixStatus: i.fixStatus,
    }));

    const clusters = useAi
      ? await analyzePatterns(input)
      : heuristicClusters(input);

    const patterns = await savePatterns(
      clusters.map((c) => ({
        title: c.title,
        vehicleModel: (c.vehicleModel as VehicleModel | "Multiple") || "Multiple",
        categories: c.categories,
        occurrenceCount: c.occurrenceCount,
        commonSymptoms: c.commonSymptoms,
        commonFixes: c.commonFixes,
        relatedInsightIds: c.relatedInsightIds,
      }))
    );

    await recordMetric({
      type: "patterns",
      usedGrok: useAi,
      issueCount: patterns.length,
    });

    return NextResponse.json({
      patterns,
      count: patterns.length,
      usedGrok: useAi,
    });
  } catch (err) {
    console.error("patterns error", err);
    const message =
      err instanceof Error ? err.message : "Failed to analyze patterns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
