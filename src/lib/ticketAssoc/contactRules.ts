// CONTACTS & COMPANIES ON A TICKET - the rules (SARCLA 18.10.2026: "this could be a new tab on ticket
// associations so then I can turn down the workflow"). Ported from the HubSpot workflow "SARCLA | TICKET
// ASSOCIATION FIX" (flow 4326365411, custom code on secret TASSOCIATION): every address on the ticket's
// e-mails - their From / To / Cc / Bcc, and the sender a colleague forwarded (the quoted header block in
// the body, in English, German, French, Italian and Portuguese) - that is not internal and not a robot,
// matched to an EXISTING contact (never one made), and that contact's company. Pure: no HubSpot here.

/** Our own domains - an address there is a colleague, not the customer. */
export const INTERNAL_DOMAINS = ["angst-pfister.com", "apsoparts.com", "apso-parts.com"];
/** Robots: never a customer even when a contact exists for the address. */
const NOISE_PREFIXES = ["noreply", "no-reply", "donotreply", "do-not-reply", "postmaster", "mailer-daemon", "bounces", "notifications"];

// Python's \w in the workflow's pattern is Unicode: letters and digits of any script
const EMAIL_RE = /[\p{L}\p{N}_.+-]+@[\p{L}\p{N}_.-]+\.[a-zA-Z]{2,}/gu;
/**
 * A header line of a forwarded mail quoted in the body ("---------- Forwarded message ---------" /
 * "From: Jane Doe <jane@customer.com>"), sender and recipients, in the five languages of A+P's inboxes.
 */
const FWD_HDR_RE = new RegExp(
  "(?:^|\\n)[ \\t]*(?:" +
    "From|Sender|Reply-To" + //            EN
    "|Von|Absender|Antwort an" + //        DE
    "|De|Exp[ée]diteur|R[ée]pondre" + //   FR
    "|Da|Mittente" + //                    IT
    "|Remetente" + //                      PT ("De" as in FR)
    "|To|Cc|An|Kopie|[ÀA]|Para|Per" + //   recipients, every language
  ")[ \\t]*:[ \\t]*([^\\n\\r]+)",
  "giu",
);

const isInternal = (a: string) => INTERNAL_DOMAINS.some((d) => a.endsWith(`@${d}`) || a.endsWith(`.${d}`));
const isNoise = (a: string) => { const local = a.split("@", 1)[0]; return NOISE_PREFIXES.some((p) => local.startsWith(p)); };

export type MailParts = { from?: string | null; to?: string | null; cc?: string | null; bcc?: string | null; text?: string | null };

/** The customer addresses on a ticket's e-mails: external ones to look up, and those found only in a forwarded body. */
export function contactAddresses(mails: MailParts[]): { external: string[]; forwarded: string[]; seen: number } {
  const all = new Set<string>();
  const fwd = new Set<string>();
  for (const m of mails) {
    for (const f of [m.from, m.to, m.cc, m.bcc]) for (const a of (f ?? "").match(EMAIL_RE) ?? []) all.add(a.toLowerCase());
    for (const h of (m.text ?? "").matchAll(FWD_HDR_RE)) for (const a of h[1].match(EMAIL_RE) ?? []) fwd.add(a.toLowerCase());
  }
  const fromHeaders = new Set(all);
  for (const a of fwd) all.add(a);
  const external = [...all].filter((a) => !isInternal(a) && !isNoise(a)).sort();
  return { external, forwarded: external.filter((a) => fwd.has(a) && !fromHeaders.has(a)), seen: all.size };
}

/**
 * The company a contact brings onto the ticket: its primary company - the workflow added EVERY company
 * of the contact, so a contact on three accounts put the ticket on three. Without a primary, all of them,
 * as the workflow did.
 */
export function contactCompanies(primary: string | null | undefined, linked: string[]): string[] {
  return primary ? [String(primary)] : [...new Set(linked.map(String))];
}
