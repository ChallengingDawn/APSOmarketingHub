// "SOMEBODY PRICED YOUR CUSTOMER'S ARTICLES YESTERDAY."
//
// The first thing the hub ever tells anybody without being asked, and the test
// of whether notifications are worth having: a price check is a customer who
// was interested enough to look up what something costs and then did not buy.
// Knowing the next morning is worth a call; knowing a week later is history.
//
// Once a day, to the owner of the company, and only to people who switched it
// on. Who "the owner" is comes from HubSpot: a hub account is matched to a
// HubSpot owner by email, which is exact — no guessing from names.

import { query } from "@/lib/db/client";
import { ensureSchema, kvGet, kvSet } from "@/lib/db/init";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { fetchShopSignals } from "@/lib/integrations/shopSignals";
import { esc, mailConfigured, sendHubMail, wrap } from "./mailer";

export const KV_LAST_RUN = "notify:priceChecks:lastRun";

type Recipient = { userId: number; email: string; name: string; ownerId: string };

/** Where the hub lives, for the links in the mail. */
function hubUrl(): string {
  return (process.env.HUB_PUBLIC_URL ?? "https://apsomarketinghub-dev.awssandbox.angst-pfister.com").replace(/\/+$/, "");
}

/**
 * HubSpot owner ids, by email.
 *
 * Matching on the address rather than the name: two people can share a name,
 * and nobody has two work addresses. An owner the hub has no account for simply
 * is not in the result.
 */
async function ownerIdsByEmail(signal?: AbortSignal): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const res = await hubspotFetchJson<{
      results?: { id: string; email?: string }[];
      paging?: { next?: { after?: string } };
    }>({ path: `/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}`, signal });
    for (const o of res.results ?? []) {
      if (o.email) map.set(o.email.toLowerCase(), String(o.id));
    }
    after = res.paging?.next?.after;
    if (!after) break;
  }
  return map;
}

/** Everybody who asked for this, paired with the HubSpot owner they are. */
async function recipients(signal?: AbortSignal): Promise<Recipient[]> {
  await ensureSchema();
  const r = await query<{ id: number; email: string | null; full_name: string; v: { notify?: { priceChecks?: boolean } } }>(
    `SELECT u.id, u.email, u.full_name, k.v
       FROM apsomh_users u
       JOIN apsomh_kv k ON k.k = 'prefs:' || u.id
      WHERE u.is_active AND u.email IS NOT NULL`,
  );
  const wanted = r.rows.filter((x) => x.v?.notify?.priceChecks === true && x.email);
  if (!wanted.length) return [];

  const owners = await ownerIdsByEmail(signal);
  const out: Recipient[] = [];
  for (const w of wanted) {
    const ownerId = owners.get(String(w.email).toLowerCase());
    // No HubSpot owner, no customers of their own — nothing to tell them about.
    if (ownerId) out.push({ userId: w.id, email: w.email!, name: w.full_name, ownerId });
  }
  return out;
}

const eur = (n: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(n));

/**
 * Yesterday's qualifying price checks, sent to the owner of each company.
 *
 * Qualifying, not every look: the rule that decides whether a price check is
 * worth a ticket is the same one that decides whether it is worth a mail, so
 * nobody gets told about a customer pricing one cheap seal.
 */
export async function runPriceCheckNotifications(opts: { signal?: AbortSignal; log?: Pick<Console, "log" | "warn"> } = {}) {
  const log = opts.log ?? console;
  if (!mailConfigured()) {
    log.warn("[notify] no SMTP credentials, nothing sent");
    return { sent: 0, skipped: "no smtp" as const };
  }

  const people = await recipients(opts.signal);
  if (!people.length) return { sent: 0, skipped: "nobody asked" as const };

  // Yesterday, in whole days: the signals scan takes a date range, and the run
  // happens in the morning about the day that has just finished.
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const day = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}`;

  const data = await fetchShopSignals({ from: day, to: day, signal: opts.signal });
  const qualifying = (data.priceChecks ?? []).filter((r) => r.qualifies && !r.excluded);
  if (!qualifying.length) {
    await kvSet(KV_LAST_RUN, { day, sent: 0, at: new Date().toISOString() });
    return { sent: 0, skipped: "nothing happened" as const };
  }

  let sent = 0;
  for (const person of people) {
    const mine = qualifying.filter((r) => r.ownerId === person.ownerId);
    if (!mine.length) continue;

    const rows = mine
      .map((r) => `<tr>
        <td style="padding:9px 10px;border-top:1px solid #eef1f5;font-size:14px;font-weight:600">${esc(r.companyName ?? "Unknown company")}</td>
        <td style="padding:9px 10px;border-top:1px solid #eef1f5;font-size:14px;text-align:right;white-space:nowrap">${esc(eur(r.value ?? 0))} EUR</td>
        <td style="padding:9px 10px;border-top:1px solid #eef1f5;font-size:13px;color:#5d6b85;text-align:right;white-space:nowrap">${r.counted} article${r.counted === 1 ? "" : "s"}</td>
      </tr>`)
      .join("");

    const total = mine.reduce((a, r) => a + (r.value ?? 0), 0);
    const html = wrap({
      heading: mine.length === 1 ? "One of your customers priced articles yesterday" : `${mine.length} of your customers priced articles yesterday`,
      intro: "They looked up what it costs and did not order. Worth a call while it is still yesterday.",
      rows: `<table style="width:100%;border-collapse:collapse">${rows}</table>`,
      cta: { label: "Open the price checks", href: `${hubUrl()}/uc/price-checks` },
      hubUrl: hubUrl(),
    });
    const text = [
      `${mine.length} of your customers priced articles yesterday (${day}).`,
      "",
      ...mine.map((r) => `- ${r.companyName ?? "Unknown company"} — ${eur(r.value ?? 0)} EUR over ${r.counted} article(s)`),
      "",
      `Total ${eur(total)} EUR. ${hubUrl()}/uc/price-checks`,
    ].join("\n");

    try {
      await sendHubMail({
        to: person.email,
        subject: mine.length === 1
          ? `A price check on ${mine[0].companyName ?? "one of your customers"}`
          : `${mine.length} price checks on your customers`,
        html,
        text,
      });
      sent++;
    } catch (e) {
      // One refused address must not stop the rest of the round.
      log.warn(`[notify] could not send to ${person.email}: ${String(e)}`);
    }
  }

  await kvSet(KV_LAST_RUN, { day, sent, at: new Date().toISOString() });
  log.log(`[notify] price checks for ${day}: ${sent} mail(s)`);
  return { sent, day };
}

export async function lastNotificationRun(): Promise<{ day: string; sent: number; at: string } | null> {
  return (await kvGet(KV_LAST_RUN)) as { day: string; sent: number; at: string } | null;
}
