import { InsightsBrowser } from "@/components/InsightsBrowser";
import { listIssueGroups } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Insights · Tesla Service Insights",
};

export default async function InsightsPage() {
  const groups = await listIssueGroups();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-white">Service insights</h1>
      <p className="mt-2 max-w-2xl text-zinc-400">
        Issues are split per service visit, then grouped across owners. See how
        many owners share a problem and whether a fix is known — or{" "}
        <span className="text-amber-200/90">no fix yet</span>.
      </p>
      <div className="mt-8">
        <InsightsBrowser groups={groups} />
      </div>
    </div>
  );
}
