import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const METRICS_FILE = path.join(DATA_DIR, "metrics.json");

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

async function readMetrics(): Promise<MetricsFile> {
  try {
    const raw = await fs.readFile(METRICS_FILE, "utf8");
    return JSON.parse(raw) as MetricsFile;
  } catch {
    return {
      events: [],
      totals: {
        analyzes: 0,
        publishes: 0,
        duplicates: 0,
        grokCalls: 0,
        issuesPublished: 0,
        bulletinVotes: 0,
      },
    };
  }
}

async function writeMetrics(data: MetricsFile) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${METRICS_FILE}.${randomUUID()}.tmp`;
  // Keep last 200 events only
  data.events = data.events.slice(-200);
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, METRICS_FILE);
}

export async function recordMetric(
  event: Omit<MetricEvent, "id" | "at">
): Promise<void> {
  try {
    const data = await readMetrics();
    data.events.push({
      ...event,
      id: randomUUID(),
      at: new Date().toISOString(),
    });

    if (event.type === "upload_analyze") {
      data.totals.analyzes += 1;
      if (!event.skippedGrok) data.totals.grokCalls += 1;
    }
    if (event.type === "upload_duplicate") {
      data.totals.duplicates += 1;
    }
    if (event.type === "publish") {
      data.totals.publishes += 1;
      data.totals.issuesPublished += event.issueCount || 0;
    }
    if (event.type === "bulletin_vote") {
      data.totals.bulletinVotes += 1;
    }
    if (event.type === "patterns" && event.usedGrok) {
      data.totals.grokCalls += 1;
    }

    await writeMetrics(data);
  } catch (err) {
    console.error("metrics write failed", err);
  }
}

export async function getMetricsSummary() {
  const data = await readMetrics();
  return {
    totals: data.totals,
    recent: data.events.slice(-20).reverse(),
  };
}
