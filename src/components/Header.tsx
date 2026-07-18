import Link from "next/link";

const links = [
  { href: "/upload", label: "Upload" },
  { href: "/insights", label: "Insights" },
  { href: "/patterns", label: "Patterns" },
  { href: "/privacy", label: "Privacy" },
];

export function Header() {
  return (
    <header className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white shadow-lg shadow-red-900/40">
            T
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide text-white group-hover:text-red-300 transition-colors">
              Service Insights
            </div>
            <div className="text-[11px] text-zinc-400">
              Redacted Tesla RO knowledge base
            </div>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
