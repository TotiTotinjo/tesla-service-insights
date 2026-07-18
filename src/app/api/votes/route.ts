import { NextRequest, NextResponse } from "next/server";
import {
  BULLETIN_VOTE_MIN_OWNERS,
  canVoteForBulletin,
} from "@/lib/bulletin";
import { recordMetric } from "@/lib/metrics";
import { getIssueGroup } from "@/lib/store";
import { castBulletinVote, getVoteCounts, voterFingerprint } from "@/lib/votes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const keys = req.nextUrl.searchParams.get("keys");
  const issueKeys = keys ? keys.split(",").filter(Boolean) : undefined;
  const counts = await getVoteCounts(issueKeys);
  return NextResponse.json({
    votes: counts,
    minOwners: BULLETIN_VOTE_MIN_OWNERS,
  });
}

/** Vote: this issue should be a Service Bulletin (only if ownerCount > 1000) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const issueKey = String(body?.issueKey || "").trim();
    if (!issueKey || issueKey.length > 120) {
      return NextResponse.json({ error: "Invalid issueKey." }, { status: 400 });
    }

    const group = await getIssueGroup(issueKey);
    if (!group) {
      return NextResponse.json({ error: "Issue not found." }, { status: 404 });
    }

    if (!canVoteForBulletin(group.ownerCount)) {
      return NextResponse.json(
        {
          error: `Service Bulletin voting unlocks after more than ${BULLETIN_VOTE_MIN_OWNERS.toLocaleString()} owners report this issue (${group.ownerCount.toLocaleString()} so far).`,
          minOwners: BULLETIN_VOTE_MIN_OWNERS,
          ownerCount: group.ownerCount,
        },
        { status: 403 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const ua = req.headers.get("user-agent") || "";
    const voterKey = voterFingerprint(ip, ua);

    const result = await castBulletinVote({ issueKey, voterKey });
    if (!result.alreadyVoted) {
      await recordMetric({ type: "bulletin_vote", issueCount: 1 });
    }

    return NextResponse.json({
      ok: true,
      issueKey,
      count: result.count,
      alreadyVoted: result.alreadyVoted,
    });
  } catch (err) {
    console.error("vote error", err);
    return NextResponse.json({ error: "Vote failed" }, { status: 500 });
  }
}
