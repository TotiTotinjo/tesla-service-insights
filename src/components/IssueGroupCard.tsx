import Link from "next/link";
import { BulletinVoteButton } from "./BulletinVoteButton";
import { fixStatusLabel } from "@/lib/issue-group";
import type { IssueGroup } from "@/lib/types";

function fixBadgeClass(status: IssueGroup["fixStatus"]): string {
  switch (status) {
    case "fixed":
      return "bg-emerald-500/20 text-emerald-200";
    case "no_fix_yet":
      return "bg-amber-500/20 text-amber-200";
    case "partial":
      return "bg-sky-500/20 text-sky-200";
    case "mixed":
      return "bg-violet-500/20 text-violet-200";
    default:
      return "bg-white/10 text-zinc-300";
  }
}

export function IssueGroupCard({ group }: { group: IssueGroup }) {
  const ownerLabel =
    group.ownerCount === 1
      ? "1 owner has this issue"
      : `${group.ownerCount} owners have this issue`;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:border-red-500/40 transition-colors">
      <Link
        href={`/insights/issues/${encodeURIComponent(group.issueKey)}`}
        className="group block"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-zinc-200">
            {group.vehicleModel}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${fixBadgeClass(group.fixStatus)}`}
          >
            {fixStatusLabel(group.fixStatus)}
          </span>
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-200">
            {ownerLabel}
          </span>
          {(group.bulletinVotes || 0) > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">
              {group.bulletinVotes} bulletin vote
              {group.bulletinVotes === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <h3 className="mt-3 text-lg font-semibold text-white group-hover:text-red-200 transition-colors">
          {group.title}
        </h3>

        <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
          {group.commonSymptoms}
        </p>

        <p className="mt-2 text-sm text-zinc-300">
          <span className="text-zinc-500">Fix: </span>
          {group.fixStatus === "no_fix_yet"
            ? "No fix yet"
            : group.commonFixes}
        </p>

        {group.categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {group.categories.slice(0, 4).map((c) => (
              <span
                key={c}
                className="rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-red-200/90"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-zinc-500">
          {group.reportCount} report{group.reportCount === 1 ? "" : "s"}
          {group.fixedCount > 0 || group.unfixedCount > 0
            ? ` · ${group.fixedCount} fixed · ${group.unfixedCount} open`
            : ""}
        </p>
      </Link>

      <div className="mt-4">
        <BulletinVoteButton
          issueKey={group.issueKey}
          ownerCount={group.ownerCount}
          initialCount={group.bulletinVotes || 0}
        />
      </div>
    </div>
  );
}
