import { randomUUID } from "crypto";
import { dataFile, readJsonFile, writeJsonFile } from "./fs-store";

const METRICS_FILE = dataFile("metrics.json");

export type MetricEvent = {
  id: string;
  at: string;
  type:
    | "upload_analyze"
    | "upload_duplicate"
    | "publish"
    | "bulletin_vote"
    | "patterns";
  issueCount?: number;
  skippedGrok?: boolean;
  inputChars?: number;
  usedGrok?: boolean;
  meta?: Record<string, string | number | boolean | null>;
};

type MetricsFile = {
  events: MetricEvent[];
  totals: {
    analyzes: number;
    publishes: number;
    duplicates: number;
    grokCalls: number;
    issuesPublished: number;
    bulletinVotes: number;
  };
};

const empty = (): MetricsFile => ({
  events: [],
  totals: {
    analyzes: 0,
    publishes: 0,
    duplicates: 0,
    grokCalls: 0,
    issuesPublished: 0,
    bulletinVotes: 0,
  },
});

export async function recordMetric(
  event: Omit<MetricEvent, "id" | "at">
): Promise<void> {
  try {
    const data = await readJsonFile<MetricsFile>(METRICS_FILE, empty());
    data.events.push({
      ...event,
      id: randomUUID(),
      at: new Date().toISOString(),
    });
    data.events = data.events.slice(-200);

    if (event.type === "upload_analyze") {
      data.totals.analyzes += 1;
      if (!event.skippedGrok) data.totals.grokCalls += 1;
    }
    if (event.type === "upload_duplicate") data.totals.duplicates += 1;
    if (event.type === "publish") {
      data.totals.publishes += 1;
      data.totals.issuesPublished += event.issueCount || 0;
    }
    if (event.type === "bulletin_vote") data.totals.bulletinVotes += 1;
    if (event.type === "patterns" && event.usedGrok) data.totals.grokCalls += 1;

    await writeJsonFile(METRICS_FILE, data);
  } catch (err) {
    console.error("metrics write failed", err);
  }
}

export async function getMetricsSummary() {
  const data = await readJsonFile<MetricsFile>(METRICS_FILE, empty());
  return {
    totals: data.totals,
    recent: data.events.slice(-20).reverse(),
  };
}
