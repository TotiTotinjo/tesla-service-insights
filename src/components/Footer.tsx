import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-black/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Community project — not affiliated with Tesla, Inc. Original invoices
          are never stored.
        </p>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-zinc-300">
            Privacy
          </Link>
          <Link href="/insights" className="hover:text-zinc-300">
            Browse insights
          </Link>
        </div>
      </div>
    </footer>
  );
}
