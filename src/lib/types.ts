export type VehicleModel =
  | "Model S"
  | "Model 3"
  | "Model X"
  | "Model Y"
  | "Cybertruck"
  | "Semi"
  | "Unknown";

export type MileageBucket =
  | "0-10k"
  | "10-25k"
  | "25-50k"
  | "50-75k"
  | "75-100k"
  | "100k+"
  | "Unknown";

/** Whether this report's issue was resolved on that visit */
export type FixStatus = "fixed" | "no_fix_yet" | "partial" | "unknown";

export interface ServiceInsight {
  id: string;
  createdAt: string;
  /** Public title, e.g. "Model Y rattling suspension at highway speeds" */
  title: string;
  vehicleModel: VehicleModel;
  /** Model year only — never store full VIN */
  modelYear: number | null;
  mileageBucket: MileageBucket;
  /** High-level symptom category tags */
  categories: string[];
  symptoms: string;
  diagnosis: string;
  resolution: string;
  partsReplaced: string[];
  laborNotes: string;
  /** Fully redacted free-text notes from the invoice */
  redactedNotes: string;
  /** Optional broad region only (e.g. "US-Southwest"), never exact address */
  region: string | null;
  /** Whether the visit appears warranty / goodwill / customer-pay */
  visitType: "warranty" | "goodwill" | "customer_pay" | "unknown";
  /** Confidence 0–1 from extraction model */
  confidence: number;
  /** How many source PDFs were merged for this insight (default 1) */
  sourcePdfCount?: number;
  /** Total page count after merge, if known */
  pageCount?: number;
  /** SHA-256 of merged PDF bytes — exact-file dedupe (no PII) */
  pdfHash?: string;
  /** SHA-256 of normalized full invoice text — re-export dedupe (no PII) */
  contentHash?: string;
  /**
   * Stable issue family key for cross-owner grouping
   * (e.g. "model_y::front_control_arm_clunk")
   */
  issueKey?: string;
  /** Short slug from model: front_control_arm_clunk */
  issueSlug?: string;
  /** Anonymous owner fingerprint for this upload batch (1 per PDF package) */
  ownerKey?: string;
  /** All visits from one multi-visit PDF share this batch id */
  uploadBatchId?: string;
  /** Was this specific issue fixed on that visit? */
  fixStatus?: FixStatus;
}

/** Aggregated community view of the same issue across owners */
export interface IssueGroup {
  issueKey: string;
  title: string;
  vehicleModel: VehicleModel | "Multiple";
  categories: string[];
  /** Unique upload packages (anonymous owners) */
  ownerCount: number;
  /** Individual visit/report rows */
  reportCount: number;
  /** fixed | no_fix_yet | mixed | unknown */
  fixStatus: FixStatus | "mixed";
  fixSummary: string;
  commonSymptoms: string;
  commonFixes: string;
  partsMentioned: string[];
  relatedInsightIds: string[];
  fixedCount: number;
  unfixedCount: number;
  /** Community votes: “this should be a Service Bulletin” */
  bulletinVotes?: number;
}

export interface PatternCluster {
  id: string;
  title: string;
  vehicleModel: VehicleModel | "Multiple";
  categories: string[];
  occurrenceCount: number;
  commonSymptoms: string;
  commonFixes: string;
  relatedInsightIds: string[];
  updatedAt: string;
}

/** One visit / discrete issue extracted from an invoice */
export interface ExtractedVisit {
  title: string;
  vehicleModel: VehicleModel;
  modelYear: number | null;
  mileageBucket: MileageBucket;
  categories: string[];
  symptoms: string;
  diagnosis: string;
  resolution: string;
  partsReplaced: string[];
  laborNotes: string;
  redactedNotes: string;
  region: string | null;
  visitType: ServiceInsight["visitType"];
  confidence: number;
  /** Shared slug so same issue type groups across owners */
  issueSlug: string;
  fixStatus: FixStatus;
}

/** Draft visit returned by analyze — not yet public until publish */
export interface DraftVisit extends ExtractedVisit {
  /** Client-side id for review UI */
  draftId: string;
  issueKey: string;
  /** User can drop this row before publish */
  include?: boolean;
}

export interface AnalyzeUploadMeta {
  pdfHash: string;
  contentHash: string;
  sourcePdfCount: number;
  pageCount: number;
  inputChars: number;
}

/** @deprecated use ExtractedVisit — kept as alias for gradual migration */
export type ExtractedInvoice = ExtractedVisit;
