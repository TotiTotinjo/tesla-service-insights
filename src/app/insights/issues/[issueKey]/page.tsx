import Link from "next/link";
import { notFound } from "next/navigation";
import { BulletinVoteButton } from "@/components/BulletinVoteButton";
import { fixStatusLabel } from "@/lib/issue-group";
import { getIssueGroup, listInsights } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function IssueGroupDetailPage({
  params,
}: {
  params: Promise<{ issueKey: string }>;
}) {
  const { issueKey: raw } = await params;
  const issueKey = decodeURIComponent(raw);
  const group = await getIssueGroup(issueKey);
  if (!group) notFound();

  const all = await listInsights();
  const idSet = new Set(group.relatedInsightIds);
  const reports = all.filter((i) => idSet.has(i.id));

  const ownerLabel =
    group.ownerCount === 1
      ? "1 owner has reported this"
      : `${group.ownerCount} owners have reported this`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/insights"
        className="text-sm text-zinc-400 hover:text-zinc-200"
      >
        ← All issues
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-white">{group.title}</h1>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-white/10 px-3 py-1 text-zinc-200">
          {group.vehicleModel}
        </span>
        <span className="rounded-full bg-red-500/20 px-3 py-1 text-red-200">
          {ownerLabel}
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-zinc-200">
          {fixStatusLabel(group.fixStatus)}
        </span>
      </div>

      <p className="mt-4 text-zinc-300">{group.fixSummary}</p>

      <div className="mt-4">
        <BulletinVoteButton
          issueKey={group.issueKey}
          ownerCount={group.ownerCount}
          initialCount={group.bulletinVotes || 0}
        />
      </div>

      {group.categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {group.categories.map((c) => (
            <span
              key={c}
              className="rounded-md bg-red-500/15 px-2 py-1 text-xs uppercase tracking-wide text-red-200"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Common symptoms
        </h2>
        <p className="mt-2 text-zinc-200 leading-relaxed">
          {group.commonSymptoms || "—"}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Fix status
        </h2>
        <p className="mt-2 text-zinc-200 leading-relaxed">
          {group.fixStatus === "no_fix_yet"
            ? "No fix yet"
            : group.commonFixes}
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          {group.fixedCount} report{group.fixedCount === 1 ? "" : "s"} fixed ·{" "}
          {group.unfixedCount} open / no fix
        </p>
      </section>

      {group.partsMentioned.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Parts often mentioned
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-200">
            {group.partsMentioned.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white">
          Individual reports ({reports.length})
        </h2>
        <ul className="mt-4 space-y-3">
          {reports.map((full) => (
            <li key={full.id}>
              <Link
                href={`/insights/${full.id}`}
                className="block rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 hover:border-red-500/40 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span>{full.mileageBucket} mi</span>
                  <span className="capitalize">
                    {(full.fixStatus || "unknown").replace(/_/g, " ")}
                  </span>
                  <span className="capitalize">
                    {full.visitType.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-1 font-medium text-white">{full.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                  {full.symptoms}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
