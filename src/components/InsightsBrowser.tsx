"use client";

import { useMemo, useState } from "react";
import { IssueGroupCard } from "./IssueGroupCard";
import type { IssueGroup } from "@/lib/types";

const MODELS = [
  "all",
  "Model S",
  "Model 3",
  "Model X",
  "Model Y",
  "Cybertruck",
  "Semi",
  "Unknown",
  "Multiple",
] as const;

const FIX_FILTERS = [
  { value: "all", label: "All fix statuses" },
  { value: "fixed", label: "Fixed" },
  { value: "no_fix_yet", label: "No fix yet" },
  { value: "partial", label: "Partially fixed" },
  { value: "mixed", label: "Mixed outcomes" },
] as const;

const SORTS = [
  { value: "owners", label: "Most owners" },
  { value: "open", label: "Most open / no fix" },
  { value: "bulletin", label: "Bulletin votes" },
  { value: "reports", label: "Most reports" },
] as const;

export function InsightsBrowser({ groups }: { groups: IssueGroup[] }) {
  const [q, setQ] = useState("");
  const [model, setModel] = useState<string>("all");
  const [category, setCategory] = useState("all");
  const [fixFilter, setFixFilter] = useState("all");
  const [sort, setSort] = useState<string>("owners");

  const categories = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => g.categories.forEach((c) => set.add(c)));
    return ["all", ...[...set].sort()];
  }, [groups]);

  const filtered = useMemo(() => {
    let list = groups.filter((g) => {
      if (model !== "all" && g.vehicleModel !== model) return false;
      if (
        category !== "all" &&
        !g.categories.some((c) => c.toLowerCase() === category.toLowerCase())
      )
        return false;
      if (fixFilter !== "all" && g.fixStatus !== fixFilter) return false;
      if (q.trim()) {
        const hay = [
          g.title,
          g.commonSymptoms,
          g.commonFixes,
          g.fixSummary,
          ...g.partsMentioned,
          ...g.categories,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "open":
          return b.unfixedCount - a.unfixedCount || b.ownerCount - a.ownerCount;
        case "bulletin":
          return (
            (b.bulletinVotes || 0) - (a.bulletinVotes || 0) ||
            b.ownerCount - a.ownerCount
          );
        case "reports":
          return b.reportCount - a.reportCount || b.ownerCount - a.ownerCount;
        case "owners":
        default:
          return b.ownerCount - a.ownerCount || b.reportCount - a.reportCount;
      }
    });

    return list;
  }, [groups, q, model, category, fixFilter, sort]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search symptoms, parts, fixes…"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-500/50 focus:outline-none sm:col-span-2 lg:col-span-1"
        />
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m === "all" ? "All models" : m}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : c}
            </option>
          ))}
        </select>
        <select
          value={fixFilter}
          onChange={(e) => setFixFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
        >
          {FIX_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              Sort: {s.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-zinc-500">
        {filtered.length} issue type{filtered.length === 1 ? "" : "s"} · grouped
        across owners · bulletin votes unlock after 1,000+ owners
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center text-zinc-400">
          No matching issues yet. Upload a service invoice to get started.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((g) => (
            <IssueGroupCard key={g.issueKey} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}
