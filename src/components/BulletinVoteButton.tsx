"use client";

import { useState } from "react";
import {
  BULLETIN_VOTE_MIN_OWNERS,
  bulletinUnlockMessage,
  canVoteForBulletin,
} from "@/lib/bulletin";

export function BulletinVoteButton({
  issueKey,
  ownerCount,
  initialCount = 0,
}: {
  issueKey: string;
  /** Unique owners who reported this issue */
  ownerCount: number;
  initialCount?: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const unlocked = canVoteForBulletin(ownerCount);

  if (!unlocked) {
    return (
      <p className="text-xs text-zinc-500 leading-relaxed">
        {bulletinUnlockMessage(ownerCount)}
      </p>
    );
  }

  async function vote(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Vote failed");
      setCount(data.count);
      setMsg(
        data.alreadyVoted
          ? "You already voted today"
          : "Thanks — counted as “needs bulletin”"
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Vote failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={vote}
        disabled={loading}
        className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
      >
        {loading
          ? "Voting…"
          : `Should be a Service Bulletin · ${count}`}
      </button>
      <span className="text-[11px] text-zinc-500">
        Unlocked — more than {BULLETIN_VOTE_MIN_OWNERS.toLocaleString()} owners
        reported this
      </span>
      {msg && <span className="text-[11px] text-zinc-500">{msg}</span>}
    </div>
  );
}
