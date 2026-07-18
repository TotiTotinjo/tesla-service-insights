import { promises as fs } from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const VOTES_FILE = path.join(DATA_DIR, "votes.json");

export type BulletinVoteRecord = {
  issueKey: string;
  count: number;
  /** Hashed voter keys (IP+UA day bucket) to limit multi-votes */
  voters: string[];
  updatedAt: string;
};

type VotesFile = {
  byIssue: Record<string, BulletinVoteRecord>;
};

async function readVotes(): Promise<VotesFile> {
  try {
    const raw = await fs.readFile(VOTES_FILE, "utf8");
    return JSON.parse(raw) as VotesFile;
  } catch {
    return { byIssue: {} };
  }
}

async function writeVotes(data: VotesFile) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${VOTES_FILE}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, VOTES_FILE);
}

export function voterFingerprint(ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${day}|${ip}|${ua.slice(0, 80)}`)
    .digest("hex")
    .slice(0, 24);
}

export async function getVoteCounts(
  issueKeys?: string[]
): Promise<Record<string, number>> {
  const data = await readVotes();
  const out: Record<string, number> = {};
  const keys = issueKeys || Object.keys(data.byIssue);
  for (const k of keys) {
    out[k] = data.byIssue[k]?.count || 0;
  }
  return out;
}

export async function castBulletinVote(opts: {
  issueKey: string;
  voterKey: string;
}): Promise<{ count: number; alreadyVoted: boolean }> {
  const data = await readVotes();
  const key = opts.issueKey;
  let rec = data.byIssue[key];
  if (!rec) {
    rec = {
      issueKey: key,
      count: 0,
      voters: [],
      updatedAt: new Date().toISOString(),
    };
    data.byIssue[key] = rec;
  }

  if (rec.voters.includes(opts.voterKey)) {
    return { count: rec.count, alreadyVoted: true };
  }

  // Cap stored voter fingerprints
  rec.voters = [...rec.voters.slice(-500), opts.voterKey];
  rec.count += 1;
  rec.updatedAt = new Date().toISOString();
  await writeVotes(data);
  return { count: rec.count, alreadyVoted: false };
}
