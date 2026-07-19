import { NextRequest, NextResponse } from "next/server";
import { scheduleDiscordNotify } from "@/lib/discord";
import { filterComponentIssues } from "@/lib/issue-filter";
import { enrichVisit } from "@/lib/issue-group";
import { recordMetric } from "@/lib/metrics";
import {
  checkAndConsumeRateLimit,
  clientIpFromRequest,
} from "@/lib/rate-limit";
import {
  findInsightsByHashes,
  saveVisitsFromUpload,
} from "@/lib/store";
import type { ExtractedVisit, FixStatus, VehicleModel } from "@/lib/types";

export const runtime = "nodejs";

const FIX_STATUSES = new Set([
  "fixed",
  "no_fix_yet",
  "partial",
  "unknown",
]);

const MODELS = new Set([
  "Model S",
  "Model 3",
  "Model X",
  "Model Y",
  "Cybertruck",
  "Semi",
  "Unknown",
]);

/**
 * Publish user-confirmed draft issues after review.
 * Body: { visits: ExtractedVisit[], publishMeta: { pdfHash, contentHash, sourcePdfCount, pageCount } }
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req.headers);
    const publishQuota = await checkAndConsumeRateLimit({
      ip,
      kind: "publish",
      consume: true,
    });
    if (!publishQuota.allowed) {
      return NextResponse.json(
        {
          error: publishQuota.error,
          rateLimit: {
            remaining: publishQuota.remaining,
            limits: publishQuota.limits,
            retryAfterHours: publishQuota.retryAfterHours,
          },
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const visitsRaw = body?.visits;
    const meta = body?.publishMeta;

    if (!Array.isArray(visitsRaw) || visitsRaw.length === 0) {
      return NextResponse.json(
        { error: "Select at least one issue to publish." },
        { status: 400 }
      );
    }
    if (!meta?.pdfHash || !meta?.contentHash) {
      return NextResponse.json(
        { error: "Missing publish metadata. Re-analyze the PDF." },
        { status: 400 }
      );
    }

    // Dedupe: already published package
    const existing = await findInsightsByHashes({
      pdfHash: String(meta.pdfHash),
      contentHash: String(meta.contentHash),
    });
    if (existing.length > 0) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        insights: existing,
        meta: { issueCount: existing.length },
      });
    }

    if (visitsRaw.length > 15) {
      return NextResponse.json(
        { error: "Too many issues (max 15)." },
        { status: 400 }
      );
    }

    const visits: ExtractedVisit[] = [];
    for (const raw of visitsRaw) {
      const v = sanitizeVisit(raw);
      if (!v) {
        return NextResponse.json(
          { error: "Invalid issue data in review payload." },
          { status: 400 }
        );
      }
      visits.push(enrichVisit(v));
    }

    // Safety net: never publish tire wear / consumables even if user re-enables them
    const { kept } = filterComponentIssues(visits);
    if (kept.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nothing to publish after filtering routine wear items (tires, wipers, filters, etc.).",
        },
        { status: 400 }
      );
    }

    const insights = await saveVisitsFromUpload({
      visits: kept,
      pdfHash: String(meta.pdfHash),
      contentHash: String(meta.contentHash),
      sourcePdfCount: Number(meta.sourcePdfCount) || 1,
      pageCount: Number(meta.pageCount) || 0,
    });

    await recordMetric({
      type: "publish",
      issueCount: insights.length,
      skippedGrok: true,
      inputChars: Number(meta.inputChars) || undefined,
    });

    scheduleDiscordNotify({
      kind: "publish",
      issueCount: insights.length,
      models: insights.map((i) => i.vehicleModel),
      titles: insights.map((i) => i.title),
    });

    return NextResponse.json({
      ok: true,
      duplicate: false,
      insights,
      meta: { issueCount: insights.length },
    });
  } catch (err) {
    console.error("publish error", err);
    const message =
      err instanceof Error ? err.message : "Failed to publish insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function sanitizeVisit(raw: unknown): ExtractedVisit | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const title = String(r.title || "").trim().slice(0, 160);
  if (title.length < 3) return null;

  const vehicleModel = MODELS.has(String(r.vehicleModel))
    ? (String(r.vehicleModel) as VehicleModel)
    : "Unknown";

  const fixStatus = FIX_STATUSES.has(String(r.fixStatus))
    ? (String(r.fixStatus) as FixStatus)
    : "unknown";

  const visitTypeRaw = String(r.visitType || "unknown");
  const visitType = (
    ["warranty", "goodwill", "customer_pay", "unknown"] as const
  ).includes(visitTypeRaw as "warranty")
    ? (visitTypeRaw as ExtractedVisit["visitType"])
    : "unknown";

  const mileageBucket = String(r.mileageBucket || "Unknown") as ExtractedVisit["mileageBucket"];
  const allowedBuckets = new Set([
    "0-10k",
    "10-25k",
    "25-50k",
    "50-75k",
    "75-100k",
    "100k+",
    "Unknown",
  ]);
  const bucket = allowedBuckets.has(mileageBucket) ? mileageBucket : "Unknown";

  return {
    title,
    vehicleModel,
    modelYear:
      typeof r.modelYear === "number" && r.modelYear >= 2008 && r.modelYear <= 2035
        ? r.modelYear
        : null,
    mileageBucket: bucket as ExtractedVisit["mileageBucket"],
    categories: Array.isArray(r.categories)
      ? r.categories.map(String).slice(0, 6)
      : [],
    symptoms: String(r.symptoms || "").slice(0, 2000),
    diagnosis: String(r.diagnosis || "").slice(0, 2000),
    resolution: String(r.resolution || "").slice(0, 2000),
    partsReplaced: Array.isArray(r.partsReplaced)
      ? r.partsReplaced.map(String).slice(0, 15)
      : [],
    laborNotes: String(r.laborNotes || "").slice(0, 1000),
    redactedNotes: String(r.redactedNotes || "").slice(0, 2000),
    region: r.region == null ? null : String(r.region).slice(0, 80),
    visitType,
    confidence:
      typeof r.confidence === "number"
        ? Math.min(1, Math.max(0, r.confidence))
        : 0.7,
    issueSlug: String(r.issueSlug || "general_issue").slice(0, 80),
    fixStatus,
  };
}
