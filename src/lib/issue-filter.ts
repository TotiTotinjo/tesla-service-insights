/**
 * Prefer Grok reasoning for scope; this is a narrow safety net.
 *
 * KEEP: system defects, electrical, software, unresolved NVH — even if techs
 * tried rebalance/alignment/tires first and the problem remains.
 *
 * DROP only: pure consumable maintenance with no residual defect
 * (e.g. "replaced worn tire", "new wipers", "cabin filter R&R only").
 */

import type { ExtractedVisit } from "./types";

/** Strong residual-problem language → always keep */
const RESIDUAL_SYMPTOM: RegExp[] = [
  /\bstill\b/i,
  /\bcontinues?\b/i,
  /\bongoing\b/i,
  /\bpersists?\b/i,
  /\bunable to (replicate|resolve|fix|find)\b/i,
  /\bno\s*fix\b/i,
  /\bnot\s*(fixed|resolved|corrected)\b/i,
  /\bafter\s+(rebalance|balancing|alignment|rotation|tire\s*replace)/i,
  /\bdespite\b/i,
  /\bunknown\s*cause\b/i,
  /\broot\s*cause\b/i,
  /\bvibration\b/i,
  /\bshake\b/i,
  /\bshimmy\b/i,
  /\bclunk\b/i,
  /\brattle\b/i,
  /\bsqueak\b/i,
  /\bnoise\b/i,
  /\bpull(ing)?\b/i,
  /\bdrift\b/i,
];

/** Real vehicle systems / defects we always want on the board */
const SYSTEM_COMPONENT: RegExp[] = [
  /\bsuspension\b/i,
  /\bcontrol\s*arm\b/i,
  /\bbushing\b/i,
  /\blateral\s*link|compliance\s*link\b/i,
  /\bdamper|shock|strut\b/i,
  /\bbearing|hub\b/i,
  /\bknuckle|ball\s*joint|tie\s*rod\b/i,
  /\bmotor|drive\s*unit|inverter\b/i,
  /\bbattery|12v|hvb|thermal\b/i,
  /\bcharge\s*port|chargeport\b/i,
  /\bhvac|compressor|cooling\s*fan|blower\b/i,
  /\bdoor\s*handle|window\s*regulator|actuator\b/i,
  /\belectrical|wiring|harness|module|ecu|mcu|pcb\b/i,
  /\bfirmware|software|reflash|update\b/i,
  /\bdisplay|touchscreen|screen\b/i,
  /\bcamera|autopilot|fsd|radar\b/i,
  /\bleak|ingress|seal\b/i,
  /\bfalcon|liftgate|frunk|trunk\b/i,
];

/**
 * Pure consumable maintenance — only exclude when the *whole* issue is this
 * and there is no residual symptom / system component language.
 */
const PURE_CONSUMABLE: RegExp[] = [
  // Tire as the only work: wear, replace tire, rotation, puncture plug — not "vibration after balance"
  /\b(tire|tyre)\s*(wear|worn|replacement|replace|rotation|rotated)\b/i,
  /\breplac(e|ed|ing)\s*(the\s*)?(front|rear|lh|rh|left|right)?\s*(tire|tyre)s?\b/i,
  /\b(tire|tyre)s?\s*(due to|from)\s*wear\b/i,
  /\blow\s*tread\b/i,
  /\bpuncture|flat\s*tire|plug(ged)?\s*tire\b/i,
  /\bwiper\s*blade|replac(e|ed)\s*wipers?\b/i,
  /\bcabin\s*(air\s*)?filter|hepa\s*filter\b/i,
  /\bwasher\s*fluid\s*(top|fill|refill)\b/i,
  /\bdetail(ing)?\s*only\b/i,
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
  fixStatus?: string;
}): string {
  return [
    v.title,
    v.symptoms,
    v.diagnosis,
    v.resolution,
    v.laborNotes,
    v.redactedNotes,
    v.issueSlug,
    v.fixStatus,
    ...(v.categories || []),
    ...(v.partsReplaced || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * True only for pure consumable maintenance with no residual defect story.
 *
 * Examples DROP:
 *  - "Rear right tire replacement due to wear"
 *  - "Cabin filter replaced"
 *
 * Examples KEEP (reasoning / residual problem):
 *  - "Steering vibration remains after rebalance and alignment"
 *  - "Highway shake — tires rebalanced, still present, cause unknown"
 *  - "Control arm clunk" (even if alignment also performed)
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
  fixStatus?: string;
}): boolean {
  const text = blob(v);
  if (!text.trim()) return false;

  // Unresolved / residual symptoms after maintenance → keep for community
  if (RESIDUAL_SYMPTOM.some((re) => re.test(text))) {
    return false;
  }

  // Real system component language → keep
  if (SYSTEM_COMPONENT.some((re) => re.test(text))) {
    return false;
  }

  // Open fix status with non-empty symptoms → keep (Grok thinks it's unresolved)
  if (
    (v.fixStatus === "no_fix_yet" || v.fixStatus === "partial") &&
    (v.symptoms || "").trim().length > 10
  ) {
    return false;
  }

  // Only drop clear pure-consumable jobs
  return PURE_CONSUMABLE.some((re) => re.test(text));
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
  "Pure tire/wiper/filter jobs are excluded. Issues that continue after rebalance/alignment (e.g. vibration still present) are kept.";
