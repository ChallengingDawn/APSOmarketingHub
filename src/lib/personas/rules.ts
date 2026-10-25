// PERSONAS - the rules (HubSpot apps > Personas; the engine in engine.ts). The HubSpot workflow "SARCLA | PERSONAS SET"
// (4213275888) brought into the hub and put right, SARCLA 25.10.2026 ("migrate as a new sub-app and reinforce it").
// The cascade is the workflow's own (first match wins), with what it got wrong repaired:
//   - the company is read (the workflow handed over eyemagine_extension_attribute_company_id but read
//     associatedcompanyid - no company ever, so every company rule was dead: P1 P2 P4 P5 P8 and P6 by industry)
//   - umlauts and accents match (the code's own "Geschäftsführer", "Einkäufer", "Président", "Österreich" were garbled)
//   - the words the dropdown already knows, typed in the title: "project leader / manager" is Engineer like the
//     job_position "Project Leader"; the English of words it had only in German / French (technician, mechanic,
//     purchase, achat, chief executive officer)
//   - "product / process / project owner" is not the owner of the firm
//   - the company's ERP country (country_custom) first, as everywhere in the hub
//
// Pure: tests use it as is.

export const WORKFLOW_ID = "4213275888";

export type PersonaKey = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8" | "UN";
/** HubSpot's hs_persona values (persona_2 … persona_10 - created when the options were added) and their names. */
export const PERSONAS: Record<PersonaKey, { value: string; name: string; short: string }> = {
  P1: { value: "persona_2", name: "P1 Markus Weber", short: "DACH OEM strategic purchaser" },
  P2: { value: "persona_3", name: "P2 Sophie Müller", short: "Digital purchaser (APSOgrowth)" },
  P3: { value: "persona_4", name: "P3 Pietro Rossi", short: "Italy" },
  P4: { value: "persona_5", name: "P4 Andreas Schmidt", short: "DACH SME owner-manager" },
  P5: { value: "persona_6", name: "P5 Luca Liebertz", short: "Cut-to-size / toll manufacturing (C2S)" },
  P6: { value: "persona_7", name: "P6 Tomas Becker", short: "Maintenance / MRO" },
  P7: { value: "persona_8", name: "P7 Jan Hoffmann", short: "Design engineer" },
  P8: { value: "persona_9", name: "P8 Reseller Partner", short: "Channel partner / reseller" },
  UN: { value: "persona_10", name: "Unclassified", short: "Not enough signal" },
};
export const KEYS = Object.keys(PERSONAS) as PersonaKey[];
export const keyOfValue = (v: string | null | undefined): PersonaKey | null => KEYS.find((k) => PERSONAS[k].value === v) ?? null;

/** lower case, no accents, ß = ss */
export const norm = (s: string | null | undefined) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ß/g, "ss");
const has = (t: string, words: readonly string[]) => words.some((w) => t.includes(w));

const PURCHASER = ["einkauf", "einkaufer", "einkaeufer", "beschaffung", "purchaser", "buyer", "purchasing", "purchase", "procurement", "sourcing",
  "acheteur", "acheteuse", "achats", "achat", "approvisionnement", "acquisti"] as const;
const OWNER = ["geschaftsfuhrer", "geschaeftsfuehrer", "geschaftsfuhrerin", "geschaeftsfuehrerin", "inhaber", "inhaberin", "eigentumer", "eigentuemer",
  "owner", "managing director", "ceo", "chief executive officer", "founder", "co-founder", "co founder",
  "directeur", "directrice", "dirigeant", "president", "titolare", "amministratore"] as const;
const ENGINEER = ["konstrukteur", "projektleiter", "project leader", "project manager", "engineer", "techniker", "technician", "ingenieur", "ingegnere",
  "designer", "constructeur", "engineering", "technicien"] as const;
const MAINTENANCE = ["mechaniker", "mechanic", "wartung", "maintenance", "manutenzione", "manutentore", "instandhaltung"] as const;
/** "product owner" and the like are roles, not the owner of the firm */
const NOT_OWNER = /\b(product|process|project|business|system|budget|account|data|service)\s+owner\b/g;

const DACH = new Set(["DE", "CH", "AT"]);
const COUNTRY_NAMES: Record<string, string> = {
  germany: "DE", deutschland: "DE", allemagne: "DE", germania: "DE", switzerland: "CH", schweiz: "CH", suisse: "CH", svizzera: "CH",
  austria: "AT", osterreich: "AT", oesterreich: "AT", autriche: "AT", italy: "IT", italia: "IT", italien: "IT", italie: "IT",
};
export function countryCode(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return COUNTRY_NAMES[norm(s).replace(/[^a-z]/g, "")] ?? null;
}

export type ContactFacts = { jobtitle?: string | null; job_position?: string | null; hs_role?: string | null; hs_language?: string | null };
export type CompanyFacts = { apic_ap?: string | null; country?: string | null; country_custom?: string | null; hs_country_code?: string | null; numberofemployees?: string | number | null; apso_customer?: string | null };
export type PersonaVerdict = { key: PersonaKey; why: string };

/** The workflow skipped a contact with no job signal and no company - the hub leaves it as it is too. */
export function hasSignal(c: ContactFacts, co: CompanyFacts | null): boolean {
  return !!(String(c.jobtitle ?? "").trim() || String(c.job_position ?? "").trim() || String(c.hs_role ?? "").trim() || co);
}

/** The persona of a contact - the workflow's cascade, first match wins - and why, in a few words. */
export function derivePersona(c: ContactFacts, co: CompanyFacts | null): PersonaVerdict {
  const apic = String(co?.apic_ap ?? "").trim();
  const country = countryCode(co?.country_custom) ?? countryCode(co?.country) ?? countryCode(co?.hs_country_code);
  const n = Number(co?.numberofemployees);
  const fte = co?.numberofemployees !== null && co?.numberofemployees !== undefined && String(co.numberofemployees).trim() !== "" && Number.isFinite(n) ? Math.trunc(n) : null;
  const apso = String(co?.apso_customer ?? "").trim();
  const lang = norm(c.hs_language).trim(), role = norm(c.hs_role).trim(), pos = String(c.job_position ?? "").trim();
  const title = norm(c.jobtitle);
  const purchaser = pos === "Purchaser" || has(title, PURCHASER);
  const owner = pos === "Managing Director/CEO" || pos === "Owner" || has(title.replace(NOT_OWNER, ""), OWNER);
  const dach = !!country && DACH.has(country);

  if (/^(3\.1|3\.2|3\.3|3 )/.test(apic)) return { key: "P8", why: `industry ${apic.split(" ")[0]} - reseller / channel` };
  if (apic.startsWith("4.1")) return { key: "P5", why: "industry 4.1 - cut-to-size / toll manufacturing" };
  if (apic.startsWith("2.")) return { key: "P6", why: `industry ${apic.split(" ")[0]} - plant / MRO` };
  if (pos === "Maintenance" || has(title, MAINTENANCE)) return { key: "P6", why: "maintenance role or title" };
  if (role === "engineering" || pos === "Engineer" || pos === "Project Leader" || has(title, ENGINEER)) return { key: "P7", why: "engineering role or title" };
  if (country === "IT" || lang === "it") return { key: "P3", why: country === "IT" ? "company in Italy" : "speaks Italian" };
  if (owner && dach && fte !== null && fte <= 50) return { key: "P4", why: `owner, ${country} company of ${fte} people` };
  if (purchaser && dach && apic.startsWith("1.1") && fte !== null && fte >= 50) return { key: "P1", why: `purchaser, ${country} machine builder (${apic.split(" ")[0]}) of ${fte} people` };
  if (purchaser && (apso === "APSOgrowth" || apso === "Growth Engine Customer")) return { key: "P2", why: "purchaser at an APSOgrowth customer" };

  // why nothing matched - the gaps the rules leave (shown on the tab, to decide new rules on)
  const job = !!(title.trim() || (pos && pos !== "Other") || role);
  if (!job && !co) return { key: "UN", why: "no job and no company" };
  if (!job) return { key: "UN", why: apic && !/^no\b/i.test(apic) ? "no job - company has an industry" : "no job - company without industry" };
  if (purchaser) return { key: "UN", why: dach ? "purchaser in DACH - not a machine builder of 50+ or APSOgrowth" : "purchaser outside DACH and Italy" };
  if (owner) return { key: "UN", why: dach ? "owner in DACH - company over 50 people or size unknown" : "owner outside DACH" };
  return { key: "UN", why: "job title matches no persona" };
}
