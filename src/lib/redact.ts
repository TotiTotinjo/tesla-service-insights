/**
 * Deterministic PII scrubbing before/after model extraction.
 * Original files are never written to disk — only redacted strings are kept.
 */

const PATTERNS: { name: string; regex: RegExp; replace: string }[] = [
  {
    name: "email",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replace: "[REDACTED_EMAIL]",
  },
  {
    name: "phone",
    regex:
      /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
    replace: "[REDACTED_PHONE]",
  },
  {
    name: "vin",
    // 17-char VIN excluding I,O,Q
    regex: /\b[A-HJ-NPR-Z0-9]{17}\b/gi,
    replace: "[REDACTED_VIN]",
  },
  {
    name: "ssn",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replace: "[REDACTED_SSN]",
  },
  {
    name: "credit_card",
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    replace: "[REDACTED_CARD]",
  },
  {
    name: "invoice_ro",
    regex:
      /\b(?:RO|Invoice|Inv|Order|Ticket|Work\s*Order|WO)[#:\s-]*[A-Z0-9-]{5,}\b/gi,
    replace: "[REDACTED_DOC_ID]",
  },
  {
    name: "account",
    regex: /\b(?:Account|Acct|Customer\s*#|Cust\s*#)[#:\s-]*[A-Z0-9-]{4,}\b/gi,
    replace: "[REDACTED_ACCOUNT]",
  },
  {
    name: "street_address",
    regex:
      /\b\d{1,6}\s+[A-Za-z0-9.'\-\s]{2,40}\s(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Pkwy|Parkway|Hwy|Highway)\.?\b/gi,
    replace: "[REDACTED_ADDRESS]",
  },
  {
    name: "zip",
    regex: /\b\d{5}(?:-\d{4})?\b/g,
    replace: "[REDACTED_ZIP]",
  },
  {
    name: "license_plate",
    regex: /\b(?:Plate|License|Lic)[#:\s-]*[A-Z0-9]{2,8}\b/gi,
    replace: "[REDACTED_PLATE]",
  },
];

export function redactPii(text: string): string {
  let out = text;
  for (const p of PATTERNS) {
    out = out.replace(p.regex, p.replace);
  }
  // Collapse long digit runs that may be IDs
  out = out.replace(/\b\d{8,}\b/g, "[REDACTED_NUMBER]");
  return out;
}

/** Quick scan: true if residual high-risk patterns remain. */
export function stillLooksLikePii(text: string): boolean {
  const checks = [
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /\b[A-HJ-NPR-Z0-9]{17}\b/i,
    /\b\d{3}-\d{2}-\d{4}\b/,
    /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/,
  ];
  return checks.some((r) => r.test(text));
}

export function scrubInsightStrings<T extends Record<string, unknown>>(
  obj: T
): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return redactPii(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const next: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        next[k] = walk(val);
      }
      return next;
    }
    return v;
  };
  return walk(obj) as T;
}
