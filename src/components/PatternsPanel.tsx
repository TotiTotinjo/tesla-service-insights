"use client";

import { useState } from "react";
import Link from "next/link";
import type { PatternCluster } from "@/lib/types";

export function PatternsPanel({
  initialPatterns,
}: {
  initialPatterns: PatternCluster[];
}) {
  const [patterns, setPatterns] = useState(initialPatterns);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(useAi = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useAi }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setPatterns(data.patterns || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          Patterns are clustered locally by default (free). Optional AI
          clustering uses Grok tokens.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => refresh(false)}
            disabled={loading}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? "Working…" : "Refresh patterns (free)"}
          </button>
          <button
            type="button"
            onClick={() => refresh(true)}
            disabled={loading}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-50"
          >
            AI cluster (uses tokens)
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {patterns.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center text-zinc-400">
          No patterns yet. Upload a few invoices, then run analysis.
        </div>
      ) : (
        <div className="grid gap-4">
          {patterns.map((p) => (
            <article
              key={p.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-lg font-semibold text-white">{p.title}</h3>
                <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-200">
                  {p.occurrenceCount} report
                  {p.occurrenceCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                {p.vehicleModel}
                {p.categories.length > 0
                  ? ` · ${p.categories.join(", ")}`
                  : ""}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Common symptoms
                  </h4>
                  <p className="mt-1 text-sm text-zinc-300">
                    {p.commonSymptoms || "—"}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    How it was fixed
                  </h4>
                  <p className="mt-1 text-sm text-zinc-300">
                    {p.commonFixes || "—"}
                  </p>
                </div>
              </div>
              {p.relatedInsightIds.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.relatedInsightIds.slice(0, 6).map((id) => (
                    <Link
                      key={id}
                      href={`/insights/${id}`}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      View case →
                    </Link>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
