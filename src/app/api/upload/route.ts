import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashInvoiceText, hashPdfBuffer } from "@/lib/content-hash";
import {
  extractTextFromPdf,
  extractVisitsFromText,
  toPdfBytes,
} from "@/lib/extract";
import { buildIssueGroups, enrichVisit } from "@/lib/issue-group";
import { scheduleDiscordNotify } from "@/lib/discord";
import { recordMetric } from "@/lib/metrics";
import { mergePdfBuffers } from "@/lib/pdf-merge";
import {
  checkAndConsumeRateLimit,
  clientIpFromRequest,
} from "@/lib/rate-limit";
import { findInsightsByHashes } from "@/lib/store";
import type { DraftVisit } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES_PER_FILE = 12 * 1024 * 1024;
const MAX_BYTES_TOTAL = 40 * 1024 * 1024;
const MAX_PDF_COUNT = 10;

/**
 * Analyze only — does NOT publish.
 * Returns draft issues for user review, then client calls /api/publish.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.XAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "Server is missing XAI_API_KEY. Copy .env.example to .env.local and add your key from https://console.x.ai",
        },
        { status: 503 }
      );
    }

    const ip = clientIpFromRequest(req.headers);
    // Soft pre-check (no consume) so we fail fast when daily caps are exhausted
    const pre = await checkAndConsumeRateLimit({
      ip,
      kind: "analyze",
      consume: false,
    });
    if (!pre.allowed) {
      return NextResponse.json(
        {
          error: pre.error,
          rateLimit: {
            remaining: pre.remaining,
            limits: pre.limits,
            retryAfterHours: pre.retryAfterHours,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(pre.retryAfterHours * 3600),
          },
        }
      );
    }

    const form = await req.formData();
    const files = collectPdfFiles(form);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Select at least one PDF invoice." },
        { status: 400 }
      );
    }

    if (files.length > MAX_PDF_COUNT) {
      return NextResponse.json(
        { error: `Too many PDFs (max ${MAX_PDF_COUNT} per upload).` },
        { status: 400 }
      );
    }

    let totalSize = 0;
    const buffers: Uint8Array[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!isPdf(file)) {
        return NextResponse.json(
          { error: "Only PDF invoices are supported." },
          { status: 400 }
        );
      }
      if (file.size > MAX_BYTES_PER_FILE) {
        return NextResponse.json(
          {
            error: `PDF #${i + 1} is too large (max ${MAX_BYTES_PER_FILE / (1024 * 1024)} MB per file).`,
          },
          { status: 400 }
        );
      }
      totalSize += file.size;
      if (totalSize > MAX_BYTES_TOTAL) {
        return NextResponse.json(
          {
            error: `Combined upload too large (max ${MAX_BYTES_TOTAL / (1024 * 1024)} MB total).`,
          },
          { status: 400 }
        );
      }
      // Pure Uint8Array — required by unpdf/pdf.js on Cloudflare Workers
      buffers.push(toPdfBytes(await file.arrayBuffer()));
    }

    const { buffer: pdfBuffer, pageCount } = await mergePdfBuffers(buffers);
    const pdfHash = hashPdfBuffer(pdfBuffer);

    const byPdf = await findInsightsByHashes({ pdfHash });
    if (byPdf.length > 0) {
      await recordMetric({
        type: "upload_duplicate",
        issueCount: byPdf.length,
        skippedGrok: true,
      });
      scheduleDiscordNotify({
        kind: "duplicate",
        issueCount: byPdf.length,
        match: "pdf",
      });
      return NextResponse.json({
        ok: true,
        duplicate: true,
        needsReview: false,
        insights: byPdf,
        drafts: [],
        issueGroups: buildIssueGroups(byPdf),
        privacy: {
          originalStored: false,
          message:
            "Duplicate PDF detected. No Grok call; existing published issues returned.",
        },
        meta: {
          pdfCount: files.length,
          merged: files.length > 1,
          pageCount,
          issueCount: byPdf.length,
          skippedGrok: true,
          match: "pdf",
        },
      });
    }

    const text = await extractTextFromPdf(pdfBuffer);
    if (!text.trim()) {
      return NextResponse.json(
        {
          error:
            "Could not extract text from this PDF. It may be a scanned image. Please upload a text-based PDF export from your Tesla account or service history.",
        },
        { status: 422 }
      );
    }

    const contentHash = hashInvoiceText(text);
    const byText = await findInsightsByHashes({ contentHash });
    if (byText.length > 0) {
      await recordMetric({
        type: "upload_duplicate",
        issueCount: byText.length,
        skippedGrok: true,
      });
      scheduleDiscordNotify({
        kind: "duplicate",
        issueCount: byText.length,
        match: "text",
      });
      return NextResponse.json({
        ok: true,
        duplicate: true,
        needsReview: false,
        insights: byText,
        drafts: [],
        issueGroups: buildIssueGroups(byText),
        privacy: {
          originalStored: false,
          message:
            "This invoice was already published. No Grok call; existing issues returned.",
        },
        meta: {
          pdfCount: files.length,
          merged: files.length > 1,
          pageCount,
          issueCount: byText.length,
          skippedGrok: true,
          match: "text",
        },
      });
    }

    // Consume quota only when we are about to call Grok (duplicates are free)
    const quota = await checkAndConsumeRateLimit({
      ip,
      kind: "analyze",
      consume: true,
    });
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: quota.error,
          rateLimit: {
            remaining: quota.remaining,
            limits: quota.limits,
            retryAfterHours: quota.retryAfterHours,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(quota.retryAfterHours * 3600),
          },
        }
      );
    }

    // Grok extract — drafts only (not saved until /api/publish)
    const visits = await extractVisitsFromText(text);
    const drafts: DraftVisit[] = visits.map((v) => {
      const enriched = enrichVisit(v);
      return {
        ...enriched,
        draftId: randomUUID(),
        include: true,
      };
    });

    await recordMetric({
      type: "upload_analyze",
      issueCount: drafts.length,
      skippedGrok: false,
      inputChars: text.length,
    });

    scheduleDiscordNotify({
      kind: "analyze",
      issueCount: drafts.length,
      models: drafts.map((d) => d.vehicleModel),
      pageCount,
      pdfCount: files.length,
      titles: drafts.map((d) => d.title),
    });

    return NextResponse.json({
      ok: true,
      duplicate: false,
      needsReview: true,
      drafts,
      insights: [],
      privacy: {
        originalStored: false,
        message:
          "Review the issues below, then publish. Nothing is public until you confirm.",
      },
      publishMeta: {
        pdfHash,
        contentHash,
        sourcePdfCount: files.length,
        pageCount,
        inputChars: text.length,
      },
      meta: {
        pdfCount: files.length,
        merged: files.length > 1,
        pageCount,
        issueCount: drafts.length,
        skippedGrok: false,
      },
      rateLimit: {
        remaining: quota.remaining,
        limits: quota.limits,
      },
    });
  } catch (err) {
    console.error("upload error", err);
    const message =
      err instanceof Error ? err.message : "Failed to process upload";
    const status = /Could not read PDF/i.test(message) ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function collectPdfFiles(form: FormData): File[] {
  const multi = form.getAll("files").filter((v): v is File => v instanceof File);
  if (multi.length > 0) return multi;
  const single = form.get("file");
  if (single instanceof File) return [single];
  return [];
}

function isPdf(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  if (mime === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}
