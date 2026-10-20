// MAP ASSIGNMENT - who owns a company, decided in the hub (SARCLA 19.10.2026: "an interactive map with the region per
// person ... that we can automate and change the SAE per country differently than we get from Performis, to copy to
// company owner / region responsibility and propagate to contact"). It replaces, country by country, the HubSpot
// workflows that do it today: "SARCLA | COMPANY/CONTACT OWNER COPY FROM PERFORMIS" (3836456157, SAE -> owner, default
// TSA Team), Diana's FEHDIA owner workflows (2937369826 company / 2916185279 contact, owner by country + postcode)
// and the company -> contact copies (3974252740, 2334350535).
//
// Pure: no HubSpot, no database - the engine feeds it facts and writes what it decides; tests and the page use it as is.
//
// Per country one SOURCE decides (SARCLA: "choose per country"):
//   "sae"  the Performis SAE through the SAE table; a company without an SAE, or with one the table does not know,
//          falls to the country's zones (and is flagged when the SAE is unknown)
//   "map"  the country's postcode zones; the SAE is shown, never copied
// Key accounts (ERP customer ids, as Diana's key-customer lists) win over both. Nothing matching = the country's
// default owner, else the global default (TSA Team). A deactivated owner is never written: flagged, default instead.
// The company decides; every contact follows (owner, region_responsibility, sae_performis).

export type OwnerId = string;

/** A zone: postcode prefixes ("30", "869"), ranges of prefixes of one length ("30-38") and/or whole regions (the
 *  cantons / départements / Länder codes of public/geo/shapes/<CC>.json - SARCLA 19.10.2026: "allow also edit more
 *  broadly, like départements, regions") that belong to one person. A prefix beats a region (it is more precise). */
export type Zone = { id: string; owner: OwnerId; prefixes: string[]; regions?: string[]; label?: string };

export type CountryRule = {
  /** ISO 3166-1 alpha-2, upper case */
  country: string;
  source: "sae" | "map";
  zones: Zone[];
  /** nothing matched in this country: this owner (else the global default) */
  defaultOwner?: OwnerId | null;
  /** ERP customer ids that always go to one person, before SAE and zones */
  keyAccounts?: { owner: OwnerId; erpIds: string[]; label?: string }[];
  /** an SAE redirected in this country only (the Performis tab): SAE value -> person, before the global SAE table */
  saeOverride?: Record<string, OwnerId>;
  /** the people who work this country (SARCLA 13.10: each person only in their home country). An SAE that points to
   *  someone else is not used here - the zone decides, flagged "not-in-country". Empty / missing = anyone. */
  people?: OwnerId[];
};

export type AssignRules = {
  /** SAE value as Performis writes it -> owner; matched order- and case-insensitively ("Borey Jeremy" = "JEREMY BOREY") */
  sae: Record<string, OwnerId>;
  countries: Record<string, CountryRule>;
  /** nothing matched anywhere: TSA Team */
  defaultOwner: OwnerId;
};

export type CompanyFacts = {
  id: string;
  country?: string | null;
  countryCustom?: string | null;
  zip?: string | null;
  /** the region code of the company's postcode (public/geo/postcodes/<CC>.json), for region zones */
  region?: string | null;
  sae?: string | null;
  erpId?: string | null;
};

/** "redirection": an Owner redirection rule SARCLA kept over the map (declined the conflict) - set by the engine, not decide() */
export type Via = "key" | "sae" | "zone" | "default" | "redirection";
export type Decision = {
  owner: OwnerId;
  via: Via;
  /** the country the decision used (ISO2) or null when it could not be read */
  country: string | null;
  /** what decided, for the page: "SAE Köremez James", "zone 30-38 (Jan Kalt)", "key account" ... */
  detail: string;
  /** "sae-unmapped", "owner-deactivated", "no-country", "no-zip" */
  flags: string[];
};

/** The SAE key: words sorted, case and accents and spaces ignored - "Jeremy Borey" = "BOREY  Jeremy" = "borey jérémy". */
export function saeKey(v: string | null | undefined): string {
  return String(v ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/[\s,;]+/).filter(Boolean).sort().join(" ");
}

/** Postcode as the zones compare it: upper case, no spaces or dashes ("D-80331" -> "80331", "1234 ab" -> "1234AB"). */
export function cleanZip(zip: string | null | undefined): string {
  const raw = String(zip ?? "").toUpperCase().trim();
  // Portugal (20.10.2026, the PT map): "1000-001" / "1000 001" -> the 4 digits the map and the zones know
  const pt = /^(\d{4})(?:\s*-\s*|\s+)\d{3}$/.exec(raw);
  if (pt) return pt[1];
  const z = raw.replace(/^[A-Z]{1,2}-(?=\d)/, "").replace(/[\s-]/g, "");
  // United Kingdom (the GB map): the outward code - "B1 1AA" is B1, never B11 (the inward part is always a digit and
  // two letters, so the split is certain; 12% of UK postcodes landed in the wrong district without it)
  const uk = /^([A-Z]{1,2}\d[A-Z\d]?)\d[A-Z]{2}$/.exec(z);
  return uk ? uk[1] : z;
}

/** Does a postcode fall in one prefix or prefix range? "30-38" compares the first 2 characters numerically. */
export function prefixMatches(zip: string, p: string): boolean {
  const z = cleanZip(zip);
  const r = /^(\w+)-(\w+)$/.exec(p.trim());
  if (r && r[1].length === r[2].length) {
    const head = z.slice(0, r[1].length);
    if (head.length < r[1].length) return false;
    if (/^\d+$/.test(head + r[1] + r[2])) return Number(head) >= Number(r[1]) && Number(head) <= Number(r[2]);
    return head >= r[1].toUpperCase() && head <= r[2].toUpperCase();
  }
  const q = cleanZip(p);
  return !!q && z.startsWith(q);
}

/** The longest matching prefix wins (a "869" zone beats an "86" one); equal length: the first zone listed. No prefix
 *  matches: a zone that holds the postcode's region (`prefix` is then "region <code>"). */
export function zoneFor(zip: string | null | undefined, zones: Zone[], region?: string | null): { zone: Zone; prefix: string } | null {
  const z = cleanZip(zip);
  let best: { zone: Zone; prefix: string; len: number } | null = null;
  if (z) for (const zone of zones) for (const p of zone.prefixes) {
    if (!prefixMatches(z, p)) continue;
    const len = p.includes("-") ? p.split("-")[0].length : cleanZip(p).length;
    if (!best || len > best.len) best = { zone, prefix: p, len };
  }
  if (best) return { zone: best.zone, prefix: best.prefix };
  const r = String(region ?? "").trim();
  if (r) for (const zone of zones) if (zone.regions?.includes(r)) return { zone, prefix: `region ${r}` };
  return null;
}

const COUNTRY_NAMES: Record<string, string> = {
  switzerland: "CH", schweiz: "CH", suisse: "CH", svizzera: "CH", germany: "DE", deutschland: "DE", france: "FR", italy: "IT", italia: "IT",
  austria: "AT", "österreich": "AT", osterreich: "AT", netherlands: "NL", "the netherlands": "NL", nederland: "NL", poland: "PL", polska: "PL",
  belgium: "BE", "belgique": "BE", belgie: "BE", spain: "ES", "espana": "ES", "czech republic": "CZ", czechia: "CZ", "united kingdom": "GB",
  liechtenstein: "LI", luxembourg: "LU", denmark: "DK", sweden: "SE", norway: "NO", finland: "FI", portugal: "PT", hungary: "HU",
  slovakia: "SK", slovenia: "SI", croatia: "HR", romania: "RO", bulgaria: "BG", greece: "GR", ireland: "IE", turkey: "TR",
};
/** country_custom first, country as fallback (SARCLA 13.10: the custom field is right where they disagree). */
export function countryOf(c: CompanyFacts): string | null {
  for (const v of [c.countryCustom, c.country]) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
    const k = s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    if (COUNTRY_NAMES[k] ?? COUNTRY_NAMES[s.toLowerCase()]) return COUNTRY_NAMES[k] ?? COUNTRY_NAMES[s.toLowerCase()];
  }
  return null;
}

export function decide(c: CompanyFacts, rules: AssignRules, active: (owner: OwnerId) => boolean, names: (owner: OwnerId) => string = (o) => o): Decision {
  const flags: string[] = [];
  const country = countryOf(c);
  if (!country) flags.push("no-country");
  const rule = country ? rules.countries[country] : undefined;
  const fallback = rule?.defaultOwner || rules.defaultOwner;
  const done = (owner: OwnerId, via: Via, detail: string): Decision => {
    if (!active(owner)) return { owner: fallback === owner ? rules.defaultOwner : fallback, via: "default", country, detail: `${detail} - ${names(owner)} has left`, flags: [...flags, "owner-deactivated"] };
    return { owner, via, country, detail, flags };
  };
  // key accounts: first in a "map" country; in an "sae" country only for a company WITHOUT an SAE, as Diana's
  // workflows did (all 274 of Claudio's key customers have an SAE - first would move 267 of them, SARCLA: start
  // from today's behaviour)
  const erp = String(c.erpId ?? "").trim();
  const keyFirst = rule?.source === "map" || !String(c.sae ?? "").trim();
  if (rule && erp && keyFirst) for (const k of rule.keyAccounts ?? []) if (k.erpIds.includes(erp)) return done(k.owner, "key", `key account${k.label ? ` (${k.label})` : ""}`);
  const zone = () => {
    if (!rule) return null;
    if (!cleanZip(c.zip) && !c.region) { flags.push("no-zip"); return null; }
    const z = zoneFor(c.zip, rule.zones, c.region);
    return z ? done(z.zone.owner, "zone", `zone ${z.prefix}${z.zone.label ? ` (${z.zone.label})` : ""} - ${names(z.zone.owner)}`) : null;
  };
  if (!rule || rule.source === "sae") {
    const sae = String(c.sae ?? "").trim();
    let elsewhere: OwnerId | null = null;
    if (sae) {
      const local = Object.entries(rule?.saeOverride ?? {}).find(([k]) => saeKey(k) === saeKey(sae));
      const hit = local ?? Object.entries(rules.sae).find(([k]) => saeKey(k) === saeKey(sae));
      if (hit && rule?.people?.length && !rule.people.includes(hit[1]) && !local) { flags.push("not-in-country"); elsewhere = hit[1]; } // the zone decides
      else if (hit) return done(hit[1], "sae", `SAE ${sae}${local ? ` (redirected in ${country})` : ""} - ${names(hit[1])}`);
      else flags.push("sae-unmapped");
    }
    const z = zone();
    if (z) return z;
    return done(fallback, "default", elsewhere ? `SAE ${sae} is ${names(elsewhere)}, who does not work ${country}; no zone - default`
      : sae ? `SAE ${sae} not in the table, no zone - default` : "no SAE, no zone - default");
  }
  const z = zone();
  if (z) return z;
  return done(fallback, "default", "no zone for this postcode - default");
}

/** Generic mail domains a contact's company is never guessed from. */
export const GENERIC_DOMAINS = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.de", "hotmail.fr", "live.com", "yahoo.com",
  "yahoo.de", "yahoo.fr", "icloud.com", "me.com", "gmx.de", "gmx.ch", "gmx.net", "gmx.at", "web.de", "t-online.de", "bluewin.ch", "orange.fr",
  "free.fr", "wanadoo.fr", "libero.it", "aol.com", "protonmail.com", "proton.me", "mail.ch", "sunrise.ch", "hispeed.ch", "msn.com"]);

export type DomainCompany = { id: string; ownerId: string | null; erpId: string | null };
/**
 * A contact without a company, by its e-mail domain (HubSpot links it by itself only when exactly ONE company has the
 * domain - 31 of 68 new contacts on 19.10 had none). Link when it is clear: one company, else one ERP customer among
 * them; same owner on all of them = that owner, no link; otherwise the "no company" list (SARCLA 19.10: list them).
 */
export function contactCompany(domain: string, companies: DomainCompany[]): { link: string | null; owner: OwnerId | null; why: string } {
  const d = domain.toLowerCase().trim();
  if (!d || GENERIC_DOMAINS.has(d)) return { link: null, owner: null, why: d ? "generic mail domain" : "no e-mail" };
  if (!companies.length) return { link: null, owner: null, why: "no company with this domain" };
  if (companies.length === 1) return { link: companies[0].id, owner: companies[0].ownerId, why: "the only company with this domain" };
  const erp = companies.filter((c) => c.erpId);
  if (erp.length === 1) return { link: erp[0].id, owner: erp[0].ownerId, why: "the only ERP customer with this domain" };
  const owners = new Set(companies.map((c) => c.ownerId ?? ""));
  if (owners.size === 1 && companies[0].ownerId) return { link: null, owner: companies[0].ownerId, why: `${companies.length} companies with this domain, all the same owner` };
  return { link: null, owner: null, why: `${companies.length} companies with this domain, different owners - a person picks` };
}
