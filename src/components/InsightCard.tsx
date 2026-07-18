import Link from "next/link";
import type { ServiceInsight } from "@/lib/types";

export function InsightCard({ insight }: { insight: ServiceInsight }) {
  return (
    <Link
      href={`/insights/${insight.id}`}
      className="group block rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:border-red-500/40 hover:bg-white/[0.07] transition-colors"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-zinc-200">
          {insight.vehicleModel}
        </span>
        {insight.modelYear && <span>{insight.modelYear}</span>}
        <span>{insight.mileageBucket}</span>
        <span className="capitalize">{insight.visitType.replace("_", " ")}</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-white group-hover:text-red-200 transition-colors">
        {insight.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
        {insight.symptoms}
      </p>
      {insight.categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {insight.categories.slice(0, 4).map((c) => (
            <span
              key={c}
              className="rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-red-200/90"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
