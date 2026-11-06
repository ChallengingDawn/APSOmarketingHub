// WHO GETS THE BACK OFFICE TEAM'S MAILS - the way in's "❗Back Office Ticket Created" (boDistribution/intakeRun) and the
// Backoffice Team's "⚠️REMINDER: Back Office Ticket" (certificates/engine), picked on Certificates > Console (kv
// certificates:settings, teamTo). Nobody picked = not sent.
//
// Never an inbox (SARCLA 05.11.2026, after the hub mailed the Backoffice Team's address, a HubSpot inbox, and every mail
// came back as a new ticket - 120 in 44 minutes): the queue users' addresses (Backoffice Team, TSA Team) and the hub's
// own sender are left out, whoever is picked.

import { kvGet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { FROM, addressOf } from "@/lib/notify/mailer";

/** Queue users: their address is a HubSpot inbox (Backoffice Team, TSA Team) */
export const INBOX_OWNERS: ReadonlySet<string> = new Set(["76164822", "1202569408"]);
export type Recipient = { id: string; name: string; email: string };

const owners = new Map<string, { at: number; v: { name: string; email: string | null } | null }>();
async function owner(id: string): Promise<{ name: string; email: string | null } | null> {
  const c = owners.get(id);
  if (c && Date.now() - c.at < 30 * 60_000) return c.v;
  const o = await hubspotRetry<{ email?: string; firstName?: string; lastName?: string }>({ path: `/crm/v3/owners/${id}?idProperty=id` }).catch(() => null);
  const v = o ? { name: [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || `Owner ${id}`, email: o.email ?? null } : null;
  owners.set(id, { at: Date.now(), v });
  return v;
}

/** The addresses that are inboxes: the queue users' and the hub's own sender. */
async function inboxes(): Promise<Set<string>> {
  const out = new Set<string>([addressOf(FROM).toLowerCase()]);
  for (const id of INBOX_OWNERS) { const o = await owner(id); if (o?.email) out.add(o.email.toLowerCase()); }
  return out;
}

/** The people picked (the way in's own list, else Certificates > Console's), with an address that is not an inbox. */
export async function teamRecipients(picked?: string[]): Promise<Recipient[]> {
  const s = picked ? null : await kvGet<{ teamTo?: string[] }>("certificates:settings");
  const ids = (picked ?? s?.teamTo ?? []).filter((id) => !INBOX_OWNERS.has(id));
  if (!ids.length) return [];
  const bad = await inboxes();
  const out: Recipient[] = [];
  for (const id of ids) {
    const o = await owner(id);
    if (o?.email && !bad.has(o.email.toLowerCase())) out.push({ id, name: o.name, email: o.email });
  }
  return out;
}

export const NOBODY = "not sent - nobody picked to get it (the Backoffice Team's own address is a HubSpot inbox)";
