/**
 * Free local normalization so the same physical issue maps to one issueKey
 * across owners (e.g. "LCA clunk" ≈ "front lower control arm noise").
 */

/** Map messy part / symptom phrases → canonical tokens */
const PART_SYNONYMS: [RegExp, string][] = [
  [/\b(lca|lower\s*control\s*arm|front\s*control\s*arm|control\s*arm)\b/g, "control_arm"],
  [/\b(compliance\s*link|front\s*compliance)\b/g, "compliance_link"],
  [/\b(lateral\s*link|front\s*lateral)\b/g, "lateral_link"],
  [/\b(upper\s*control\s*arm|uca)\b/g, "upper_control_arm"],
  [/\b(ball\s*joint)\b/g, "ball_joint"],
  [/\b(tie\s*rod)\b/g, "tie_rod"],
  [/\b(sway\s*bar|stabilizer\s*bar|anti[\s-]?roll)\b/g, "sway_bar"],
  [/\b(damper|shock\s*absorber|strut)\b/g, "damper"],
  [/\b(bushing|bushings)\b/g, "bushing"],
  [/\b(wheel\s*bearing|hub\s*bearing)\b/g, "wheel_bearing"],
  [/\b(charge\s*port|chargeport)\b/g, "charge_port"],
  [/\b(hvac|a\/?c\s*fan|ac\s*fan|cooling\s*fan|blower\s*motor)\b/g, "hvac_fan"],
  [/\b(12v|12\s*v|low\s*voltage\s*battery|lv\s*battery)\b/g, "lv_battery"],
  [/\b(high\s*voltage\s*battery|hv\s*battery|traction\s*battery)\b/g, "hv_battery"],
  [/\b(autopilot|fsd|camera|fascia\s*camera)\b/g, "autopilot_camera"],
  [/\b(window\s*regulator|window\s*motor)\b/g, "window_regulator"],
  [/\b(door\s*handle|flush\s*handle)\b/g, "door_handle"],
  [/\b(trunk|frunk|liftgate|hatch)\b/g, "closure"],
  [/\b(seat\s*track|seat\s*motor|seat\s*adjust)\b/g, "seat"],
  [/\b(tire|tyre)\b/g, "tire"],
  [/\b(alignment|camber|toe\b|caster)\b/g, "alignment"],
  [/\b(vibration|shake|shimmy)\b/g, "vibration"],
  [/\b(rattle|clunk|click|knock|squeak|squeal|noise|nvh)\b/g, "noise"],
  [/\b(leak|leaking|water\s*ingress)\b/g, "leak"],
  [/\b(mirror)\b/g, "mirror"],
  [/\b(glove\s*box|glovebox)\b/g, "glovebox"],
  [/\b(display|MCU|touchscreen|screen)\b/g, "display"],
];

const SYMPTOM_WORDS = new Set([
  "noise",
  "clunk",
  "click",
  "rattle",
  "squeak",
  "vibration",
  "shake",
  "leak",
  "fail",
  "stuck",
  "open",
  "close",
  "error",
  "warning",
  "overheat",
  "pull",
  "drift",
  "wear",
]);

export function canonicalizeText(input: string): string {
  let t = ` ${input.toLowerCase()} `;
  for (const [re, canon] of PART_SYNONYMS) {
    t = t.replace(re, ` ${canon} `);
  }
  return t.replace(/\s+/g, " ").trim();
}

/** Extract ordered unique canonical tokens useful for issue identity */
export function extractCanonicalTokens(
  ...fields: (string | string[] | undefined | null)[]
): string[] {
  const blob = fields
    .flatMap((f) => (Array.isArray(f) ? f : f ? [f] : []))
    .join(" ");
  const canon = canonicalizeText(blob);
  const tokens = canon
    .replace(/[^a-z0-9_]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of tokens) {
    if (seen.has(w)) continue;
    // Keep part-like and symptom-like tokens
    if (
      PART_SYNONYMS.some(([, c]) => c === w) ||
      SYMPTOM_WORDS.has(w) ||
      w.includes("_")
    ) {
      seen.add(w);
      out.push(w);
    }
  }
  return out.slice(0, 8);
}

/**
 * Build a stable, cross-owner issue slug from parts/symptoms/title.
 * Prefers Grok slug when it already maps to known canons.
 */
export function stabilizeIssueSlug(opts: {
  issueSlug?: string;
  title?: string;
  categories?: string[];
  partsReplaced?: string[];
  symptoms?: string;
}): string {
  const fromFields = extractCanonicalTokens(
    opts.partsReplaced,
    opts.categories,
    opts.title,
    opts.symptoms
  );

  const fromGrok = extractCanonicalTokens(opts.issueSlug || "");
  // Merge: prefer part tokens, then symptom tokens
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const t of [...fromFields, ...fromGrok]) {
    if (seen.has(t)) continue;
    seen.add(t);
    merged.push(t);
  }

  if (merged.length === 0) {
    const fallback = (opts.issueSlug || opts.title || "general_issue")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48);
    return fallback || "general_issue";
  }

  // Cap length: primary part/component + up to 2 symptom tokens
  const parts = merged.filter((t) => !SYMPTOM_WORDS.has(t)).slice(0, 2);
  const symptoms = merged.filter((t) => SYMPTOM_WORDS.has(t)).slice(0, 2);
  const core = [...parts, ...symptoms];
  if (core.length === 0) return merged.slice(0, 4).join("_");
  return core.join("_").slice(0, 64);
}

/** Jaccard similarity on canonical token sets (0–1) */
export function tokenSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}
