// COMPANY DOMAIN - the rules, with no HubSpot in them (SARCLA 25.10.2026: "on Map assignment a new tab to replace the
// workflow SARCLA | COMPANY SETS DOMAIN"). The workflow (3339408610) took the domain of its contacts' work e-mails, and
// when there was none it INVENTED one from the company name + the country's TLD ("tmw-hoffmann-cnc-fraesen.de"): 1,893
// of the 3,903 domains set in the 180 days to 25.10 were such guesses, 86 of 150 sampled do not exist, and one that
// exists is another firm's - whose website Smart Segmentation then reads. His answers 25.10: stop guessing (a company
// without a real domain is listed), clear the old guesses that do not exist, and "private or micro" goes to Smart
// Segmentation (apso_customer APSOmicro, only on a company that never bought) instead of sarcla_segmentation_ch.

export const WORKFLOW_ID = "3339408610";

/** Free / personal mail providers (the workflow's list and the segmentation's). */
export const GENERIC = new Set([
  "gmail.com", "googlemail.com",
  ...["com", "fr", "de", "co.uk", "it", "es", "pt", "be", "nl", "pl", "at", "ch", "dk", "fi", "hu", "ie", "lu", "ro", "se", "sk", "cz", "hr"].flatMap((t) => [`outlook.${t}`, `hotmail.${t}`]),
  "live.com", "live.fr", "live.de", "live.co.uk", "live.it", "live.es", "live.be", "live.nl", "live.pl", "live.at", "msn.com",
  "yahoo.com", "yahoo.fr", "yahoo.de", "yahoo.co.uk", "yahoo.it", "yahoo.es", "yahoo.pt", "yahoo.be", "yahoo.nl", "yahoo.pl", "yahoo.at", "yahoo.ch", "yahoo.se", "ymail.com",
  "icloud.com", "me.com", "mac.com", "protonmail.com", "protonmail.ch", "proton.me", "pm.me", "mail.com", "aol.com",
  "gmx.ch", "gmx.de", "gmx.net", "gmx.at", "gmx.com", "gmx.fr", "gmx.es", "gmx.co.uk", "gmx.it", "gmx.be", "gmx.nl", "gmx.pl",
  "web.de", "t-online.de", "freenet.de", "1und1.de",
  "bluewin.ch", "sunrise.ch", "hispeed.ch", "swissonline.ch", "swisscom.ch",
  "orange.fr", "free.fr", "sfr.fr", "laposte.net", "wanadoo.fr", "bbox.fr", "bouyguestelecom.fr", "numericable.fr", "neuf.fr",
  "libero.it", "virgilio.it", "tiscali.it", "alice.it", "tin.it", "fastweb.it", "wind.it", "vodafone.it",
  "telenet.be", "skynet.be", "proximus.be", "voo.be",
  "ziggo.nl", "kpn.nl", "xs4all.nl", "planet.nl", "hetnet.nl", "upcmail.nl", "home.nl", "quicknet.nl",
  "wp.pl", "onet.pl", "interia.pl", "o2.pl", "poczta.fm", "gazeta.pl",
  "telefonica.es", "terra.es", "ono.es", "aon.at", "utanet.at", "chello.at",
  "btinternet.com", "sky.com", "talktalk.net", "virgin.net", "ntlworld.com",
]);
/** A+P's own domains: an A+P person on a customer's company never gives it a domain. */
export const INTERNAL = new Set(["angst-pfister.com", "apsoparts.com"]);
/** Legal forms in a name - a company with one is never "private or micro". */
export const LEGAL = ["SA", "AG", "GmbH", "Sàrl", "SARL", "Ltd", "LLC", "Inc", "Corp", "SpA", "SRL"];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// \b would treat "Sàrl"'s "à" as a word edge - a letter class of its own
const word = (f: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(f)}(?=$|[^\\p{L}\\p{N}])`, "giu");
export const hasLegalForm = (name: string) => LEGAL.some((f) => word(f).test(name));

export function emailDomain(email: string | null | undefined): string | null {
  const m = /@([^@\s>]+)$/.exec((email ?? "").trim().toLowerCase());
  const d = m?.[1]?.replace(/\.+$/, "");
  return d && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : null;
}
/** "https://www.foo-ag.ch/de/home" -> "foo-ag.ch". */
export function websiteDomain(url: string | null | undefined): string | null {
  const s = (url ?? "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\d?\./, "").split(/[/?#:\s]/)[0];
  return s && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : null;
}
const usable = (d: string | null): d is string => !!d && !GENERIC.has(d) && !INTERNAL.has(d);

const TLD_PRIORITY: [string, number][] = [
  [".com", 10], [".ch", 9], [".de", 9], [".fr", 9], [".it", 9], [".at", 8], [".nl", 8], [".be", 8], [".pl", 8], [".eu", 7],
  [".net", 6], [".org", 5], [".io", 4], [".co", 3], [".ltd", 2],
];
const tldScore = (d: string) => TLD_PRIORITY.find(([t]) => d.endsWith(t))?.[1] ?? 1;
/** The workflow's pick: the best TLD, then the most contacts; ties keep the first seen. */
export function pickBest(domains: string[]): string | null {
  if (!domains.length) return null;
  const n = new Map<string, number>();
  for (const d of domains) n.set(d, (n.get(d) ?? 0) + 1);
  return [...n.keys()].sort((a, b) => tldScore(b) - tldScore(a) || n.get(b)! - n.get(a)!)[0];
}

/** The workflow's name slug (its normalize_slug after the legal forms are cut). */
export function nameSlug(name: string): string {
  let r = name;
  for (const f of LEGAL) r = r.replace(word(f), "$1");
  r = r.toLowerCase();
  for (const [a, b] of Object.entries({ "ü": "ue", "ä": "ae", "ö": "oe", "ß": "ss", "é": "e", "è": "e", "ê": "e", "à": "a", "â": "a", "ù": "u", "û": "u", "î": "i", "ï": "i", "ç": "c" })) r = r.split(a).join(b);
  r = r.replace(/[^\w\s-]/g, "").trim();
  return r.replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
}
/** A domain that is exactly the workflow's guess from the name: "<slug>.<tld>". */
export function isNameGuess(domain: string, name: string): boolean {
  const s = nameSlug(name), d = domain.trim().toLowerCase();
  return s.length >= 2 && d.startsWith(`${s}.`) && /^[a-z]{2,6}(\.[a-z]{2})?$/.test(d.slice(s.length + 1));
}

export type Facts = {
  name: string; website: string | null; apso: string; turnover: number; revenue: number; contacts: number; emails: string[];
};
export type Kind = "contacts" | "website" | "deadsite" | "generic" | "noemail" | "nocontacts";
export type Verdict = { kind: Kind; domain: string | null; from: string[]; micro: boolean };
export const KIND_TEXT: Record<Kind, string> = {
  contacts: "from its contacts' work e-mails", website: "from its website", deadsite: "its website does not exist (an old name guess)", generic: "only private e-mail addresses (gmail, bluewin…)",
  noemail: "its contacts have no e-mail", nocontacts: "no contact",
};

/** What a company without a domain gets: a real domain, or none - never a guess. And whether it is private or micro. */
export function decide(f: Facts): Verdict {
  const doms = f.emails.map(emailDomain);
  const pro = doms.filter(usable);
  if (pro.length) {
    const domain = pickBest(pro)!;
    return { kind: "contacts", domain, from: f.emails.filter((e) => emailDomain(e) === domain).slice(0, 3), micro: false };
  }
  const site = websiteDomain(f.website);
  if (usable(site)) return { kind: "website", domain: site, from: [f.website!], micro: false };
  if (doms.some((d) => d && GENERIC.has(d))) {
    // the workflow's "PRIVATE OR MICRO COMPANY" - and never a company that bought, or one Smart Segmentation already placed
    const micro = !hasLegalForm(f.name) && f.turnover <= 4000 && f.revenue <= 0 && (f.apso === "" || f.apso === "APSOprospect");
    return { kind: "generic", domain: null, from: f.emails.filter((e) => GENERIC.has(emailDomain(e) ?? "")).slice(0, 3), micro };
  }
  return { kind: f.contacts > 0 ? "noemail" : "nocontacts", domain: null, from: [], micro: false };
}
