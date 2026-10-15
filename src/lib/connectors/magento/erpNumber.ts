// THE A-NUMBER OF A WEB ORDER, ASKED OF THE SHOP (SARCLA 15.10.2026: "is there really no way
// to get the export.xml automatically?").
//
// The shop keeps the ERP order number its transfer module writes back ("A+P order number"
// in the admin) in the column sales_order.erp_order_number. Its REST API never shows that
// column - but it FILTERS on it. So the hub asks yes/no questions about one web order
// ("increment_id = W and erp_order_number >= X?") and narrows the number down: is there one
// yet, which year, the six digits by halving, then the suffix. About 23 questions, each
// reading at most one order by its web number - read-only. Proved 15.10 on known pairs from
// an old export: the exact A-number every time.
//
// No I/O here: `ask` is the shop (files.ts askShop), a test can be a string.

export type Cond = "notnull" | "like" | "gteq" | "eq";
/** One question about one web order; null = the shop did not answer. */
export type Ask = (cond: Cond, value: string) => Promise<boolean | null>;
export type Found = {
  number: string | null;
  asked: number;
  /** found · not_transferred (no A-number yet) · no_answer (the shop failed) · unreadable (not the A-number shape) */
  state: "found" | "not_transferred" | "no_answer" | "unreadable";
};

const NO_ANSWER = Symbol("no answer");
const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** The years to try, this year first (almost every waiting order is new), then back to 2014. */
export function yearsToTry(today: Date): number[] {
  const y = today.getUTCFullYear() % 100;
  const out: number[] = [];
  for (let k = y; k >= 14; k--) out.push(k);
  return out;
}

/** The A-number ("A26.627835.000") of the web order the shop answers about. */
export async function findErpNumber(ask: Ask, years: number[]): Promise<Found> {
  let asked = 0;
  const q = async (cond: Cond, value: string): Promise<boolean> => {
    asked += 1;
    const r = await ask(cond, value);
    if (r === null) throw NO_ANSWER;
    return r;
  };
  try {
    if (!(await q("notnull", "1"))) return { number: null, asked, state: "not_transferred" };
    let yy: string | null = null;
    for (const y of years) {
      if (await q("like", `A${pad(y, 2)}.%`)) { yy = pad(y, 2); break; }
    }
    if (!yy) return { number: null, asked, state: "unreadable" };
    // the largest six digits n with "A<yy>.<n>" <= the number (text order, as the shop compares)
    let lo = 0, hi = 999_999;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (await q("gteq", `A${yy}.${pad(mid, 6)}`)) lo = mid;
      else hi = mid - 1;
    }
    const base = `A${yy}.${pad(lo, 6)}`;
    if (!(await q("like", `${base}.%`))) return { number: null, asked, state: "unreadable" };
    for (let s = 0; s <= 9; s++) {
      const v = `${base}.${pad(s, 3)}`;
      if (await q("eq", v)) return { number: v, asked, state: "found" };
    }
    return { number: null, asked, state: "unreadable" };
  } catch (e) {
    if (e === NO_ANSWER) return { number: null, asked, state: "no_answer" };
    throw e;
  }
}
