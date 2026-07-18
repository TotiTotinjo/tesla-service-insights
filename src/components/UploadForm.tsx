"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type {
  AnalyzeUploadMeta,
  DraftVisit,
  FixStatus,
  ServiceInsight,
  VehicleModel,
} from "@/lib/types";

const MAX_PDF_COUNT = 10;
const MAX_BYTES_PER_FILE = 12 * 1024 * 1024;
const MAX_BYTES_TOTAL = 40 * 1024 * 1024;

const MODELS: VehicleModel[] = [
  "Model S",
  "Model 3",
  "Model X",
  "Model Y",
  "Cybertruck",
  "Semi",
  "Unknown",
];

const FIX_OPTIONS: { value: FixStatus; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "no_fix_yet", label: "No fix yet" },
  { value: "partial", label: "Partial" },
  { value: "unknown", label: "Unknown" },
];

function isPdfFile(f: File): boolean {
  const mime = (f.type || "").toLowerCase();
  return mime === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function UploadForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftVisit[]>([]);
  const [publishMeta, setPublishMeta] = useState<AnalyzeUploadMeta | null>(
    null
  );
  const [results, setResults] = useState<ServiceInsight[]>([]);
  const [duplicate, setDuplicate] = useState(false);
  const [metaNote, setMetaNote] = useState<string | null>(null);

  const totalBytes = useMemo(
    () => files.reduce((sum, f) => sum + f.size, 0),
    [files]
  );

  const includedCount = drafts.filter((d) => d.include !== false).length;

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const pdfs = list.filter(isPdfFile);
    const rejected = list.length - pdfs.length;

    setFiles((prev) => {
      const next = [...prev, ...pdfs];
      if (next.length > MAX_PDF_COUNT) {
        setError(`Too many PDFs (max ${MAX_PDF_COUNT}). Extra files were ignored.`);
        return next.slice(0, MAX_PDF_COUNT);
      }
      if (rejected > 0) {
        setError("Only PDF invoices are supported. Non-PDF files were ignored.");
      } else {
        setError(null);
      }
      return next;
    });
    setDrafts([]);
    setPublishMeta(null);
    setResults([]);
    setDuplicate(false);
    setMetaNote(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  function updateDraft(draftId: string, patch: Partial<DraftVisit>) {
    setDrafts((prev) =>
      prev.map((d) => (d.draftId === draftId ? { ...d, ...patch } : d))
    );
  }

  function removeDraft(draftId: string) {
    setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
  }

  function mergeIntoPrevious(index: number) {
    if (index <= 0) return;
    setDrafts((prev) => {
      const cur = prev[index];
      const target = prev[index - 1];
      if (!cur || !target) return prev;
      const merged: DraftVisit = {
        ...target,
        title: target.title,
        symptoms: [target.symptoms, cur.symptoms].filter(Boolean).join(" "),
        diagnosis: [target.diagnosis, cur.diagnosis].filter(Boolean).join(" "),
        resolution: [target.resolution, cur.resolution]
          .filter(Boolean)
          .join(" "),
        partsReplaced: [
          ...new Set([...target.partsReplaced, ...cur.partsReplaced]),
        ].slice(0, 15),
        categories: [
          ...new Set([...target.categories, ...cur.categories]),
        ].slice(0, 6),
        laborNotes: [target.laborNotes, cur.laborNotes]
          .filter(Boolean)
          .join(" "),
        redactedNotes: [target.redactedNotes, cur.redactedNotes]
          .filter(Boolean)
          .join(" ")
          .slice(0, 800),
        fixStatus:
          target.fixStatus === "fixed" || cur.fixStatus === "fixed"
            ? target.fixStatus === cur.fixStatus
              ? target.fixStatus
              : "partial"
            : target.fixStatus,
      };
      const next = [...prev];
      next[index - 1] = merged;
      next.splice(index, 1);
      return next;
    });
  }

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      setError("Select at least one PDF invoice.");
      return;
    }
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > MAX_BYTES_PER_FILE) {
        setError(
          `PDF #${i + 1} is too large (max ${MAX_BYTES_PER_FILE / (1024 * 1024)} MB per file).`
        );
        return;
      }
    }
    if (totalBytes > MAX_BYTES_TOTAL) {
      setError(
        `Combined upload too large (max ${MAX_BYTES_TOTAL / (1024 * 1024)} MB total).`
      );
      return;
    }

    setLoading(true);
    setError(null);
    setDrafts([]);
    setPublishMeta(null);
    setResults([]);
    setDuplicate(false);
    setMetaNote(null);
    try {
      const body = new FormData();
      for (const f of files) body.append("files", f);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      if (data.duplicate) {
        setDuplicate(true);
        setResults((data.insights as ServiceInsight[]) || []);
        setMetaNote(
          data.privacy?.message ||
            "Already published — no new Grok call."
        );
        setFiles([]);
        return;
      }

      if (data.needsReview && Array.isArray(data.drafts)) {
        setDrafts(
          (data.drafts as DraftVisit[]).map((d) => ({
            ...d,
            include: d.include !== false,
          }))
        );
        setPublishMeta(data.publishMeta as AnalyzeUploadMeta);
        setMetaNote(
          `Found ${data.drafts.length} issue(s). Review, edit, drop, or merge — then publish.`
        );
        setFiles([]);
        return;
      }

      throw new Error("Unexpected server response");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    if (!publishMeta) {
      setError("Missing analyze metadata. Re-upload the PDF.");
      return;
    }
    const toPublish = drafts.filter((d) => d.include !== false);
    if (toPublish.length === 0) {
      setError("Include at least one issue to publish.");
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visits: toPublish,
          publishMeta,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setResults((data.insights as ServiceInsight[]) || []);
      setDuplicate(Boolean(data.duplicate));
      setDrafts([]);
      setPublishMeta(null);
      setMetaNote(
        data.duplicate
          ? "Already on the board — no duplicate rows."
          : `Published ${data.insights?.length || 0} issue(s) to the community board.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={analyze} className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragging
              ? "border-red-500 bg-red-500/10"
              : "border-white/15 bg-white/5 hover:border-white/30"
          }`}
        >
          <p className="text-lg font-medium text-white">
            Drop your Tesla service invoice PDF(s)
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            PDF only · multi-visit packages split into issues · you review before
            anything goes public
          </p>
          <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors">
            Choose PDF(s)
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {files.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-white">
                {files.length} PDF{files.length === 1 ? "" : "s"} ·{" "}
                {formatKb(totalBytes)}
              </p>
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setError(null);
                }}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Clear
              </button>
            </div>
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="text-sm text-emerald-400">
                  {i + 1}. {f.name} ({formatKb(f.size)})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          <strong className="font-semibold text-amber-200">Privacy:</strong>{" "}
          Originals never saved. Analysis is a draft until you hit Publish.
        </div>

        <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100/90">
          <strong className="font-semibold text-sky-200">Early beta limits:</strong>{" "}
          max <strong>3 analyses per person per day</strong> and{" "}
          <strong>40 total analyses site-wide per day</strong> (UTC) so API costs
          stay under control. Re-uploading the same PDF does not count.
        </div>

        <button
          type="submit"
          disabled={loading || publishing || files.length === 0}
          className="w-full rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/30 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {loading
            ? "Analyzing with Grok (draft only)…"
            : "Analyze PDF (review before publish)"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {metaNote && drafts.length === 0 && results.length === 0 && (
        <p className="text-sm text-zinc-400">{metaNote}</p>
      )}

      {/* Review drafts */}
      {drafts.length > 0 && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Review issues before publish
              </h2>
              <p className="mt-1 text-sm text-sky-100/80">
                {metaNote ||
                  "Edit titles, fix status, drop junk rows, or merge duplicates."}{" "}
                {includedCount} of {drafts.length} selected.
              </p>
            </div>
            <button
              type="button"
              onClick={publish}
              disabled={publishing || includedCount === 0}
              className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {publishing
                ? "Publishing…"
                : `Publish ${includedCount} issue${includedCount === 1 ? "" : "s"}`}
            </button>
          </div>

          <ul className="space-y-4">
            {drafts.map((d, index) => (
              <li
                key={d.draftId}
                className={`rounded-xl border bg-black/30 p-4 space-y-3 ${
                  d.include === false
                    ? "border-white/5 opacity-50"
                    : "border-white/10"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={d.include !== false}
                      onChange={(e) =>
                        updateDraft(d.draftId, { include: e.target.checked })
                      }
                    />
                    Include in publish
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => mergeIntoPrevious(index)}
                        className="text-xs text-sky-300 hover:text-sky-200"
                      >
                        Merge into previous
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeDraft(d.draftId)}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <input
                  value={d.title}
                  onChange={(e) =>
                    updateDraft(d.draftId, { title: e.target.value })
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white focus:border-red-500/50 focus:outline-none"
                  placeholder="Title"
                />

                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    value={d.vehicleModel}
                    onChange={(e) =>
                      updateDraft(d.draftId, {
                        vehicleModel: e.target.value as VehicleModel,
                      })
                    }
                    className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                  >
                    {MODELS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={d.fixStatus}
                    onChange={(e) =>
                      updateDraft(d.draftId, {
                        fixStatus: e.target.value as FixStatus,
                      })
                    }
                    className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                  >
                    {FIX_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={d.issueSlug}
                    onChange={(e) =>
                      updateDraft(d.draftId, { issueSlug: e.target.value })
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                    placeholder="issue slug (for grouping)"
                  />
                </div>

                <label className="block text-xs text-zinc-500">
                  Symptoms
                  <textarea
                    value={d.symptoms}
                    onChange={(e) =>
                      updateDraft(d.draftId, { symptoms: e.target.value })
                    }
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Resolution / fix notes
                  <textarea
                    value={d.resolution}
                    onChange={(e) =>
                      updateDraft(d.draftId, { resolution: e.target.value })
                    }
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Parts (comma-separated)
                  <input
                    value={d.partsReplaced.join(", ")}
                    onChange={(e) =>
                      updateDraft(d.draftId, {
                        partsReplaced: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .slice(0, 15),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                  />
                </label>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={publish}
            disabled={publishing || includedCount === 0}
            className="w-full rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {publishing
              ? "Publishing…"
              : `Confirm & publish ${includedCount} issue${includedCount === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {/* Published / duplicate results */}
      {results.length > 0 && (
        <div
          className={`rounded-2xl border p-5 space-y-4 ${
            duplicate
              ? "border-amber-500/30 bg-amber-500/10"
              : "border-emerald-500/30 bg-emerald-500/10"
          }`}
        >
          <p
            className={`text-sm font-medium ${
              duplicate ? "text-amber-200" : "text-emerald-300"
            }`}
          >
            {metaNote ||
              (duplicate
                ? "Already on the board"
                : "Published to community insights")}
            {` · ${results.length} issue${results.length === 1 ? "" : "s"}`}
          </p>
          <ul className="space-y-3">
            {results.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                  <span className="text-zinc-200">{r.vehicleModel}</span>
                  <span className="capitalize">
                    {(r.fixStatus || "unknown").replace(/_/g, " ")}
                  </span>
                </div>
                <h3 className="mt-1 font-semibold text-white">{r.title}</h3>
                <Link
                  href={
                    r.issueKey
                      ? `/insights/issues/${encodeURIComponent(r.issueKey)}`
                      : `/insights/${r.id}`
                  }
                  className="mt-2 inline-flex text-sm font-medium text-red-300 hover:text-red-200"
                >
                  View on board →
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/insights"
            className="inline-flex text-sm font-medium text-red-300 hover:text-red-200"
          >
            Browse all community issues →
          </Link>
        </div>
      )}
    </div>
  );
}
