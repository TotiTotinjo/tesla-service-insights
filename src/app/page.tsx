import Link from "next/link";

// Static marketing shell — avoids heavy SSR/stats on every home hit (CPU limits)
export const dynamic = "force-static";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <section className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-widest text-red-400">
          Privacy-first · Grok-powered · Early beta
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Turn Tesla service invoices into shared repair knowledge
        </h1>
        <p className="mt-5 text-lg text-zinc-400 leading-relaxed">
          Owners upload repair orders. We strip names, VINs, phones, and
          addresses in memory — originals are never stored — and keep only the
          technical story: what failed, how techs diagnosed it, and what fixed
          it. Issues are grouped across owners so recurring problems surface.
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
            body: "Same issue across owners stacks · Fixed / No fix yet · bulletin votes after 1,000+ owners.",
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

      <section className="mt-12 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-sm text-amber-100/90">
        <strong className="text-amber-200">Beta note:</strong> Analysis uses
        Grok and needs enough Worker CPU time. If you see Error 1102 during
        upload, the Cloudflare account needs the{" "}
        <strong>Workers Paid</strong> plan (~$5/mo) so PDF + AI work can finish.
        Browsing insights is lighter.
      </section>
    </div>
  );
}
