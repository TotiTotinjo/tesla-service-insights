/**
 * Tiny JSON store that works on Node (disk) and Cloudflare Workers (memory).
 * On Workers the filesystem is not durable — memory resets on cold starts.
 * Good enough for early beta; migrate to D1/KV later.
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

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  // Memory first (Workers + keeps consistency within isolate)
  const cached = mem().get(file);
  if (cached != null) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      /* fall through */
    }
  }

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

  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, raw, "utf8");
    await fs.rename(tmp, file);
  } catch {
    // Cloudflare / read-only FS — memory map is the store for this isolate
  }
}
