import {
  extractCanonicalTokens,
  stabilizeIssueSlug,
  tokenSimilarity,
} from "./normalize";
import type {
  ExtractedVisit,
  FixStatus,
  IssueGroup,
  ServiceInsight,
  VehicleModel,
} from "./types";

/** Normalize Grok / free-text slugs into a stable key fragment */
export function normalizeIssueSlug(raw: string): string {
  return stabilizeIssueSlug({ issueSlug: raw });
}

export function buildIssueKey(
  vehicleModel: string,
  issueSlug: string
): string {
  const model = vehicleModel
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  const slug = normalizeIssueSlug(issueSlug) || "general_issue";
  return `${model}::${slug}`;
}

/** Derive a slug when the model omits one — free, local + synonym map */
export function deriveIssueSlug(visit: {
  title: string;
  categories: string[];
  partsReplaced: string[];
  symptoms: string;
  issueSlug?: string;
}): string {
  return stabilizeIssueSlug({
    issueSlug: visit.issueSlug,
    title: visit.title,
    categories: visit.categories,
    partsReplaced: visit.partsReplaced,
    symptoms: visit.symptoms,
  });
}

const NO_FIX_RE =
  /\b(unable to replicate|could not replicate|no repair|not fixed|no fix|no action|monitor only|customer declined|open concern|unresolved|no fault found|ntf|no trouble found)\b/i;
const FIXED_RE =
  /\b(replaced|repaired|resolved|corrected|fixed|installed|retorqued|aligned|rebalanced|r\s*&\s*r)\b/i;

export function inferFixStatus(visit: {
  fixStatus?: FixStatus;
  resolution?: string;
  partsReplaced?: string[];
  diagnosis?: string;
}): FixStatus {
  if (
    visit.fixStatus === "fixed" ||
    visit.fixStatus === "no_fix_yet" ||
    visit.fixStatus === "partial" ||
    visit.fixStatus === "unknown"
  ) {
    if (
      visit.fixStatus === "fixed" &&
      NO_FIX_RE.test(visit.resolution || "")
    ) {
      return "no_fix_yet";
    }
    return visit.fixStatus;
  }

  const res = `${visit.resolution || ""} ${visit.diagnosis || ""}`;
  if (!res.trim() && (!visit.partsReplaced || visit.partsReplaced.length === 0)) {
    return "no_fix_yet";
  }
  if (NO_FIX_RE.test(res)) return "no_fix_yet";
  if (visit.partsReplaced?.length && FIXED_RE.test(res)) return "fixed";
  if (FIXED_RE.test(res)) return "fixed";
  if (visit.partsReplaced?.length) return "partial";
  return "unknown";
}

export function enrichVisit(visit: ExtractedVisit): ExtractedVisit & {
  issueSlug: string;
  issueKey: string;
  fixStatus: FixStatus;
} {
  const fixStatus = inferFixStatus(visit);
  const issueSlug = deriveIssueSlug(visit);
  const issueKey = buildIssueKey(visit.vehicleModel, issueSlug);
  return { ...visit, issueSlug, issueKey, fixStatus };
}

type GroupAcc = {
  issueKey: string;
  titles: string[];
  models: Set<string>;
  categories: Map<string, number>;
  ownerKeys: Set<string>;
  ids: string[];
  symptoms: string[];
  fixes: string[];
  parts: Map<string, number>;
  fixedCount: number;
  unfixedCount: number;
  statuses: FixStatus[];
  tokens: string[];
};

/**
 * Resolve issueKey, optionally merging into a similar existing group key
 * when token overlap is high (cross-owner fuzzy match, free).
 */
function resolveGroupKey(
  insight: ServiceInsight,
  existing: Map<string, GroupAcc>
): string {
  const slug = insight.issueSlug || deriveIssueSlug(insight);
  let issueKey = insight.issueKey || buildIssueKey(insight.vehicleModel, slug);
  const tokens = extractCanonicalTokens(
    insight.partsReplaced,
    insight.categories,
    insight.title,
    insight.symptoms,
    insight.issueSlug
  );

  // Fuzzy merge: same model family + high token overlap
  const modelPrefix = issueKey.split("::")[0];
  let bestKey: string | null = null;
  let bestScore = 0;
  for (const [key, g] of existing) {
    if (!key.startsWith(modelPrefix + "::")) continue;
    const score = tokenSimilarity(tokens, g.tokens);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  // Threshold: enough shared part/symptom identity
  if (bestKey && bestScore >= 0.45) {
    issueKey = bestKey;
  }

  return issueKey;
}

/** Aggregate individual reports into community issue groups (free, local). */
export function buildIssueGroups(
  insights: ServiceInsight[],
  voteCounts: Record<string, number> = {}
): IssueGroup[] {
  const map = new Map<string, GroupAcc>();

  for (const i of insights) {
    const issueKey = resolveGroupKey(i, map);
    const fix = i.fixStatus || inferFixStatus(i);
    const owner = i.ownerKey || i.pdfHash || i.contentHash || i.id;
    const tokens = extractCanonicalTokens(
      i.partsReplaced,
      i.categories,
      i.title,
      i.symptoms,
      i.issueSlug
    );

    let g = map.get(issueKey);
    if (!g) {
      g = {
        issueKey,
        titles: [],
        models: new Set(),
        categories: new Map(),
        ownerKeys: new Set(),
        ids: [],
        symptoms: [],
        fixes: [],
        parts: new Map(),
        fixedCount: 0,
        unfixedCount: 0,
        statuses: [],
        tokens: [],
      };
      map.set(issueKey, g);
    }

    // Grow token set for future fuzzy matches
    for (const t of tokens) {
      if (!g.tokens.includes(t)) g.tokens.push(t);
    }

    g.titles.push(i.title);
    g.models.add(i.vehicleModel);
    g.ownerKeys.add(owner);
    g.ids.push(i.id);
    g.symptoms.push(i.symptoms);
    if (i.resolution) g.fixes.push(i.resolution);
    g.statuses.push(fix);
    if (fix === "fixed") g.fixedCount += 1;
    if (fix === "no_fix_yet" || fix === "unknown") g.unfixedCount += 1;
    for (const c of i.categories) {
      g.categories.set(c, (g.categories.get(c) || 0) + 1);
    }
    for (const p of i.partsReplaced) {
      g.parts.set(p, (g.parts.get(p) || 0) + 1);
    }
  }

  return [...map.values()]
    .map((g) => {
      const models = [...g.models];
      const vehicleModel =
        models.length === 1
          ? (models[0] as VehicleModel)
          : ("Multiple" as const);

      const topCats = [...g.categories.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([n]) => n);

      const partsMentioned = [...g.parts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([n]) => n);

      const groupFix = groupFixStatus(g.statuses, g.fixedCount, g.unfixedCount);
      const ownerCount = g.ownerKeys.size;
      const bulletinVotes = voteCounts[g.issueKey] || 0;

      return {
        issueKey: g.issueKey,
        title: mostCommon(g.titles) || "Service issue",
        vehicleModel,
        categories: topCats,
        ownerCount,
        reportCount: g.ids.length,
        fixStatus: groupFix,
        fixSummary: fixSummaryText(
          groupFix,
          ownerCount,
          g.fixedCount,
          g.unfixedCount
        ),
        commonSymptoms: g.symptoms[0]?.slice(0, 400) || "",
        commonFixes:
          groupFix === "no_fix_yet"
            ? "No fix yet"
            : g.fixes.find((f) => FIXED_RE.test(f))?.slice(0, 400) ||
              g.fixes[0]?.slice(0, 400) ||
              "No fix yet",
        partsMentioned,
        relatedInsightIds: g.ids,
        fixedCount: g.fixedCount,
        unfixedCount: g.unfixedCount,
        bulletinVotes,
      } satisfies IssueGroup;
    })
    .sort(
      (a, b) =>
        b.ownerCount - a.ownerCount ||
        (b.bulletinVotes || 0) - (a.bulletinVotes || 0) ||
        b.reportCount - a.reportCount
    );
}

function mostCommon(items: string[]): string {
  const m = new Map<string, number>();
  for (const t of items) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function groupFixStatus(
  statuses: FixStatus[],
  fixed: number,
  unfixed: number
): FixStatus | "mixed" {
  if (statuses.length === 0) return "unknown";
  if (fixed > 0 && unfixed > 0) return "mixed";
  if (fixed > 0 && unfixed === 0) {
    if (statuses.every((s) => s === "fixed" || s === "partial")) {
      return statuses.some((s) => s === "partial") ? "partial" : "fixed";
    }
    return "fixed";
  }
  if (unfixed > 0 && fixed === 0) return "no_fix_yet";
  if (statuses.every((s) => s === "partial")) return "partial";
  return "unknown";
}

function fixSummaryText(
  status: FixStatus | "mixed",
  owners: number,
  fixed: number,
  unfixed: number
): string {
  const who =
    owners === 1
      ? "1 owner has reported this"
      : `${owners} owners have reported this`;
  switch (status) {
    case "fixed":
      return `${who} · Fixed`;
    case "no_fix_yet":
      return `${who} · No fix yet`;
    case "partial":
      return `${who} · Partially fixed`;
    case "mixed":
      return `${who} · ${fixed} fixed · ${unfixed} no fix yet`;
    default:
      return `${who} · Fix status unknown`;
  }
}

export function fixStatusLabel(status: FixStatus | "mixed"): string {
  switch (status) {
    case "fixed":
      return "Fixed";
    case "no_fix_yet":
      return "No fix yet";
    case "partial":
      return "Partially fixed";
    case "mixed":
      return "Mixed outcomes";
    default:
      return "Unknown";
  }
}
