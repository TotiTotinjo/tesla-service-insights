import { randomUUID } from "crypto";
import { dataFile, readJsonFile, writeJsonFile } from "./fs-store";
import { buildIssueGroups, enrichVisit } from "./issue-group";
import { getVoteCounts } from "./votes";
import type {
  ExtractedVisit,
  IssueGroup,
  PatternCluster,
  ServiceInsight,
} from "./types";

const INSIGHTS_FILE = dataFile("insights.json");
const PATTERNS_FILE = dataFile("patterns.json");

async function ensureInsights(): Promise<ServiceInsight[]> {
  return readJsonFile<ServiceInsight[]>(INSIGHTS_FILE, []);
}

export async function listInsights(): Promise<ServiceInsight[]> {
  const items = await ensureInsights();
  return items.sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
  );
}

export async function getInsight(id: string): Promise<ServiceInsight | null> {
  const items = await listInsights();
  return items.find((i) => i.id === id) || null;
}

export async function listIssueGroups(): Promise<IssueGroup[]> {
  const items = await listInsights();
  const allVotes = await getVoteCounts();
  return buildIssueGroups(items, allVotes);
}

export async function getIssueGroup(
  issueKey: string
): Promise<IssueGroup | null> {
  const groups = await listIssueGroups();
  return groups.find((g) => g.issueKey === issueKey) || null;
}

export async function findInsightsByHashes(opts: {
  pdfHash?: string;
  contentHash?: string;
}): Promise<ServiceInsight[]> {
  const items = await listInsights();
  if (opts.pdfHash) {
    const byPdf = items.filter((i) => i.pdfHash && i.pdfHash === opts.pdfHash);
    if (byPdf.length > 0) return byPdf;
  }
  if (opts.contentHash) {
    const byText = items.filter(
      (i) => i.contentHash && i.contentHash === opts.contentHash
    );
    if (byText.length > 0) return byText;
  }
  return [];
}

export async function findInsightByHashes(opts: {
  pdfHash?: string;
  contentHash?: string;
}): Promise<ServiceInsight | null> {
  const list = await findInsightsByHashes(opts);
  return list[0] || null;
}

export async function findSimilarInsight(data: {
  title: string;
  vehicleModel: string;
  mileageBucket: string;
  symptoms: string;
  issueKey?: string;
  ownerKey?: string;
}): Promise<ServiceInsight | null> {
  const items = await listInsights();
  if (data.issueKey && data.ownerKey) {
    const same = items.find(
      (i) => i.issueKey === data.issueKey && i.ownerKey === data.ownerKey
    );
    if (same) return same;
  }
  const key = softDedupeKey(data);
  return items.find((i) => softDedupeKey(i) === key) || null;
}

function softDedupeKey(i: {
  title: string;
  vehicleModel: string;
  mileageBucket: string;
  symptoms: string;
}): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return [
    i.vehicleModel,
    i.mileageBucket,
    norm(i.title).slice(0, 80),
    norm(i.symptoms).slice(0, 160),
  ].join("|");
}

export async function saveInsight(
  data: Omit<ServiceInsight, "id" | "createdAt">
): Promise<ServiceInsight> {
  const items = await ensureInsights();
  const insight: ServiceInsight = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  items.push(insight);
  await writeJsonFile(INSIGHTS_FILE, items);
  return insight;
}

export async function saveVisitsFromUpload(opts: {
  visits: ExtractedVisit[];
  pdfHash: string;
  contentHash: string;
  sourcePdfCount: number;
  pageCount: number;
}): Promise<ServiceInsight[]> {
  const items = await ensureInsights();
  const batchId = randomUUID();
  const ownerKey = opts.contentHash || opts.pdfHash;
  const saved: ServiceInsight[] = [];
  const now = new Date().toISOString();

  for (const visit of opts.visits) {
    const enriched = enrichVisit(visit);

    const dup = items.find(
      (i) => i.ownerKey === ownerKey && i.issueKey === enriched.issueKey
    );
    if (dup) {
      saved.push(dup);
      continue;
    }

    const insight: ServiceInsight = {
      ...enriched,
      id: randomUUID(),
      createdAt: now,
      sourcePdfCount: opts.sourcePdfCount,
      pageCount: opts.pageCount,
      pdfHash: opts.pdfHash,
      contentHash: opts.contentHash,
      issueKey: enriched.issueKey,
      issueSlug: enriched.issueSlug,
      ownerKey,
      uploadBatchId: batchId,
      fixStatus: enriched.fixStatus,
    };
    items.push(insight);
    saved.push(insight);
  }

  await writeJsonFile(INSIGHTS_FILE, items);
  return saved;
}

export async function searchInsights(opts: {
  q?: string;
  model?: string;
  category?: string;
}): Promise<ServiceInsight[]> {
  let items = await listInsights();
  if (opts.model && opts.model !== "all") {
    items = items.filter((i) => i.vehicleModel === opts.model);
  }
  if (opts.category && opts.category !== "all") {
    const c = opts.category.toLowerCase();
    items = items.filter((i) =>
      i.categories.some((x) => x.toLowerCase().includes(c))
    );
  }
  if (opts.q?.trim()) {
    const q = opts.q.toLowerCase();
    items = items.filter((i) => {
      const hay = [
        i.title,
        i.symptoms,
        i.diagnosis,
        i.resolution,
        i.laborNotes,
        i.redactedNotes,
        i.issueSlug || "",
        ...i.partsReplaced,
        ...i.categories,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  return items;
}

export async function listPatterns(): Promise<PatternCluster[]> {
  return readJsonFile<PatternCluster[]>(PATTERNS_FILE, []);
}

export async function savePatterns(
  clusters: Omit<PatternCluster, "id" | "updatedAt">[]
): Promise<PatternCluster[]> {
  const saved: PatternCluster[] = clusters.map((c) => ({
    ...c,
    id: randomUUID(),
    updatedAt: new Date().toISOString(),
  }));
  await writeJsonFile(PATTERNS_FILE, saved);
  return saved;
}

export async function stats() {
  const items = await listInsights();
  const groups = await listIssueGroups();
  const byModel: Record<string, number> = {};
  const cats: Record<string, number> = {};
  for (const i of items) {
    byModel[i.vehicleModel] = (byModel[i.vehicleModel] || 0) + 1;
    for (const c of i.categories) {
      const k = c.toLowerCase();
      cats[k] = (cats[k] || 0) + 1;
    }
  }
  return {
    total: items.length,
    issueCount: groups.length,
    byModel,
    topCategories: Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
  };
}
