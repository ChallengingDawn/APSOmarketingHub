// STOCK TO PARTNERS - the rules (SARCLA 18.10.2026: "we need to send daily at 07:00 in the morning Zurich time
// this file with our current stock + if there is any MOQ + if inactive or active"). Pure: Zurich's clock, when a
// partner's file is due, and what each line says. The sending is in engine.ts.

export type PartnerMode = "off" | "test" | "live";

/** The hour the file goes out, Zurich time, and the last hour a missed morning is still sent the same day. */
export const SEND_HOUR = 7;
export const LAST_HOUR = 18;

/** Zurich's date and hour for an instant - summer and winter time included. */
export function zurich(at: Date): { day: string; hour: number; weekday: number } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(at).map((p) => [p.type, p.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday };
}

/** Is today's file due: from 07:00 to 18:00 Zurich, once a day, Monday to Friday if asked. */
export function due(lastDay: string | null, at: Date, weekdaysOnly: boolean): { due: boolean; day: string } {
  const z = zurich(at);
  const workday = z.weekday >= 1 && z.weekday <= 5;
  return { day: z.day, due: z.hour >= SEND_HOUR && z.hour < LAST_HOUR && lastDay !== z.day && (!weekdaysOnly || workday) };
}

/** One article of the partner's list, as Products & Pricing has it (null: not in our catalogue). */
export type Article = {
  article_description?: string | null; stock_quantity?: string | null; sales_unit?: string | null;
  moq?: string | null; moq_minimum_quantity?: string | null; article_status?: string | null; compass_article_inactive?: string | null;
};
export type Line = {
  partnerCode: string; apso: string; description: string; stock: number | null; unit: string;
  moq: "Yes" | "No" | ""; moqQty: number | null; status: "Active" | "Inactive" | "Liquidation" | "Not in our catalogue";
};

const UNIT: Record<string, string> = { Stk: "pcs", Pcs: "pcs", "100 Pcs": "100 pcs", "1000 Pcs": "1000 pcs", Kg: "kg" };
const num = (v: string | null | undefined): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * A line of the file. Status: "Article Inactive (Compass)" says inactive -> Inactive; Article Status Liquidation ->
 * Liquidation (sold while stock lasts); otherwise Active. The field also holds "No" - not inactive.
 */
export function lineOf(partnerCode: string, apso: string, a: Article | null): Line {
  if (!a) return { partnerCode, apso, description: "", stock: null, unit: "", moq: "", moqQty: null, status: "Not in our catalogue" };
  const inactive = /^(inactive|yes|true|1)$/i.test((a.compass_article_inactive ?? "").trim());
  const qty = num(a.moq_minimum_quantity);
  return {
    partnerCode, apso,
    description: (a.article_description ?? "").trim(),
    stock: Math.max(0, num(a.stock_quantity) ?? 0),
    unit: UNIT[a.sales_unit ?? ""] ?? (a.sales_unit && a.sales_unit !== "Unknown" ? a.sales_unit : ""),
    moq: a.moq === "YES" ? "Yes" : "No",
    moqQty: a.moq === "YES" && qty && qty > 0 ? qty : null,
    status: inactive ? "Inactive" : a.article_status === "Liquidation" ? "Liquidation" : "Active",
  };
}

/** The figures in the mail and on the page. */
export function summary(lines: Line[]) {
  return {
    articles: lines.length,
    inStock: lines.filter((l) => (l.stock ?? 0) > 0).length,
    moq: lines.filter((l) => l.moq === "Yes").length,
    inactive: lines.filter((l) => l.status === "Inactive" || l.status === "Liquidation").length,
    unknown: lines.filter((l) => l.status === "Not in our catalogue").length,
  };
}

/** Addresses typed in a field: comma, semicolon or space separated, de-duplicated, only real ones. */
export function addresses(v: string | string[] | null | undefined): string[] {
  const list = Array.isArray(v) ? v : (v ?? "").split(/[\s,;]+/);
  return [...new Set(list.map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(x)))];
}

/** When the next file goes out: today 07:00 Zurich while today's is still to come, else the next (work)day. */
export function nextSend(lastDay: string | null, at: Date, weekdaysOnly: boolean): string {
  const z = zurich(at);
  const allowed = (wd: number) => !weekdaysOnly || (wd >= 1 && wd <= 5);
  if (lastDay !== z.day && z.hour < LAST_HOUR && allowed(z.weekday)) return z.hour < SEND_HOUR ? `today at 0${SEND_HOUR}:00` : "within 5 minutes";
  for (let i = 1; i <= 7; i++) {
    const d = zurich(new Date(at.getTime() + i * 86_400_000));
    if (allowed(d.weekday)) return `${i === 1 ? "tomorrow" : d.day.split("-").reverse().join(".")} at 0${SEND_HOUR}:00`;
  }
  return "-";
}
