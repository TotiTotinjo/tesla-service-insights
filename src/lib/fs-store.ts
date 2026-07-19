/**
 * Durable JSON store:
 * - Cloudflare Workers: Cloudflare KV (ROINSIGHTS_DATA binding)
 * - Local Node: filesystem under data/
 *
 * Why insights vanished: without KV, Workers only had in-memory storage,
 * which is wiped on cold starts / new isolates / refresh after idle.
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

type MemoryMap = Map<string, string>;

declare global {
  // eslint-disable-next-line no-var
  var __TSI_JSON_MEMORY__: MemoryMap | undefined;
}

function mem(): MemoryMap {
  if (!globalThis.__TSI_JSON_MEMORY__) {
    globalThis.__TSI_JSON_MEMORY__ = new Map();
  }
  return globalThis.__TSI_JSON_MEMORY__;
}

export function dataFile(name: string): string {
  return path.join(process.cwd(), "data", name);
}

/** Map absolute/local path to a stable KV key */
function kvKey(file: string): string {
  const base = path.basename(file);
  return `json:${base}`;
}

type KvLike = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
};

let cachedKv: KvLike | null | undefined;

async function getKv(): Promise<KvLike | null> {
  if (cachedKv !== undefined) return cachedKv;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx?.env as { ROINSIGHTS_DATA?: KvLike } | undefined;
    cachedKv = env?.ROINSIGHTS_DATA ?? null;
    return cachedKv;
  } catch {
    cachedKv = null;
    return null;
  }
}

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  const key = kvKey(file);

  // Prefer KV in production (durable across requests/isolates)
  const kv = await getKv();
  if (kv) {
    try {
      const raw = await kv.get(key);
      if (raw != null) {
        mem().set(file, raw);
        return JSON.parse(raw) as T;
      }
      // cold empty KV — fall through to empty default (don't use stale mem from other key)
      return fallback;
    } catch (err) {
      console.error("KV read failed", key, err);
    }
  }

  // Local in-process cache (same isolate)
  const cached = mem().get(file);
  if (cached != null) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      /* fall through */
    }
  }

  // Local filesystem (Node / npm run dev)
  try {
    const raw = await fs.readFile(file, "utf8");
    mem().set(file, raw);
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(file: string, data: unknown): Promise<void> {
  const raw = JSON.stringify(data, null, 2);
  mem().set(file, raw);
  const key = kvKey(file);

  const kv = await getKv();
  if (kv) {
    try {
      await kv.put(key, raw);
      return;
    } catch (err) {
      console.error("KV write failed", key, err);
      // fall through to disk attempt
    }
  }

  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, raw, "utf8");
    await fs.rename(tmp, file);
  } catch {
    // Local FS unavailable — memory only for this isolate
  }
}
