// BLACK FRIDAY 2026 - what the hub's page shows, worked out from HubSpot alone: every company holding a code
// (bf26_code / bf26_discount / bf26_group, written on the company by the Ads Gateway when it hands one out) and
// every web order that carried a discount code since the start (hs_discount_codes, written by the Magento
// connector). Each code belongs to ONE company, so each use is placed exactly - and a use by another company is a
// check for Back Office. Pure: the reads are in blackFriday.ts.

export const GROUP_ORDER = ["new", "list", "bronze", "silver", "gold", "platinum", "unclassified"] as const;
export const GROUP_LABEL: Record<string, string> = {
  new: "New customers", list: "List price", bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum",
  unclassified: "No price class",
};

export type Holder = { companyId: string; name: string; code: string; discount: number | null; group: string; budgetClass: string | null };
export type CodeOrder = {
  orderId: string; codes: string | null; createdAt: string | null; total: number | null; discount: number | null;
  name: string | null; companyIds: string[];
};
export type Use = {
  orderId: string; at: string | null; total: number | null; discount: number | null; name: string | null;
  /** the company the order is on; null while the order is not linked to one yet */
  byCompanyId: string | null;
};
export type Check = Use & { code: string; holderId: string; holderName: string; reason: "other company" | "used again" | "not from the page" };
export type GroupRow = {
  group: string; label: string; rate: number | null; handedOut: number; used: number; orders: number; revenue: number; discountGiven: number;
};
/** One web order that used a Black Friday code - the Results tab's rows. */
export type OrderRow = Use & { code: string; group: string | null; holderId: string; holderName: string; check: Check["reason"] | null };
export type DayRow = { day: string; orders: number; revenue: number; discountGiven: number; newOrders: number };
export type BfReport = {
  groups: GroupRow[];
  totals: { handedOut: number; used: number; orders: number; revenue: number; discountGiven: number };
  holders: (Holder & { uses: Use[] })[];
  checks: Check[];
  /** the action's success (SARCLA 03.11.2026: "measure the success ... also the split per new customer") */
  results: {
    orders: OrderRow[]; byDay: DayRow[];
    /** companies won: a "new" code holder (never ordered before) that ordered with it */
    newCompaniesWon: number;
    split: { new: { orders: number; revenue: number; discountGiven: number }; existing: { orders: number; revenue: number; discountGiven: number } };
  };
};

/**
 * The rate of a code of the Black Friday cart rules: BLACKFRIDAY<rate> + Magento's generated part, which may start
 * with a digit (BLACKFRIDAY10 + 7K2Q...) - so it is read against the rates that exist, the longest first. null = not one of ours.
 */
export const RULE_RATES = [5, 10, 15, 20];
export const rateOfCode = (code: string, rates: number[] = RULE_RATES): number | null => {
  const c = normCode(code);
  if (!c.startsWith("BLACKFRIDAY")) return null;
  const hit = [...new Set(rates)].filter((r) => r > 0).sort((a, b) => String(b).length - String(a).length || b - a)
    .find((r) => c.startsWith(`BLACKFRIDAY${r}`));
  return hit ?? null;
};
/** Codes loaded under a rate must be that rate's codes: BLACKFRIDAY10... only under 10 %. The mismatched ones. */
export const wrongRate = (codes: string[], rate: number, rates: number[] = RULE_RATES) => codes.filter((c) => {
  const r = rateOfCode(c, [...rates, rate]);
  return r != null && r !== rate;
});

/** A code as Magento and HubSpot spell it, for comparing: trimmed, upper case. */
export const normCode = (c: string | null | undefined) => String(c ?? "").trim().toUpperCase();
/** One order's codes - Magento takes one per cart, but a field holding several is split rather than missed. */
export const splitCodes = (s: string | null | undefined) => String(s ?? "").split(/[,;\s]+/).map(normCode).filter(Boolean);

const num = (v: number | null) => (v != null && Number.isFinite(v) ? v : 0);

export function buildReport(holders: Holder[], orders: CodeOrder[], rates: Record<string, number>): BfReport {
  const ruleRates = [...RULE_RATES, ...Object.values(rates)];
  const byCode = new Map<string, Holder & { uses: Use[] }>();
  for (const h of holders) {
    const code = normCode(h.code);
    if (code && !byCode.has(code)) byCode.set(code, { ...h, code, uses: [] });
  }
  const checks: Check[] = [];
  const rows: OrderRow[] = [];
  const sorted = [...orders].sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
  for (const o of sorted) {
    for (const code of new Set(splitCodes(o.codes))) {
      const h = byCode.get(code);
      const use: Use = {
        orderId: o.orderId, at: o.createdAt, total: o.total, discount: o.discount == null ? null : Math.abs(o.discount), name: o.name,
        byCompanyId: o.companyIds[0] ?? null,
      };
      if (!h) {
        // a code of the Black Friday rules that the page never handed out: typed in by someone, or passed on
        if (rateOfCode(code, ruleRates) == null) continue; // another promotion's code
        const c: Check = { ...use, code, holderId: "", holderName: "-", reason: "not from the page" };
        checks.push(c);
        rows.push({ ...use, code, group: null, holderId: "", holderName: "-", check: c.reason });
        continue;
      }
      let reason: Check["reason"] | null = null;
      if (h.uses.length) reason = "used again";
      // a code still on an account (no company yet) cannot be held against the order's company
      else if (h.companyId && use.byCompanyId && !o.companyIds.includes(h.companyId)) reason = "other company";
      if (reason) checks.push({ ...use, code, holderId: h.companyId, holderName: h.name, reason });
      rows.push({ ...use, code, group: h.group, holderId: h.companyId, holderName: h.name, check: reason });
      h.uses.push(use);
    }
  }

  const all = [...byCode.values()];
  const groups: GroupRow[] = [...GROUP_ORDER, ...new Set(all.map((h) => h.group).filter((g) => !GROUP_ORDER.includes(g as never)))].map((g) => {
    const mine = all.filter((h) => h.group === g);
    const uses = mine.flatMap((h) => h.uses);
    return {
      group: g, label: GROUP_LABEL[g] ?? g, rate: rates[g] ?? null, handedOut: mine.length, used: mine.filter((h) => h.uses.length).length,
      orders: uses.length, revenue: uses.reduce((s, u) => s + num(u.total), 0), discountGiven: uses.reduce((s, u) => s + num(u.discount), 0),
    };
  });
  const totals = groups.reduce((t, g) => ({
    handedOut: t.handedOut + g.handedOut, used: t.used + g.used, orders: t.orders + g.orders,
    revenue: t.revenue + g.revenue, discountGiven: t.discountGiven + g.discountGiven,
  }), { handedOut: 0, used: 0, orders: 0, revenue: 0, discountGiven: 0 });
  all.sort((a, b) => (b.uses.length - a.uses.length) || a.name.localeCompare(b.name));

  // the action's success: the orders, by Swiss day, and new customers against existing ones
  const days = new Map<string, DayRow>();
  const split = { new: { orders: 0, revenue: 0, discountGiven: 0 }, existing: { orders: 0, revenue: 0, discountGiven: 0 } };
  for (const r of rows) {
    const isNew = r.group === "new";
    const day = r.at ? zurichDay(r.at) : "-";
    const d = days.get(day) ?? { day, orders: 0, revenue: 0, discountGiven: 0, newOrders: 0 };
    d.orders++; d.revenue += num(r.total); d.discountGiven += num(r.discount); if (isNew) d.newOrders++;
    days.set(day, d);
    const side = isNew ? split.new : split.existing;
    side.orders++; side.revenue += num(r.total); side.discountGiven += num(r.discount);
  }
  const results = {
    orders: [...rows].reverse(),                          // the newest first
    byDay: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    newCompaniesWon: all.filter((h) => h.group === "new" && h.uses.length).length,
    split,
  };
  return { groups, totals, holders: all, checks, results };
}

/* ── the settings form works in Swiss days; the gateway keeps instants ─────────────────────────── */

/** 00:00 in Zurich on that day (YYYY-MM-DD), as an ISO instant. */
export function zurichMidnight(day: string): string {
  const utc = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(utc)) throw new Error(`Not a day: ${day}`);
  // Zurich's hour at that UTC midnight is its offset (1 in winter, 2 in summer)
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", hour: "2-digit", hourCycle: "h23" }).format(new Date(utc)));
  return new Date(utc - hour * 3_600_000).toISOString();
}
/** The Zurich day an instant falls on. */
export function zurichDay(iso: string | number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(new Date(iso));
}
/** The settings' end is the first instant AFTER the last day: the form shows that last day. */
export const lastDayOf = (endIso: string) => zurichDay(Date.parse(endIso) - 1);
export const endAfter = (lastDay: string) => zurichMidnight(zurichDay(Date.parse(`${lastDay}T12:00:00Z`) + 86_400_000));

/** Coupon codes out of whatever Magento's export gives: the first cell of each line, quotes and header dropped. */
export function codesFromText(text: string): string[] {
  const out = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const first = line.split(/[,;\t]/)[0]?.trim().replace(/^"|"$/g, "").toUpperCase() ?? "";
    if (/^[A-Z0-9][A-Z0-9-]{3,31}$/.test(first) && first !== "CODE" && first !== "COUPON-CODE") out.add(first);
  }
  return [...out];
}
