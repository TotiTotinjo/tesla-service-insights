import { createHash } from "crypto";

/** Exact PDF byte fingerprint — free duplicate check, no Grok. */
export function hashPdfBuffer(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Normalize extracted invoice text then hash.
 * Catches re-exports / re-saves of the same RO even if PDF bytes differ slightly.
 * Strips redaction placeholders and collapses noise so minor PDF differences match.
 */
export function hashInvoiceText(rawText: string): string {
  const normalized = normalizeInvoiceText(rawText);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function normalizeInvoiceText(rawText: string): string {
  return rawText
    .toLowerCase()
    // Drop our own redaction markers so re-redaction order doesn't matter
    .replace(/\[redacted_[a-z_]+\]/gi, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    // Drop punctuation noise (keep alphanumerics and spaces)
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/**
 * Shrink invoice text for the model: collapse whitespace, drop obvious boilerplate
 * lines, then hard-cap length. Saves input tokens on long multi-visit PDFs.
 */
export function compactInvoiceForModel(
  redactedText: string,
  maxChars = 14000
): string {
  let t = redactedText
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  // Drop very short lines that are often headers/footers/page numbers only
  t = t
    .split("\n")
    .filter((line) => {
      const s = line.trim();
      if (!s) return false;
      if (/^page\s+\d+/i.test(s)) return false;
      if (/^\d+\s*\/\s*\d+$/.test(s)) return false;
      if (s.length < 2) return false;
      return true;
    })
    .join("\n");

  if (t.length <= maxChars) return t;

  // Keep head + tail so early RO details and final repairs both survive
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head - 80;
  return (
    t.slice(0, head) +
    "\n\n[...middle truncated for cost...]\n\n" +
    t.slice(-Math.max(tail, 0))
  );
}
