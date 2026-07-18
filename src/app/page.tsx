import Link from "next/link";
import { stats } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const s = await stats();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <section className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-widest text-red-400">
          Privacy-first · Grok-powered
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Turn Tesla service invoices into shared repair knowledge
        </h1>
        <p className="mt-5 text-lg text-zinc-400 leading-relaxed">
          Owners upload repair orders. We strip names, VINs, phones, and
          addresses in memory — originals are never stored — and keep only the
          technical story: what failed, how techs diagnosed it, and what fixed
          it. Grok then finds patterns across owners so service can resolve
          issues faster.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/upload"
            className="rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/30 hover:bg-red-500"
          >
            Upload an invoice
          </Link>
          <Link
            href="/insights"
            className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Browse insights
          </Link>
          <Link
            href="/patterns"
            className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            View patterns
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "1. Upload",
            body: "Upload PDF invoices. Multi-visit packages are split into separate issues. Files stay in RAM only.",
          },
          {
            title: "2. Review & publish",
            body: "Edit, drop, or merge draft issues. Nothing is public until you confirm.",
          },
          {
            title: "3. Community match",
            body: "Same issue across owners stacks · Fixed / No fix yet · vote for Service Bulletins.",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
          >
            <h2 className="text-lg font-semibold text-white">{card.title}</h2>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              {card.body}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-12 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-6 sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Community stats
        </h2>
        <div className="mt-4 flex flex-wrap gap-8">
          <div>
            <div className="text-3xl font-bold text-white">{s.total}</div>
            <div className="text-sm text-zinc-400">Visit reports</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">{s.issueCount}</div>
            <div className="text-sm text-zinc-400">Issue types</div>
          </div>
          {Object.entries(s.byModel)
            .slice(0, 4)
            .map(([model, count]) => (
              <div key={model}>
                <div className="text-3xl font-bold text-white">{count}</div>
                <div className="text-sm text-zinc-400">{model}</div>
              </div>
            ))}
        </div>
        {s.topCategories.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {s.topCategories.map((c) => (
              <span
                key={c.name}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300"
              >
                {c.name} · {c.count}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
