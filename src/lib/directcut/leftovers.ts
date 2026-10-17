// TELLING AVOR TO PACK A LEFTOVER.
//
// SARCLA, 17.10.2026: "we need a new logic only for the leftover without any cut at all ... to say that
// they need to pack the leftover as soon as the A number arrives".
//
// The middleware decides WHAT qualifies — an order every line of which is a whole piece off the shelf, with
// its Lagerplatz from HOMAG's own inventory — and writes the German wording Daniel Wieland agreed with
// Matthias on 14.10. The hub does what the hub does everywhere else: it sends, and it remembers that it
// sent. One place knows the rule, one place touches the outside world.
//
// DEDUPE, because this goes to a shared mailbox a person reads. The container is replaced on every deploy,
// so the record lives in the hub's kv, keyed by the ERP's order number — the thing AVOR sorts by and the
// only identifier that is stable once Compass has reconciled the order. A second click, a second instance
// or a redeploy cannot produce a second mail about the same order.

import { kvGet, kvSet } from "@/lib/db/init";
import { sendHubMail, mailConfigured } from "@/lib/notify/mailer";
import { adminKey, gateway } from "./gateway";

const KV = "directcut:avor:sent";

export type LeftoverLine = {
  key: string; cutArticle: string; basis: string | null; basisName: string;
  l: number; w: number; thickness: number | null; qty: number;
  stage: string; date: string | null;
  location: string | null; locationFrom: string | null;
};
export type LeftoverOrder = {
  orderNo: string; erpNo: string | null; customer: string | null; ready: boolean;
  pieces: number; withLocation: number; lines: LeftoverLine[];
  mail: { to: string; subject: string; body: string } | null;
};
export type Leftovers = { at: string; orders: LeftoverOrder[]; ready: number; waiting: number };

/** What has already been sent: ERP order number → when, and to whom. */
export type SentLog = Record<string, { at: string; to: string; by: string }>;

export async function sentLog(): Promise<SentLog> {
  return (await kvGet<SentLog>(KV).catch(() => null)) ?? {};
}

export async function fetchLeftovers(): Promise<Leftovers & { sent: SentLog; canMail: boolean }> {
  if (!adminKey()) throw new Error("C2S_ADMIN_KEY is not set on the hub, so the shelf cannot be read.");
  const [data, sent] = await Promise.all([gateway<Leftovers>("/admin/leftovers", 40_000), sentLog()]);
  return { ...data, sent, canMail: mailConfigured() };
}

export type MailOutcome = {
  orderNo: string; erpNo: string | null;
  /** sent | already | not-ready | no-location | error */
  outcome: string;
  error?: string;
};
export type MailReport = { dry: boolean; at: string; sent: number; already: number; skipped: number; failed: number; outcomes: MailOutcome[] };

/** The body as HTML, keeping the line breaks the wording depends on. */
const asHtml = (body: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${
    body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;

/**
 * Send for one order, or for every ready order when `erpNo` is omitted.
 *
 * `dry` reports what it would send and writes nothing — worth using the first few times, because this
 * reaches a shared mailbox and a mail cannot be unsent.
 */
export async function mailLeftovers({ erpNo, dry = true, who = "" }:
  { erpNo?: string; dry?: boolean; who?: string } = {}): Promise<MailReport> {
  const data = await fetchLeftovers();
  const sent = { ...data.sent };
  const at = new Date().toISOString();
  const outcomes: MailOutcome[] = [];

  const wanted = data.orders.filter((o) => (erpNo ? o.erpNo === erpNo : true));
  for (const o of wanted) {
    if (!o.ready || !o.erpNo || !o.mail) {
      outcomes.push({ orderNo: o.orderNo, erpNo: o.erpNo, outcome: "not-ready" });
      continue;
    }
    if (sent[o.erpNo]) {
      outcomes.push({ orderNo: o.orderNo, erpNo: o.erpNo, outcome: "already" });
      continue;
    }
    /* A mail whose Lagerplatz reads "unbekannt" asks AVOR to find the piece themselves, which is the one
       thing it exists to save them. Held back rather than sent half-useful; the tab says why. */
    if (o.withLocation < o.lines.length) {
      outcomes.push({ orderNo: o.orderNo, erpNo: o.erpNo, outcome: "no-location" });
      continue;
    }
    if (dry) {
      outcomes.push({ orderNo: o.orderNo, erpNo: o.erpNo, outcome: "sent" });
      continue;
    }
    try {
      await sendHubMail({
        to: o.mail.to,
        subject: o.mail.subject,
        text: o.mail.body,
        html: asHtml(o.mail.body),
        fromName: "APSOparts",
      });
      sent[o.erpNo] = { at, to: o.mail.to, by: who || "the hub" };
      outcomes.push({ orderNo: o.orderNo, erpNo: o.erpNo, outcome: "sent" });
      console.log(`[c2s-avor] ${o.erpNo}: pack-the-leftover mail sent to ${o.mail.to} by ${who || "the hub"}`);
    } catch (err) {
      outcomes.push({ orderNo: o.orderNo, erpNo: o.erpNo, outcome: "error", error: String((err as Error)?.message ?? err) });
    }
  }

  if (!dry && outcomes.some((o) => o.outcome === "sent")) await kvSet(KV, sent);

  return {
    dry, at,
    sent: outcomes.filter((o) => o.outcome === "sent").length,
    already: outcomes.filter((o) => o.outcome === "already").length,
    skipped: outcomes.filter((o) => o.outcome === "not-ready" || o.outcome === "no-location").length,
    failed: outcomes.filter((o) => o.outcome === "error").length,
    outcomes,
  };
}
