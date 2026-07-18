import { createHash } from "crypto";
import { dataFile, readJsonFile, writeJsonFile } from "./fs-store";

const VOTES_FILE = dataFile("votes.json");

export type BulletinVoteRecord = {
  issueKey: string;
  count: number;
  voters: string[];
  updatedAt: string;
};

type VotesFile = {
  byIssue: Record<string, BulletinVoteRecord>;
};

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
  const data = await readJsonFile<VotesFile>(VOTES_FILE, { byIssue: {} });
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
  const data = await readJsonFile<VotesFile>(VOTES_FILE, { byIssue: {} });
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

  rec.voters = [...rec.voters.slice(-500), opts.voterKey];
  rec.count += 1;
  rec.updatedAt = new Date().toISOString();
  await writeJsonFile(VOTES_FILE, data);
  return { count: rec.count, alreadyVoted: false };
}
