// CONTACT LINK - the rule, pure: no HubSpot, no "@/" imports (the tests compile this file on its own). The engine is
// engine.ts. Replaces the HubSpot workflow "SARCLA | UNASSIGNED CONTACTS -> COMPANIES" (3778267356), SARCLA 10.11.2026,
// with its rule as it was: a contact without a company is linked to the company of its e-mail domain - one company on
// the domain: that one; several: the one of the Mandant of the contact's country (Switzerland -> M100, any other
// country -> M110) when exactly one is left; otherwise nothing is linked. Free and A+P addresses are never matched.

import { FREE_MAIL, INTERNAL } from "../ticketAssoc/shopAccountRules";

export const WORKFLOW_ID = "3778267356";
/** The workflow's own blocked domains that the hub's free-mail list does not already hold. */
const BLOCKED = new Set(["swissmail.org", "swisscom.ch"]);
/** The workflow's Swiss country values (country_custom first, else country). */
const SWISS = /^(ch|switzerland|schweiz|suisse|svizzera)$/i;

export type LinkCo = { id: string; name: string; mandant: string | null };
export type LinkKind = "one" | "mandant" | "several" | "none" | "free" | "internal" | "noemail";
export type LinkVerdict = {
  kind: LinkKind;
  /** the company to link ("one", "mandant") */
  company?: LinkCo;
  /** how many companies the domain has */
  of: number;
  /** the Mandant the contact's country asked for ("mandant", "several") */
  mandant?: "M100" | "M110" | null;
};

export function emailDomain(email: string | null | undefined): string {
  const s = String(email ?? "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  return at > 0 ? s.slice(at + 1) : "";
}
/** A domain the rule may match on: a work address, not a free one, not A+P's own. */
export function domainKind(domain: string): "free" | "internal" | "noemail" | null {
  if (!domain) return "noemail";
  if (INTERNAL.test(domain)) return "internal";
  if (FREE_MAIL.test(domain) || BLOCKED.has(domain)) return "free";
  return null;
}
/** The Mandant the contact's country asks for; null without a country. */
export function mandantOf(countryCustom: string | null | undefined, country: string | null | undefined): "M100" | "M110" | null {
  const c = (String(countryCustom ?? "").trim() || String(country ?? "").trim());
  if (!c) return null;
  return SWISS.test(c) ? "M100" : "M110";
}

/** One contact without a company and the companies on its e-mail domain, decided. */
export function decideLink(contact: { email: string | null | undefined; countryCustom?: string | null; country?: string | null }, companies: LinkCo[]): LinkVerdict {
  const d = emailDomain(contact.email);
  const k = domainKind(d);
  if (k) return { kind: k, of: 0 };
  if (!companies.length) return { kind: "none", of: 0 };
  if (companies.length === 1) return { kind: "one", company: companies[0], of: 1 };
  const m = mandantOf(contact.countryCustom, contact.country);
  if (!m) return { kind: "several", of: companies.length, mandant: null };
  const left = companies.filter((c) => String(c.mandant ?? "").trim().toUpperCase() === m);
  return left.length === 1 ? { kind: "mandant", company: left[0], of: companies.length, mandant: m } : { kind: "several", of: companies.length, mandant: m };
}
