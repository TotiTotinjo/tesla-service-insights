import { z } from "zod";
import { compactInvoiceForModel } from "./content-hash";
import { filterComponentIssues } from "./issue-filter";
import { enrichVisit } from "./issue-group";
import { getExtractModel, grokChat } from "./grok";
import { redactPii, scrubInsightStrings, stillLooksLikePii } from "./redact";
import type { ExtractedVisit } from "./types";

const VisitSchema = z.object({
  title: z.string().min(3).max(160),
  vehicleModel: z.enum([
    "Model S",
    "Model 3",
    "Model X",
    "Model Y",
    "Cybertruck",
    "Semi",
    "Unknown",
  ]),
  modelYear: z.number().int().min(2008).max(2035).nullable(),
  mileageBucket: z.enum([
    "0-10k",
    "10-25k",
    "25-50k",
    "50-75k",
    "75-100k",
    "100k+",
    "Unknown",
  ]),
  categories: z.array(z.string()).max(6),
  symptoms: z.string(),
  diagnosis: z.string(),
  resolution: z.string(),
  partsReplaced: z.array(z.string()).max(15),
  laborNotes: z.string(),
  redactedNotes: z.string(),
  region: z.string().nullable(),
  visitType: z.enum(["warranty", "goodwill", "customer_pay", "unknown"]),
  confidence: z.number().min(0).max(1),
  issueSlug: z.string().min(2).max(80),
  fixStatus: z.enum(["fixed", "no_fix_yet", "partial", "unknown"]),
});

/**
 * Multi-visit extraction. One PDF may contain many service visits —
 * return a SEPARATE object per discrete issue/visit so community can count owners per issue.
 * Keep strings short to control cost.
 */
const SYSTEM = `Tesla multi-visit service invoice → JSON only. No markdown. No PII (names, phones, emails, VIN, addresses, RO/invoice #s, payment).

CRITICAL: Split into SEPARATE issues — one object per distinct service concern/visit (e.g. control-arm noise is NOT the same as HVAC squeak). Max 15 issues. Same underlying issue type across visits → reuse the SAME issueSlug.

SCOPE — INCLUDE only real vehicle systems:
- Suspension, chassis, bearings, motors, battery, high/low voltage electrical, charge port, HVAC (fan/compressor/module), doors/handles/regulators, displays, cameras/Autopilot, leaks, software/module faults, structural noise/vibration from components.

SCOPE — EXCLUDE (do not output these as issues):
- Tire/tyre wear, tread, puncture, rotation, rebalance, TPMS pressure-only, wheel weights
- Wiper blades, washer fluid
- Cabin/air filters, routine fluid top-offs
- Pure cosmetic detailing / cleaning
These are consumables/maintenance, not component defects.

issueSlug: stable snake_case type key for community matching (e.g. front_control_arm_clunk, charge_port_door_fail, hvac_fan_squeak). Same problem type = same slug across owners.

fixStatus: fixed | no_fix_yet | partial | unknown
- fixed = part replaced/repair confirmed
- no_fix_yet = open, unable to replicate, no repair, monitor
- partial = partial work or temporary
- unknown = unclear

Mileage: 0-10k|10-25k|25-50k|50-75k|75-100k|100k+|Unknown
visitType: warranty|goodwill|customer_pay|unknown
Keep symptoms/diagnosis/resolution ≤2 short sentences; redactedNotes ≤200 chars.

Schema:
{"issues":[{"title":"","vehicleModel":"Model Y","modelYear":2024,"mileageBucket":"0-10k","categories":["suspension"],"symptoms":"","diagnosis":"","resolution":"","partsReplaced":[],"laborNotes":"","redactedNotes":"","region":null,"visitType":"warranty","confidence":0.9,"issueSlug":"front_control_arm_clunk","fixStatus":"fixed"}]}`;

const MAX_DOC_CHARS = Number(process.env.MAX_INVOICE_CHARS || 18000);
const MAX_COMPLETION_TOKENS = Number(process.env.XAI_MAX_TOKENS || 3500);

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  // Prefer object with issues array
  const startObj = raw.indexOf("{");
  const endObj = raw.lastIndexOf("}");
  if (startObj !== -1 && endObj > startObj) {
    try {
      return JSON.parse(raw.slice(startObj, endObj + 1));
    } catch {
      /* fall through */
    }
  }
  const startArr = raw.indexOf("[");
  const endArr = raw.lastIndexOf("]");
  if (startArr !== -1 && endArr > startArr) {
    return { issues: JSON.parse(raw.slice(startArr, endArr + 1)) };
  }
  throw new Error("Model did not return JSON");
}

function finalizeVisit(raw: unknown): ExtractedVisit {
  const scrubbed = scrubInsightStrings(
    raw as Record<string, unknown>
  ) as z.infer<typeof VisitSchema>;
  // Tolerant defaults for optional-ish fields
  if (!scrubbed.issueSlug) {
    (scrubbed as { issueSlug: string }).issueSlug = "general_issue";
  }
  if (!scrubbed.fixStatus) {
    (scrubbed as { fixStatus: string }).fixStatus = "unknown";
  }
  const data = VisitSchema.parse(scrubbed);

  const blob = [
    data.title,
    data.symptoms,
    data.diagnosis,
    data.resolution,
    data.laborNotes,
    data.redactedNotes,
    ...data.partsReplaced,
  ].join("\n");

  let visit: ExtractedVisit = data;
  if (stillLooksLikePii(blob)) {
    const hard = scrubInsightStrings(data) as ExtractedVisit;
    visit = {
      ...hard,
      redactedNotes: redactPii(hard.redactedNotes),
      symptoms: redactPii(hard.symptoms),
      diagnosis: redactPii(hard.diagnosis),
      resolution: redactPii(hard.resolution),
      laborNotes: redactPii(hard.laborNotes),
      confidence: Math.min(hard.confidence, 0.7),
    };
  }

  const enriched = enrichVisit(visit);
  return {
    ...enriched,
    issueSlug: enriched.issueSlug,
    fixStatus: enriched.fixStatus,
  };
}

/**
 * Extract one or more discrete issues/visits from invoice text.
 * Always returns an array (length >= 1 on success).
 */
export async function extractVisitsFromText(
  rawText: string
): Promise<ExtractedVisit[]> {
  const preRedacted = redactPii(rawText);
  const compact = compactInvoiceForModel(preRedacted, MAX_DOC_CHARS);

  const user = `Split this redacted Tesla service document into separate issues (one per visit/concern). Return {"issues":[...]}.\n\n${compact}`;

  const reply = await grokChat({
    system: SYSTEM,
    user,
    temperature: 0.1,
    maxTokens: MAX_COMPLETION_TOKENS,
    model: getExtractModel(),
  });

  const parsed = parseJsonLoose(reply) as {
    issues?: unknown[];
  } & Record<string, unknown>;

  let list: unknown[] = [];
  if (Array.isArray(parsed.issues)) {
    list = parsed.issues;
  } else if (Array.isArray(parsed)) {
    list = parsed as unknown[];
  } else if (parsed.title || parsed.symptoms) {
    // Model returned a single object
    list = [parsed];
  }

  if (list.length === 0) {
    throw new Error("No issues extracted from invoice");
  }

  // Cap to 15, then drop consumables (tires, wipers, filters, etc.)
  const finalized = list.slice(0, 15).map((item) => finalizeVisit(item));
  const { kept } = filterComponentIssues(finalized);
  if (kept.length === 0) {
    throw new Error(
      "No component/electrical issues found — only routine wear items (e.g. tires, wipers, filters) were on this invoice."
    );
  }
  return kept;
}

/** @deprecated prefer extractVisitsFromText */
export async function extractFromText(
  rawText: string
): Promise<ExtractedVisit> {
  const visits = await extractVisitsFromText(rawText);
  return visits[0];
}

/** Cloudflare/pdf.js reject Node Buffer — always pass a pure Uint8Array copy. */
export function toPdfBytes(
  input: Buffer | Uint8Array | ArrayBuffer | ArrayBufferView
): Uint8Array {
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input.slice(0));
  }
  // Buffer is a Uint8Array subclass in Node; pdf.js still rejects it by name.
  // Copy into a fresh Uint8Array so the prototype is exactly Uint8Array.
  const view = input as ArrayBufferView;
  return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
}

/**
 * Extract text from a PDF buffer.
 * Uses `unpdf` (pdf.js serverless) so it works on Cloudflare Workers
 * without DOM APIs like DOMMatrix that break `pdf-parse`.
 */
export async function extractTextFromPdf(
  buffer: Buffer | Uint8Array
): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const data = toPdfBytes(buffer);
  const pdf = await getDocumentProxy(data);
  const result = await extractText(pdf, { mergePages: true });
  const text = result.text as string | string[] | undefined;
  if (typeof text === "string") return text;
  if (Array.isArray(text)) return text.join("\n\n");
  return "";
}

export type PatternInput = {
  id: string;
  title: string;
  vehicleModel: string;
  categories: string[];
  symptoms: string;
  diagnosis: string;
  resolution: string;
  partsReplaced: string[];
  issueKey?: string;
  issueSlug?: string;
  fixStatus?: string;
};

export type PatternResult = {
  title: string;
  vehicleModel: string;
  categories: string[];
  occurrenceCount: number;
  commonSymptoms: string;
  commonFixes: string;
  relatedInsightIds: string[];
};

/**
 * Local clustering by issueKey / category — $0 tokens.
 */
export function heuristicClusters(insights: PatternInput[]): PatternResult[] {
  const map = new Map<
    string,
    {
      title: string;
      vehicleModel: string;
      categories: string[];
      ids: string[];
      symptoms: string[];
      fixes: string[];
    }
  >();

  for (const i of insights) {
    const key =
      i.issueKey ||
      `${i.vehicleModel}::${(i.categories[0] || i.issueSlug || "general").toLowerCase()}`;
    const cur = map.get(key) || {
      title: i.title || `${i.vehicleModel} — ${i.categories[0] || "issue"}`,
      vehicleModel: i.vehicleModel,
      categories: i.categories.slice(0, 3),
      ids: [] as string[],
      symptoms: [] as string[],
      fixes: [] as string[],
    };
    cur.ids.push(i.id);
    cur.symptoms.push(i.symptoms);
    cur.fixes.push(i.resolution);
    map.set(key, cur);
  }

  return [...map.values()]
    .filter((c) => c.ids.length >= 1)
    .sort((a, b) => b.ids.length - a.ids.length)
    .slice(0, 12)
    .map((c) => ({
      title: c.title,
      vehicleModel: c.vehicleModel,
      categories: c.categories,
      occurrenceCount: c.ids.length,
      commonSymptoms: c.symptoms[0]?.slice(0, 500) || "",
      commonFixes: c.fixes[0]?.slice(0, 500) || "No fix yet",
      relatedInsightIds: c.ids,
    }));
}

export async function analyzePatterns(
  insights: PatternInput[]
): Promise<PatternResult[]> {
  if (insights.length === 0) return [];

  const compact = insights.slice(0, 40).map((i) => ({
    id: i.id,
    t: i.title.slice(0, 80),
    m: i.vehicleModel,
    k: i.issueKey || i.issueSlug,
    c: i.categories.slice(0, 3),
    s: i.symptoms.slice(0, 120),
    f: i.resolution.slice(0, 120),
    p: i.partsReplaced.slice(0, 5),
  }));

  const system = `Cluster Tesla service issues by same underlying problem. JSON array only, max 10:
[{"title":"","vehicleModel":"Model Y","categories":[],"occurrenceCount":1,"commonSymptoms":"","commonFixes":"","relatedInsightIds":[]}]
No PII. If no fix known use commonFixes:"No fix yet".`;

  try {
    const reply = await grokChat({
      system,
      user: JSON.stringify(compact),
      temperature: 0.2,
      maxTokens: 1200,
      model: getExtractModel(),
    });
    const parsed = parseJsonLoose(
      reply.startsWith("[") ? `{"issues":${reply}}` : reply
    ) as { issues?: unknown[]; items?: unknown[] } | unknown[];

    let items: unknown[] = [];
    if (Array.isArray(parsed)) items = parsed;
    else if (Array.isArray((parsed as { issues?: unknown[] }).issues))
      items = (parsed as { issues: unknown[] }).issues;
    else if (Array.isArray((parsed as { items?: unknown[] }).items))
      items = (parsed as { items: unknown[] }).items;

    if (items.length === 0) return heuristicClusters(insights);

    return (items as Record<string, unknown>[]).map((c) => ({
      title: String(c.title || "Pattern"),
      vehicleModel: String(c.vehicleModel || "Multiple"),
      categories: Array.isArray(c.categories) ? c.categories.map(String) : [],
      occurrenceCount: Number(c.occurrenceCount) || 1,
      commonSymptoms: String(c.commonSymptoms || ""),
      commonFixes: String(c.commonFixes || "No fix yet"),
      relatedInsightIds: Array.isArray(c.relatedInsightIds)
        ? c.relatedInsightIds.map(String)
        : [],
    }));
  } catch {
    return heuristicClusters(insights);
  }
}
