import { PatternsPanel } from "@/components/PatternsPanel";
import { listPatterns } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Patterns · Tesla Service Insights",
};

export default async function PatternsPage() {
  const patterns = await listPatterns();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-white">Issue patterns</h1>
      <p className="mt-2 text-zinc-400">
        Cross-owner clusters: same symptoms, same fixes — so service can
        recognize and resolve recurring failures faster.
      </p>
      <div className="mt-8">
        <PatternsPanel initialPatterns={patterns} />
      </div>
    </div>
  );
}
