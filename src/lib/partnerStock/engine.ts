// STOCK TO PARTNERS - a HubSpot app (UC & HubSpot Apps > HubSpot apps), SARCLA 18.10.2026: "we need to send daily
// at 07:00 in the morning Zurich time this file with our current stock + if there is any MOQ + if inactive or
// active". Every morning a partner gets its own article list - its code and ours - with our stock, MOQ and
// status from Products & Pricing, as an Excel file by e-mail. First partner: ITAFRAN (271 anti-vibration mounts).
// Modes: off / test (the file goes only to the test address) / live (to the partner). Production runs two copies
// of the hub: the send takes an advisory lock and marks the day before it sends, so nobody gets it twice.

import ExcelJS from "exceljs";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { mailConfigured, sendHubMail } from "@/lib/notify/mailer";
import { ITAFRAN_ARTICLES, ITAFRAN_SHEET } from "./itafranArticles";
import { renderPartnerStockMail } from "./mail";
import { addresses, due, lineOf, nextSend, summary, zurich, type Article, type Line, type PartnerMode } from "./rules";

export type Partner = { key: string; name: string; sheet: string; codeHeader: string; articles: [string, string][] };
export const PARTNERS: Partner[] = [
  { key: "itafran", name: "ITAFRAN", sheet: ITAFRAN_SHEET, codeHeader: "Code ITAFRAN", articles: ITAFRAN_ARTICLES },
];
export const partnerOf = (key: string | null | undefined): Partner => PARTNERS.find((p) => p.key === key) ?? PARTNERS[0];

export type PartnerSettings = {
  mode: PartnerMode; to: string[]; cc: string[]; testTo: string[]; weekdaysOnly: boolean; replyTo: string | null;
  by: string | null; at: string | null;
};
export type SendResult = {
  at: string; day: string; kind: "scheduled" | "test"; mode: PartnerMode; to: string[]; cc: string[];
  articles: number; inStock: number; ok: boolean; error?: string;
};
type Done = { day: string; tries: number; ok: boolean; at: string };

/** Starts in test: the first mornings go to the test address only (SARCLA: "send a test to me for tomorrow"). */
const DEFAULTS: PartnerSettings = { mode: "test", to: [], cc: [], testTo: [], weekdaysOnly: false, replyTo: null, by: null, at: null };
const KV = {
  settings: (k: string) => `partnerStock:${k}:settings`,
  done: (k: string) => `partnerStock:${k}:done`,
  last: (k: string) => `partnerStock:${k}:last`,
};
const LOCK = 4_107_221;
const TICK_MS = 5 * 60_000;
/** A failed morning is tried again on the next ticks, at most this often. */
const MAX_TRIES = 3;
const PROPS = ["article_number", "article_description", "stock_quantity", "sales_unit", "moq", "moq_minimum_quantity", "article_status", "compass_article_inactive"];
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const q = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => (await getPool().query(sql, params)).rows as T[];
const hs = <T>(path: string, method: "GET" | "POST" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });

let table: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  table ??= q(`CREATE TABLE IF NOT EXISTS apsomh_partner_stock_log (
      id bigserial PRIMARY KEY, partner text NOT NULL, at timestamptz NOT NULL DEFAULT now(), kind text NOT NULL, mode text NOT NULL,
      recipients text[], articles int NOT NULL DEFAULT 0, in_stock int NOT NULL DEFAULT 0, ok boolean NOT NULL, error text)`)
    .then(() => undefined)
    .catch((e) => { table = null; throw e; });
  return table;
}

export async function getPartnerSettings(key: string): Promise<PartnerSettings> {
  const s = await kvGet<Partial<PartnerSettings>>(KV.settings(key)).catch(() => undefined);
  return { ...DEFAULTS, ...(s ?? {}) };
}

export async function setPartnerSettings(key: string, change: Partial<Record<keyof PartnerSettings, unknown>>, by: string): Promise<PartnerSettings> {
  const cur = await getPartnerSettings(key);
  const next: PartnerSettings = {
    mode: change.mode === "off" || change.mode === "test" || change.mode === "live" ? change.mode : cur.mode,
    to: change.to !== undefined ? addresses(change.to as string | string[]) : cur.to,
    cc: change.cc !== undefined ? addresses(change.cc as string | string[]) : cur.cc,
    testTo: change.testTo !== undefined ? addresses(change.testTo as string | string[]) : cur.testTo,
    weekdaysOnly: typeof change.weekdaysOnly === "boolean" ? change.weekdaysOnly : cur.weekdaysOnly,
    replyTo: change.replyTo !== undefined ? addresses(change.replyTo as string)[0] ?? null : cur.replyTo,
    by, at: new Date().toISOString(),
  };
  if (next.mode === "live" && !next.to.length) throw new Error(`Live needs ${partnerOf(key).name}'s address in "Send to".`);
  await kvSet(KV.settings(key), next);
  return next;
}

/** Where a test goes: the test address, else the first admin's own address. */
export async function testRecipients(s: PartnerSettings): Promise<string[]> {
  if (s.testTo.length) return s.testTo;
  const r = await q<{ email: string }>("SELECT email FROM apsomh_users WHERE role = 'admin' AND email IS NOT NULL AND email <> '' ORDER BY id LIMIT 1");
  return addresses(r[0]?.email ?? "");
}

export async function emailOfUser(id: number): Promise<string | null> {
  const r = await q<{ email: string | null }>("SELECT email FROM apsomh_users WHERE id = $1", [id]);
  return addresses(r[0]?.email ?? "")[0] ?? null;
}

/** The partner's list, line by line in its own order, with what Products & Pricing says now. */
export async function readLines(p: Partner): Promise<Line[]> {
  const codes = [...new Set(p.articles.map(([, a]) => a))];
  const found = new Map<string, Article>();
  for (let i = 0; i < codes.length; i += 100) {
    const j = await hs<{ results?: { properties?: Record<string, string | null> }[] }>(`/crm/v3/objects/2-200042439/search`, "POST", {
      filterGroups: [{ filters: [{ propertyName: "article_number", operator: "IN", values: codes.slice(i, i + 100) }] }], properties: PROPS, limit: 100,
    });
    for (const r of j.results ?? []) if (r.properties?.article_number) found.set(r.properties.article_number, r.properties as Article);
  }
  return p.articles.map(([code, apso]) => lineOf(code, apso, found.get(apso) ?? null));
}

const zurichTime = (at: Date) => new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" }).format(at);
export const fileName = (p: Partner, day: string) => `APSOparts stock ${p.name} ${day}.xlsx`;

/** The Excel file: the partner's two columns, then ours - and an Info sheet saying when and what. */
export async function workbook(p: Partner, lines: Line[], at: Date): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "APSOparts";
  wb.created = at;
  const ws = wb.addWorksheet(p.sheet.slice(0, 31));
  ws.columns = [
    { header: p.codeHeader, key: "partnerCode", width: 18 },
    { header: "Code APSO", key: "apso", width: 14 },
    { header: "Description", key: "description", width: 56 },
    { header: "Stock", key: "stock", width: 10 },
    { header: "Unit", key: "unit", width: 8 },
    { header: "MOQ", key: "moq", width: 7 },
    { header: "Min. order qty", key: "moqQty", width: 14 },
    { header: "Status", key: "status", width: 22 },
  ];
  for (const l of lines) ws.addRow({ ...l, stock: l.stock ?? "", moqQty: l.moqQty ?? "" });
  ws.getColumn("apso").numFmt = "@";
  ws.getColumn("stock").numFmt = "#,##0.##";
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D2433" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: "H1" };
  const s = summary(lines);
  const info = wb.addWorksheet("Info");
  info.columns = [{ width: 22 }, { width: 90 }];
  const z = zurich(at);
  for (const row of [
    ["Stock as of", `${z.day.split("-").reverse().join(".")} ${zurichTime(at)} (Zurich)`],
    ["Articles", `${s.articles} - ${s.inStock} in stock, ${s.moq} with an MOQ, ${s.inactive} inactive, ${s.unknown} not in our catalogue`],
    ["Stock", "Free stock, in the sales unit (pcs = pieces)."],
    ["MOQ", "Yes = a minimum order quantity applies; Min. order qty says how many."],
    ["Status", "Active = can be ordered. Inactive = no longer sold. Liquidation = sold while stock lasts. Not in our catalogue = we do not know this code."],
  ]) info.addRow(row).getCell(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Build and send one partner's file: scheduled (by the mode) or a test now (to who asked). Never throws. */
export async function sendPartner(key: string, kind: "scheduled" | "test", requester: string | null = null): Promise<SendResult> {
  await ensureTable();
  const p = partnerOf(key);
  const s = await getPartnerSettings(p.key);
  const at = new Date();
  const day = zurich(at).day;
  const test = kind === "test" || s.mode === "test";
  const to = test ? (kind === "test" && requester ? [requester] : await testRecipients(s)) : s.to;
  const cc = test ? [] : s.cc;
  const out: SendResult = { at: at.toISOString(), day, kind, mode: s.mode, to, cc, articles: 0, inStock: 0, ok: false };
  try {
    if (!to.length) throw new Error(test ? "no test address and no admin with an e-mail" : `no address for ${p.name} in "Send to"`);
    if (!mailConfigured()) throw new Error("the hub's mail relay is not set up");
    const lines = await readLines(p);
    const sum = summary(lines);
    out.articles = sum.articles;
    out.inStock = sum.inStock;
    const filename = fileName(p, day);
    const m = renderPartnerStockMail({ partner: p.name, day, time: zurichTime(at), ...sum, filename, test: test ? to : null });
    await sendHubMail({
      to: to.join(", "), ...(cc.length ? { cc: cc.join(", ") } : {}), ...m, ...(s.replyTo ? { replyTo: s.replyTo } : {}),
      attachments: [{ filename, content: await workbook(p, lines, at), contentType: XLSX }],
    });
    out.ok = true;
  } catch (e) {
    out.error = (e as Error).message.slice(0, 300);
  }
  await q("INSERT INTO apsomh_partner_stock_log (partner, kind, mode, recipients, articles, in_stock, ok, error) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [p.key, kind, s.mode, [...to, ...cc], out.articles, out.inStock, out.ok, out.error ?? null]).catch(() => {});
  await kvSet(KV.last(p.key), out);
  console.log(`[partner-stock] ${p.name} ${kind} (${s.mode}): ${out.ok ? `${out.articles} articles sent to ${[...to, ...cc].join(", ")}` : `NOT sent - ${out.error}`}`);
  return out;
}

async function withLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try { return await fn(); } finally { await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {}); }
  } finally {
    client.release();
  }
}

/** Every 5 minutes: each partner whose morning file is due (07:00-18:00 Zurich, once a day). */
async function tick(): Promise<void> {
  for (const p of PARTNERS) {
    try {
      const s = await getPartnerSettings(p.key);
      if (s.mode === "off") continue;
      const done = await kvGet<Done>(KV.done(p.key));
      // a failed morning stays open for another try, at most MAX_TRIES
      const lastDay = done && (done.ok || done.tries >= MAX_TRIES) ? done.day : null;
      const d = due(lastDay, new Date(), s.weekdaysOnly);
      if (!d.due) continue;
      await withLock(async () => {
        const cur = await kvGet<Done>(KV.done(p.key));
        if (cur?.day === d.day && (cur.ok || cur.tries >= MAX_TRIES)) return;
        const tries = cur?.day === d.day ? cur.tries + 1 : 1;
        // marked before sending: the other copy, or a crash halfway, must not mean a second mail
        await kvSet(KV.done(p.key), { day: d.day, tries, ok: false, at: new Date().toISOString() });
        const r = await sendPartner(p.key, "scheduled");
        await kvSet(KV.done(p.key), { day: d.day, tries, ok: r.ok, at: new Date().toISOString() });
      });
    } catch (e) {
      console.warn(`[partner-stock] ${p.name}: ${(e as Error).message}`);
    }
  }
}

let started = false;
/** On in every copy of the hub; the mode of each partner decides. PARTNER_STOCK=off stops it entirely. */
export function startPartnerStock() {
  if (started || process.env.PARTNER_STOCK === "off") return;
  started = true;
  setTimeout(() => { void tick(); }, 90_000).unref?.();
  setInterval(() => { void tick(); }, TICK_MS).unref?.();
  console.log("[partner-stock] scheduler on: each partner's stock file at 07:00 Zurich");
}

/** The page: settings, where a test goes, today's lines and figures, the last sends. */
export async function partnerReport(key: string) {
  await ensureTable();
  const p = partnerOf(key);
  const [s, lines, last, done, log] = await Promise.all([
    getPartnerSettings(p.key), readLines(p), kvGet<SendResult>(KV.last(p.key)), kvGet<Done>(KV.done(p.key)),
    q<{ at: string; kind: string; mode: string; recipients: string[]; articles: number; in_stock: number; ok: boolean; error: string | null }>(
      "SELECT at, kind, mode, recipients, articles, in_stock, ok, error FROM apsomh_partner_stock_log WHERE partner = $1 ORDER BY at DESC LIMIT 30", [p.key]),
  ]);
  const lastDay = done && (done.ok || done.tries >= MAX_TRIES) ? done.day : null;
  return {
    partners: PARTNERS.map((x) => ({ key: x.key, name: x.name })),
    partner: { key: p.key, name: p.name, codeHeader: p.codeHeader, sheet: p.sheet },
    settings: s, testTo: await testRecipients(s), lines, summary: summary(lines), last: last ?? null, log,
    next: s.mode === "off" ? null : nextSend(lastDay, new Date(), s.weekdaysOnly), mailReady: mailConfigured(),
  };
}
