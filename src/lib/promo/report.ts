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
export type Check = Use & { code: string; holderId: string; holderName: string; reason: "other company" | "used again" };
export type GroupRow = {
  group: string; label: string; rate: number | null; handedOut: number; used: number; orders: number; revenue: number; discountGiven: number;
};
export type BfReport = {
  groups: GroupRow[];
  totals: { handedOut: number; used: number; orders: number; revenue: number; discountGiven: number };
  holders: (Holder & { uses: Use[] })[];
  checks: Check[];
};

/** A code as Magento and HubSpot spell it, for comparing: trimmed, upper case. */
export const normCode = (c: string | null | undefined) => String(c ?? "").trim().toUpperCase();
/** One order's codes - Magento takes one per cart, but a field holding several is split rather than missed. */
export const splitCodes = (s: string | null | undefined) => String(s ?? "").split(/[,;\s]+/).map(normCode).filter(Boolean);

const num = (v: number | null) => (v != null && Number.isFinite(v) ? v : 0);

export function buildReport(holders: Holder[], orders: CodeOrder[], rates: Record<string, number>): BfReport {
  const byCode = new Map<string, Holder & { uses: Use[] }>();
  for (const h of holders) {
    const code = normCode(h.code);
    if (code && !byCode.has(code)) byCode.set(code, { ...h, code, uses: [] });
  }
  const checks: Check[] = [];
  const sorted = [...orders].sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
  for (const o of sorted) {
    for (const code of new Set(splitCodes(o.codes))) {
      const h = byCode.get(code);
      if (!h) continue;                                   // not a Black Friday code
      const use: Use = {
        orderId: o.orderId, at: o.createdAt, total: o.total, discount: o.discount == null ? null : Math.abs(o.discount), name: o.name,
        byCompanyId: o.companyIds[0] ?? null,
      };
      if (h.uses.length) checks.push({ ...use, code, holderId: h.companyId, holderName: h.name, reason: "used again" });
      else if (use.byCompanyId && !o.companyIds.includes(h.companyId)) {
        checks.push({ ...use, code, holderId: h.companyId, holderName: h.name, reason: "other company" });
      }
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
  return { groups, totals, holders: all, checks };
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
