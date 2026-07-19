/**
 * Drop routine consumables / wear items from community insights.
 * Keep mechanical components, electrical, software, body structure, HVAC systems, etc.
 */

import type { ExtractedVisit } from "./types";

/** Phrases that indicate pure consumable / maintenance wear (not a defect pattern). */
const EXCLUDE_PATTERNS: RegExp[] = [
  // Tires / wheels (wear & balance only — not suspension defects)
  /\btire(s)?\b/i,
  /\btyre(s)?\b/i,
  /\btread\b/i,
  /\bwheel\s*weight/i,
  /\btire\s*pressure|\btpms\b/i,
  /\brebalance|\bbalancing\b/i,
  /\bpirelli|michelin|continental|bridgestone|goodyear|hankook|yokohama\b/i,
  /\b\d{3}\/\d{2}\s*r?\d{2}\b/i, // 255/45R19 size

  // Wipers / washers
  /\bwiper(s)?\b/i,
  /\bwasher\s*fluid\b/i,
  /\bwindscreen\s*wiper|windshield\s*wiper/i,

  // Filters (routine)
  /\bcabin\s*(air\s*)?filter\b/i,
  /\bhepa\s*filter\b/i,
  /\bair\s*filter\b/i,

  // Fluids / top-offs only
  /\bcoolant\s*top\s*off\b/i,
  /\bbrake\s*fluid\s*(flush|top)/i,
  /\bwiper\s*fluid\b/i,

  // Cosmetic / trim wear with no system failure
  /\bpaint\s*protection\b/i,
  /\bdetail(ing)?\b/i,
  /\bcarpet\s*clean/i,
  /\bseat\s*cover\b/i,
];

/**
 * Keywords that mean “real system issue” — if present with a weak tire mention,
 * we may still keep (e.g. suspension damage after tire blowout is rare; keep simple).
 * For pure tire lines, only tire words appear.
 */
const KEEP_SYSTEM_HINTS: RegExp[] = [
  /\bsuspension\b/i,
  /\bcontrol\s*arm\b/i,
  /\bbushing\b/i,
  /\blink\b/i,
  /\bdamper|shock|strut\b/i,
  /\bbearing\b/i,
  /\bmotor\b/i,
  /\bbattery\b/i,
  /\binverter\b/i,
  /\bhvac|a\/c|cooling\s*fan\b/i,
  /\bcharge\s*port\b/i,
  /\bdoor\s*handle\b/i,
  /\bwindow\s*regulator\b/i,
  /\belectrical|wiring|harness|module|ecu|mcu\b/i,
  /\bfirmware|software|update\b/i,
  /\bdisplay|touchscreen\b/i,
  /\bcamera|autopilot|fsd\b/i,
  /\bsealing|water\s*leak|ingress\b/i,
  /\bnoise|clunk|rattle|squeak|vibration\b/i, // NVH is in-scope even if tire related secondary
];

function blob(v: {
  title?: string;
  symptoms?: string;
  diagnosis?: string;
  resolution?: string;
  laborNotes?: string;
  redactedNotes?: string;
  issueSlug?: string;
  categories?: string[];
  partsReplaced?: string[];
}): string {
  return [
    v.title,
    v.symptoms,
    v.diagnosis,
    v.resolution,
    v.laborNotes,
    v.redactedNotes,
    v.issueSlug,
    ...(v.categories || []),
    ...(v.partsReplaced || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * True if this issue is routine consumable wear we should not publish.
 */
export function isConsumableOrWearIssue(v: {
  title?: string;
  symptoms?: string;
  diagnosis?: string;
  resolution?: string;
  laborNotes?: string;
  redactedNotes?: string;
  issueSlug?: string;
  categories?: string[];
  partsReplaced?: string[];
}): boolean {
  const text = blob(v);
  if (!text.trim()) return false;

  const hitsExclude = EXCLUDE_PATTERNS.filter((re) => re.test(text));
  if (hitsExclude.length === 0) return false;

  // If it clearly involves a real system component, keep it
  // (e.g. "wheel bearing noise" has "bearing" keep hint)
  const hasSystem = KEEP_SYSTEM_HINTS.some((re) => re.test(text));

  // Pure tire/tread/filter/wiper work: exclude patterns fire, no system keywords
  // Special case: "tires" + only alignment/rebalance → still consumable maintenance
  if (!hasSystem) return true;

  // Tire size + replace tire language dominates → still exclude
  const tireHeavy =
    /\b(tire|tyre|tread)\b/i.test(text) &&
    /\b(replac|wear|worn|tread|flat|puncture|rotation)\b/i.test(text) &&
    !/\b(bearing|hub|suspension|control\s*arm|knuckle)\b/i.test(text);

  return tireHeavy;
}

export function filterComponentIssues<T extends ExtractedVisit>(
  visits: T[]
): { kept: T[]; dropped: T[] } {
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const v of visits) {
    if (isConsumableOrWearIssue(v)) dropped.push(v);
    else kept.push(v);
  }
  return { kept, dropped };
}

export const CONSUMABLE_FILTER_NOTE =
  "Routine wear items (tires, wipers, cabin filters, etc.) are excluded — we keep component, electrical, and system issues only.";
