// THE PROFIT-CENTRE SPLIT - from the ERP's own order revenue, with no HubSpot in it.
//
// Replaces the HubSpot workflow "SARCLA | UPDATE COMPANY PF SPLIT VIA DEAL
// (LATER ORDERS)". Three things were wrong with it and none of them is a detail:
//
//  1. It fired on a deal reaching Closed Won, and then never read the deal. The
//     deal was only used to find a company (`results[0]` of the association —
//     whichever came first). Every figure came from company properties. So the
//     split was recalculated when a DEAL closed, not when revenue changed: a
//     customer with no deals was never recalculated however many orders it
//     placed, and the 2-minute delay in front of the code guarded nothing.
//  2. Its profit-centre codes were rotated. It read `sealing_technology_…` as
//     ST, `antivibration_…` as AT and `drive_technology_…` as DT, where the ERP
//     has DT = Sealing, ST = Antivibration, AT = Drive (revenueRules.PC_LABEL).
//     On a sample of 100 companies carrying the property, 53 came out with a
//     different major centre under the ERP's own mapping.
//  3. PW (Sensors & Power) was not in its list at all, so a customer buying only
//     power electronics computed as "No sales".
//
// Here the figures come from `rev_<year>_pc_monthly` — the blob the ERP revenue
// step already writes on every company, `{month: {profit_centre: amount}}`,
// keyed by the ERP's own codes. The codes cannot be rotated because nobody
// re-types them, and PW is simply present.

/** The ERP's codes, as revenueRules.PC_LABEL names them. */
export const PC_LABEL: Record<string, string> = {
  dt: "Sealing Technology", kt: "Engineering Plastics", ft: "Fluid Technology",
  st: "Antivibration Technology", at: "Drive Technology", pw: "Sensors & Power", sp: "Sensors & Power",
};

/**
 * The centres a split may NAME - the same five revenueRules.MAIN uses, and
 * exactly the five the property offers. A test holds the two sets together.
 *
 * Everything else the ERP writes - pw, ws, asw and above all `unknown`, which
 * carries a little revenue on almost every company - counts towards the TOTAL
 * but is never named. Letting `unknown` compete as a centre is what produced
 * "Major DT, then UNKNOWN" and ">80% UNKNOWN" in the first preview: buckets no
 * property could hold, for a centre that does not exist (SARCLA, 20.10.2026).
 */
export const NAMED = new Set(["at", "dt", "ft", "kt", "st"]);

/** Everything else the ERP may name (pw, ws, asw, unknown…) - real revenue, no name. */
export const OTHER = "other";

export type PcTotals = Record<string, number>;

/**
 * One company's `rev_<y>_pc_monthly` blobs summed per profit centre.
 *
 * The blob is `{"jan": {"dt": 1234.5, "kt": 200}, …}`. Anything unparseable is
 * skipped rather than thrown: one malformed company must not stop a sweep over
 * thirty thousand of them.
 */
export function sumByPc(blobs: (string | null | undefined)[]): PcTotals {
  const out: PcTotals = {};
  for (const raw of blobs) {
    if (!raw || raw === "{}") continue;
    let blob: unknown;
    try { blob = JSON.parse(raw); } catch { continue; }
    if (!blob || typeof blob !== "object") continue;
    for (const by of Object.values(blob as Record<string, unknown>)) {
      if (!by || typeof by !== "object") continue;
      for (const [centre, v] of Object.entries(by as Record<string, unknown>)) {
        const n = typeof v === "number" ? v : Number.parseFloat(String(v));
        if (!Number.isFinite(n)) continue;
        const code = centre.trim().toLowerCase();
        if (!code) continue;
        out[code] = (out[code] ?? 0) + n;
      }
    }
  }
  return out;
}

/**
 * Negative totals are real: a credit note can leave a centre below zero for a
 * window. A share of a total that mixes signs is meaningless, so only positive
 * centres count towards the split — the same thing the old code did by taking
 * `v > 0`, kept deliberately.
 */
const positives = (t: PcTotals) => Object.entries(t).filter(([, v]) => v > 0);

export type Verdict = {
  /** The value to write, guaranteed to exist in the property. */
  split: string;
  major: string;
  /** What the thresholds actually said, before the property's options were applied. */
  wantedSplit: string;
  wantedMajor: string;
  /** True when the property has no option for `wantedSplit` and something broader was written. */
  fellBack: boolean;
  /** Share of the top centre, 0..1 — for the UI, never written to HubSpot. */
  topShare: number;
  top: string | null;
};

/**
 * The CEO's thresholds, unchanged from the workflow's custom code:
 *   one centre, or >= 99.9%  -> 100% X
 *   >= 80%                   -> >80% X
 *   top < 45%                -> Mix different PC
 *   second >= 20%            -> Major X, then Y
 *   otherwise                -> Major X, then mix other PC
 */
export function wanted(totals: PcTotals): { split: string; major: string; topShare: number; top: string | null } {
  const nz = positives(totals);
  if (!nz.length) return { split: "No sales", major: "No sales", topShare: 0, top: null };
  const total = nz.reduce((a, [, v]) => a + v, 0);
  if (total <= 0) return { split: "No sales", major: "No sales", topShare: 0, top: null };

  // Shares are of the WHOLE total, unnamed revenue included: a company that is
  // half sealing and half unattributed is "Major DT, then mix other PC", not
  // "100% DT". Only the named five may be the top or the second.
  const ranked = nz
    .filter(([code]) => NAMED.has(code))
    .map(([code, v]) => ({ code: code.toUpperCase(), share: v / total }))
    .sort((a, b) => b.share - a.share || a.code.localeCompare(b.code));
  if (!ranked.length) return { split: "Mix different PC", major: "Mix different PC", topShare: 0, top: null };
  const top = ranked[0];
  const second = ranked[1];

  if (top.share >= 0.999) return { split: `100% ${top.code}`, major: top.code, topShare: top.share, top: top.code };
  if (top.share >= 0.8) return { split: `>80% ${top.code}`, major: top.code, topShare: top.share, top: top.code };
  if (top.share < 0.45) return { split: "Mix different PC", major: "Mix different PC", topShare: top.share, top: top.code };
  if (second && second.share >= 0.2) return { split: `Major ${top.code}, then ${second.code}`, major: top.code, topShare: top.share, top: top.code };
  return { split: `Major ${top.code}, then mix other PC`, major: top.code, topShare: top.share, top: top.code };
}

/**
 * Both properties are enumerations, so a value that is not already an option is
 * REFUSED by HubSpot — and the old workflow only reported that in an output
 * field nobody reads. These two normalise away the differences between what the
 * thresholds say and how the options are actually spelled:
 *
 *   "100 % DT"                      - a stray space
 *   "Majot ST, then mix other PC"   - "Majot"
 *   "Majot AT, then ST"
 *
 * Normalising both sides means the typos never have to be listed one by one,
 * and a future correction of them in HubSpot needs no change here.
 */
export const normalise = (s: string) =>
  s.toLowerCase().replace(/majot/g, "major").replace(/\s+/g, "");

export function optionIndex(options: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const o of options) m.set(normalise(o), o);
  return m;
}

/**
 * The value to write, given what the property actually offers.
 *
 * When the exact bucket has no option the fall-back is broader, never wrong:
 * "Major KT, then ST" -> "Major KT, then mix other PC" -> "Mix different PC".
 * Each fall-back is counted so the gap shows up in the tab instead of being
 * quietly rounded away. Today that bites two real combinations among the five
 * live codes - KT then ST, and KT then AT - and every PW bucket.
 */
export function decide(totals: PcTotals, splitOptions: string[], majorOptions: string[]): Verdict {
  const w = wanted(totals);
  const splitIdx = optionIndex(splitOptions);
  const majorIdx = optionIndex(majorOptions);

  const pick = (...candidates: string[]) => {
    for (const c of candidates) {
      const hit = splitIdx.get(normalise(c));
      if (hit) return { value: hit, exact: c === candidates[0] };
    }
    return null;
  };

  const broader = w.top ? [`Major ${w.top}, then mix other PC`, "Mix different PC"] : ["Mix different PC"];
  const chosen = pick(w.split, ...broader);
  const major = majorIdx.get(normalise(w.major)) ?? majorIdx.get(normalise("Mix different PC")) ?? w.major;

  return {
    split: chosen?.value ?? w.split,
    major,
    wantedSplit: w.split,
    wantedMajor: w.major,
    fellBack: Boolean(chosen && !chosen.exact),
    topShare: w.topShare,
    top: w.top,
  };
}
