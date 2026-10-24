// MAP ASSIGNMENT - Wrong Performis owners (SARCLA 24.10.2026: "change it in Performis, but create a tab Wrong Performis
// Owners so we can list the deviation"; "allow export of all wrong owners"). A Performis customer (an ERP id) whose SAE
// does not name the person the rules give it: what Performis has, what to write there instead and why. Once Performis
// has it, the ERP sync brings it to HubSpot and rule 1 gives the same person - no redirect, no alias needed any more.
//
// Pure: tests and the server (performisWrongDb.ts) use it as is.

import { saeKey, type AssignRules, type OwnerId } from "./rules";

export type WrongReason = "no-sae" | "unknown" | "left" | "alias" | "redirected" | "elsewhere" | "rule2" | "other";
export const WRONG_ORDER: WrongReason[] = ["left", "redirected", "alias", "unknown", "elsewhere", "rule2", "other", "no-sae"];
export const WRONG_TEXT: Record<WrongReason, { title: string; why: string }> = {
  "left": { title: "Someone who has left", why: "The SAE is a person who no longer works here - the rules give the company to someone else." },
  "redirected": { title: "Overruled in the country", why: "The country gives this SAE's companies to someone else (an override on the map, e.g. France: TSA Team -> Jeremy Borey)." },
  "alias": { title: "Another name for the person", why: "The SAE goes to the right person but under another name or a team code (ESO CH GER -> Kalt Jan, WIESTE -> Wieneber Stefan)." },
  "unknown": { title: "Not a person", why: "The SAE is in no row of the SAE table (a region, \"None\", a number) - the zip codes decide." },
  "elsewhere": { title: "Works another country", why: "The SAE's person does not work this country - the zip codes decide." },
  "rule2": { title: "Rule 1 off in the country", why: "The country's zip codes decide every company; Performis still names someone else." },
  "other": { title: "Key account or Owner redirection", why: "A key-account list or an Owner redirection rule gives the company to someone else than its SAE." },
  "no-sae": { title: "No SAE in Performis", why: "An ERP customer without an SAE - the zip codes decide until Performis has one." },
};

/** Words of a name, as Performis and HubSpot may each spell it: no accents, ö = oe, hyphens split. */
function words(s: string | null | undefined): string[] {
  return String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/oe/g, "o").replace(/ae/g, "a").replace(/ue/g, "u")
    .split(/[\s,;-]+/).filter((w) => w.length > 1);
}
const overlap = (a: string, b: string) => { const bw = new Set(words(b)); return words(a).filter((w) => bw.has(w)).length; };
/** "Jeremy Borey" -> "Borey Jeremy": how Performis writes a person. */
export const performisName = (name: string) => { const w = name.trim().split(/\s+/); return w.length > 1 ? `${w[w.length - 1]} ${w.slice(0, -1).join(" ")}` : name.trim(); };

export type Spelling = { ok: Set<string>; best: string };
/**
 * Per person, the SAE values of the table that name them (any word of their name: "Borey Jeremy", "Höhn Hans-Peter") and
 * the one to write; a value that names nobody of them ("ESO CH GER", "WIESTE", "Alioua Yani" for Jeremy) is another
 * name. A person whose values name none of them: every value is fine, the first one is written.
 */
export function spellings(rules: AssignRules, name: (o: OwnerId) => string): Map<string, Spelling> {
  const by = new Map<string, string[]>();
  for (const [sae, o] of Object.entries(rules.sae)) { const k = String(o); by.set(k, [...(by.get(k) ?? []), sae]); }
  const out = new Map<string, Spelling>();
  for (const [o, keys] of by) {
    const scored = keys.map((k) => [k, overlap(k, name(o))] as const);
    const named = scored.filter(([, n]) => n > 0);
    const pool = named.length ? named : scored;
    const best = [...pool].sort((a, b) => b[1] - a[1])[0][0];
    out.set(o, { ok: new Set(pool.map(([k]) => saeKey(k))), best });
  }
  return out;
}

export type WrongFacts = { sae: string | null; erpId: string | null; country: string | null; decided: OwnerId; flags?: string[] | null };
export type WrongFix = { reason: WrongReason; write: string };
/** What Performis should have for one company, or null when its SAE already names the person the rules give it (or it
 *  is no Performis customer - no ERP id). */
export function performisFix(c: WrongFacts, rules: AssignRules, sp: Map<string, Spelling>, name: (o: OwnerId) => string, active: (o: OwnerId) => boolean): WrongFix | null {
  if (!String(c.erpId ?? "").trim()) return null;
  const o = String(c.decided);
  const write = sp.get(o)?.best ?? performisName(name(o));
  const sae = String(c.sae ?? "").trim();
  const fix = (reason: WrongReason): WrongFix | null => (saeKey(sae) === saeKey(write) ? null : { reason, write });
  if (!sae) return { reason: "no-sae", write };
  const k = saeKey(sae);
  const hit = Object.entries(rules.sae).find(([x]) => saeKey(x) === k);
  if (!hit) return fix("unknown");
  const p = String(hit[1]);
  if (!active(p)) return fix("left");
  const rule = c.country ? rules.countries[c.country] : undefined;
  if (p === o) return sp.get(o) && !sp.get(o)!.ok.has(k) ? fix("alias") : null;
  if (Object.keys(rule?.saeOverride ?? {}).some((x) => saeKey(x) === k)) return fix("redirected");
  if ((c.flags ?? []).includes("not-in-country")) return fix("elsewhere");
  if (rule?.source === "map") return fix("rule2");
  return fix("other");
}

export type WrongRow = {
  id: string; name: string; erpId: string | null; country: string | null; zip: string | null;
  sae: string | null; write: string; reason: WrongReason; decided: OwnerId; ownerNow: OwnerId | null;
};
/** GET ?performisWrong=1: the counts (every country) and one page of the rows asked for. */
export type PerformisWrongData = {
  total: number;
  byReason: Partial<Record<WrongReason, number>>;
  byCountry: Record<string, number>;
  /** the rows of the filter, 50 a page, biggest reason first then by country and name */
  filtered: number; offset: number; rows: WrongRow[];
  /** companies whose owner or region in HubSpot differ from the rules (the export's second sheet) */
  wrongOwners: number;
};
