// The monthly numbers the Monthly inputs page starts from: SARCLA's
// "Dashboard 2026" (transcribed 12.10.2026, checked against its totals), and
// the targets it states. Used once, when nothing has been saved yet.

export type Inputs = {
  /** kpi -> "YYYY-MM" -> value; rates as fractions (0.29 = 29%) */
  months: Record<string, Record<string, number>>;
  /** kpi -> year -> target */
  targets: Record<string, Record<string, number>>;
  updatedAt: string | null;
  updatedBy: string | null;
};

const MONTHLY_2026: Record<string, number[]> = {
  V01: [14626, 15729, 16200, 14800, 14300, 14700, 12800, 11600, 15100],
  E01: [0.29, 0.30, 0.29, 0.28, 0.28, 0.303, 0.31, 0.29, 0.29],
  E02: [0.71, 0.70, 0.71, 0.72, 0.72, 0.70, 0.69, 0.71, 0.71],
  K02: [0.29, 0.29, 0.28, 0.29, 0.30, 0.30, 0.30, 0.34, 0.314],
  K03: [0.04, 0.03, 0.05, 0.05, 0.05, 0.04, 0.05, 0.09, 0.15],
  P01: [2751, 2900, 3100, 2700, 2400, 2800, 2700, 2200, 2300],
  R01: [458000, 423000, 436000, 433000, 358000, 385000, 336000, 686000, 630509],
  R02: [12000, 12060, 12940, 11720, 10660, 13570, 12610, 9670, 17370],
  X01: [19574, 19769, 20798, 23329, 18766, 21639, 22637, 16074, 20083],
  P05: [277786, 444536, 580749, 517087, 408628, 572467, 510552, 413933, 410457],
  R04: [1190000, 1090000, 1050000, 939000, 919000, 866000, 801000, 808000, 840000],
  R05: [15100, 14100, 14900, 12800, 11900, 11500, 11100, 9310, 11400],
  R06: [0.013, 0.013, 0.014, 0.014, 0.0129, 0.0133, 0.0139, 0.0115, 0.014],
  R07: [14.3, 14.3, 11.5, 11.6, 12.3, 12.9, 13.5, 14.0, 11.4],
  P07: [292092, 225577, 209007, 149009, 125040, 132970, 161260, 90230, 148990],
};

export function seedInputs(): Inputs {
  const months: Inputs["months"] = {};
  for (const [kpi, vals] of Object.entries(MONTHLY_2026)) {
    months[kpi] = Object.fromEntries(vals.map((v, i) => [`2026-${String(i + 1).padStart(2, "0")}`, v]));
  }
  return {
    months,
    targets: {
      F01: { "2026": 4800000 }, // SMEC: paid activities (SEA+...) revenue
      P06: { "2026": 18 },      // SMEC: ROAS
      E01: { "2026": 0.5 },     // sheet header: bounce max 50%
      E02: { "2026": 0.6 },     // sheet header: 60% B2B standard
    },
    updatedAt: null,
    updatedBy: null,
  };
}
