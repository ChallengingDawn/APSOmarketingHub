// Pairing a 3D form submission with the ticket HubSpot's form workflow raised for it - kept
// apart from read.ts (no imports) so it can be tested.

/** The form's workflow raises the ticket within minutes; a later ticket is another request. */
export const MATCH_WINDOW_MS = 6 * 3_600_000;

export type TicketRow = { id: string; at: string; channel: string; stage: string; closed: boolean; articles?: string };
export type Submission = { at: string; name: string; email: string; company: string; articles: string; ticket: TicketRow | null };

/**
 * Each submission's ticket: the first form ticket raised within six hours after it whose contacts
 * include the submitter. A ticket carries SEVERAL contacts - on Kevin Meili's the A+P colleague
 * came first (13.10.2026), so matching on the first contact only found nothing.
 */
export function pairTickets(subs: Omit<Submission, "ticket">[], rows: TicketRow[], emailsOf: Map<string, string[]>): Submission[] {
  const used = new Set<string>();
  const byEmail = new Map<string, TicketRow[]>();
  for (const r of rows) {
    if (r.channel !== "Form") continue;
    for (const e of new Set(emailsOf.get(r.id) ?? [])) byEmail.set(e, [...(byEmail.get(e) ?? []), r]);
  }
  for (const list of byEmail.values()) list.sort((a, b) => a.at.localeCompare(b.at));
  // oldest submission first, so two requests from one person take their own tickets in order
  const paired = [...subs].sort((a, b) => a.at.localeCompare(b.at)).map((s) => {
    const t0 = Date.parse(s.at);
    const hit = (byEmail.get(s.email) ?? []).find((r) => {
      const t = Date.parse(r.at);
      return !used.has(r.id) && t >= t0 - 10 * 60_000 && t <= t0 + MATCH_WINDOW_MS;
    });
    if (hit) used.add(hit.id);
    return { ...s, articles: s.articles || hit?.articles || "", ticket: hit ?? null };
  });
  return paired.sort((a, b) => b.at.localeCompare(a.at));
}
