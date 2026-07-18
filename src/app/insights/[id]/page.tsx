import Link from "next/link";
import { notFound } from "next/navigation";
import { fixStatusLabel } from "@/lib/issue-group";
import { getInsight, getIssueGroup } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const insight = await getInsight(id);
  if (!insight) notFound();

  const group = insight.issueKey
    ? await getIssueGroup(insight.issueKey)
    : null;

  const sections = [
    { label: "Symptoms", body: insight.symptoms },
    { label: "Diagnosis", body: insight.diagnosis },
    { label: "Resolution", body: insight.resolution },
    { label: "Labor notes", body: insight.laborNotes },
    { label: "Redacted notes", body: insight.redactedNotes },
  ];

  const fix = insight.fixStatus || "unknown";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/insights"
        className="text-sm text-zinc-400 hover:text-zinc-200"
      >
        ← All issues
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-white">{insight.title}</h1>
      <div className="mt-3 flex flex-wrap gap-2 text-sm text-zinc-400">
        <span className="rounded-full bg-white/10 px-3 py-1 text-zinc-200">
          {insight.vehicleModel}
        </span>
        {insight.modelYear && <span>{insight.modelYear}</span>}
        <span>{insight.mileageBucket} miles</span>
        <span className="capitalize">
          {insight.visitType.replace("_", " ")}
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-zinc-200">
          {fixStatusLabel(fix)}
        </span>
        {insight.region && <span>{insight.region}</span>}
        <span>Confidence {(insight.confidence * 100).toFixed(0)}%</span>
      </div>

      {group && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100/90">
          <p className="font-medium">{group.fixSummary}</p>
          <Link
            href={`/insights/issues/${encodeURIComponent(group.issueKey)}`}
            className="mt-1 inline-block text-red-300 hover:text-red-200"
          >
            View all reports for this issue →
          </Link>
        </div>
      )}

      {insight.categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {insight.categories.map((c) => (
            <span
              key={c}
              className="rounded-md bg-red-500/15 px-2 py-1 text-xs uppercase tracking-wide text-red-200"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8 space-y-6">
        {sections.map(
          (s) =>
            s.body && (
              <section key={s.label}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {s.label}
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-zinc-200 leading-relaxed">
                  {s.body}
                </p>
              </section>
            )
        )}

        {insight.partsReplaced.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Parts replaced
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-200">
              {insight.partsReplaced.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        )}

        {fix === "no_fix_yet" && (
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <strong>No fix yet</strong> on this report — no lasting repair was
            confirmed for this concern.
          </section>
        )}
      </div>

      <p className="mt-10 text-xs text-zinc-600">
        Published {new Date(insight.createdAt).toLocaleString()} · Original
        invoice was not retained
      </p>
    </div>
  );
}
