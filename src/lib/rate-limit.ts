import { promises as fs } from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";

/**
 * Early-beta upload / Grok cost caps.
 * Defaults are intentionally tight so strangers cannot burn your API budget.
 *
 * Override via env:
 *   BETA_MAX_ANALYZES_PER_IP_PER_DAY   (default 3)
 *   BETA_MAX_ANALYZES_GLOBAL_PER_DAY   (default 40)
 *   BETA_MAX_PUBLISHES_PER_IP_PER_DAY  (default 5)
 *   BETA_RATE_LIMIT_DISABLED=true      (local override only — never in prod)
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "rate-limits.json");

export type RateLimitKind = "analyze" | "publish";

type DayBucket = {
  /** UTC date YYYY-MM-DD */
  day: string;
  globalAnalyzes: number;
  globalPublishes: number;
  byIp: Record<
    string,
    {
      analyzes: number;
      publishes: number;
    }
  >;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function numEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getRateLimitConfig() {
  return {
    maxAnalyzesPerIpPerDay: numEnv("BETA_MAX_ANALYZES_PER_IP_PER_DAY", 3),
    maxAnalyzesGlobalPerDay: numEnv("BETA_MAX_ANALYZES_GLOBAL_PER_DAY", 40),
    maxPublishesPerIpPerDay: numEnv("BETA_MAX_PUBLISHES_PER_IP_PER_DAY", 5),
    disabled: process.env.BETA_RATE_LIMIT_DISABLED === "true",
  };
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip || "unknown").digest("hex").slice(0, 20);
}

async function readBucket(): Promise<DayBucket> {
  const day = todayUtc();
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const data = JSON.parse(raw) as DayBucket;
    if (data.day === day) return data;
  } catch {
    /* reset */
  }
  return { day, globalAnalyzes: 0, globalPublishes: 0, byIp: {} };
}

async function writeBucket(data: DayBucket): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

export type RateLimitResult =
  | {
      allowed: true;
      remaining: {
        ipAnalyzes: number;
        globalAnalyzes: number;
        ipPublishes: number;
      };
      limits: ReturnType<typeof getRateLimitConfig>;
    }
  | {
      allowed: false;
      status: 429;
      error: string;
      retryAfterHours: number;
      limits: ReturnType<typeof getRateLimitConfig>;
      remaining: {
        ipAnalyzes: number;
        globalAnalyzes: number;
        ipPublishes: number;
      };
    };

function remainingFrom(
  data: DayBucket,
  ipHash: string,
  cfg: ReturnType<typeof getRateLimitConfig>
) {
  const ip = data.byIp[ipHash] || { analyzes: 0, publishes: 0 };
  return {
    ipAnalyzes: Math.max(0, cfg.maxAnalyzesPerIpPerDay - ip.analyzes),
    globalAnalyzes: Math.max(
      0,
      cfg.maxAnalyzesGlobalPerDay - data.globalAnalyzes
    ),
    ipPublishes: Math.max(0, cfg.maxPublishesPerIpPerDay - ip.publishes),
  };
}

/** Check + optionally consume a quota unit. */
export async function checkAndConsumeRateLimit(opts: {
  ip: string;
  kind: RateLimitKind;
  /** If false, only check without incrementing */
  consume?: boolean;
}): Promise<RateLimitResult> {
  const cfg = getRateLimitConfig();
  const ipHash = hashIp(opts.ip);
  const consume = opts.consume !== false;

  if (cfg.disabled) {
    return {
      allowed: true,
      remaining: {
        ipAnalyzes: 999,
        globalAnalyzes: 999,
        ipPublishes: 999,
      },
      limits: cfg,
    };
  }

  const data = await readBucket();
  if (!data.byIp[ipHash]) {
    data.byIp[ipHash] = { analyzes: 0, publishes: 0 };
  }
  const ip = data.byIp[ipHash];
  const remaining = remainingFrom(data, ipHash, cfg);

  if (opts.kind === "analyze") {
    if (ip.analyzes >= cfg.maxAnalyzesPerIpPerDay) {
      return {
        allowed: false,
        status: 429,
        error: `Early beta limit: max ${cfg.maxAnalyzesPerIpPerDay} invoice analyses per IP per day. Try again tomorrow (UTC).`,
        retryAfterHours: hoursUntilUtcMidnight(),
        limits: cfg,
        remaining,
      };
    }
    if (data.globalAnalyzes >= cfg.maxAnalyzesGlobalPerDay) {
      return {
        allowed: false,
        status: 429,
        error: `Early beta global cap reached (${cfg.maxAnalyzesGlobalPerDay} analyses today). This protects API costs — try again tomorrow (UTC).`,
        retryAfterHours: hoursUntilUtcMidnight(),
        limits: cfg,
        remaining,
      };
    }
    if (consume) {
      ip.analyzes += 1;
      data.globalAnalyzes += 1;
      await writeBucket(data);
    }
  } else {
    if (ip.publishes >= cfg.maxPublishesPerIpPerDay) {
      return {
        allowed: false,
        status: 429,
        error: `Early beta limit: max ${cfg.maxPublishesPerIpPerDay} publishes per IP per day.`,
        retryAfterHours: hoursUntilUtcMidnight(),
        limits: cfg,
        remaining,
      };
    }
    if (consume) {
      ip.publishes += 1;
      data.globalPublishes += 1;
      await writeBucket(data);
    }
  }

  return {
    allowed: true,
    remaining: remainingFrom(data, ipHash, cfg),
    limits: cfg,
  };
}

function hoursUntilUtcMidnight(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 3600000));
}

export function clientIpFromRequest(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
