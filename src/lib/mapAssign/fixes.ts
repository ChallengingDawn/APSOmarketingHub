// MAP ASSIGNMENT - corrections SARCLA asked for once the rules were his own (saved on the page 24.10.2026 14:49): the
// seed in the code no longer reaches the saved rules, so each correction is applied ONCE to the saved rules by the
// engine (engine.ts applyRuleFixes, at the start of a run, under its lock) and remembered by id in kv
// "mapAssign:fixes" - an edit made on the page afterwards is never overwritten. The seed (seed.ts) carries the same.
//
// Pure: tests use it as is.

import { saeKey, type AssignRules, type OwnerId } from "./rules";

const TSA = "1202569408", JEREMY = "29117550", CLAUDIO = "1229976033";

export type RuleFix = { id: string; why: string; apply: (r: AssignRules) => AssignRules };

/** One SAE value to one person, whatever its spelling in the table ("Alioua Yani" = "YANI ALIOUA"). */
export function withSae(r: AssignRules, sae: string, owner: OwnerId): AssignRules {
  const sae2 = Object.fromEntries(Object.entries(r.sae).filter(([k]) => saeKey(k) !== saeKey(sae)));
  return { ...r, sae: { ...sae2, [sae]: owner } };
}

/** An ERP id on a person's key-account list in one country - the first list of that person, or a new one. */
export function withKeyAccount(r: AssignRules, cc: string, owner: OwnerId, erp: string, label: string): AssignRules {
  const rule = r.countries[cc];
  if (!rule) return r;
  const keys = rule.keyAccounts ?? [];
  if (keys.some((k) => k.erpIds.includes(erp))) return r;
  const i = keys.findIndex((k) => String(k.owner) === owner);
  const next = i >= 0 ? keys.map((k, j) => (j === i ? { ...k, erpIds: [...k.erpIds, erp] } : k)) : [...keys, { owner, label, erpIds: [erp] }];
  return { ...r, countries: { ...r.countries, [cc]: { ...rule, keyAccounts: next } } };
}

export const RULE_FIXES: RuleFix[] = [
  // SARCLA 24.10.2026: "Resident APZ goes to TSA" (5 Swiss companies, no person in the table)
  { id: "2026-10-24-resident-apz", why: 'SAE "Resident APZ" -> TSA Team', apply: (r) => withSae(r, "Resident APZ", TSA) },
  // SARCLA 24.10.2026: "Yani Alioua's companies should all go to Jeremy" (29 with the SAE; the others have none and lie
  // in Jeremy's zip zone already)
  { id: "2026-10-24-yani-to-jeremy", why: 'SAE "Alioua Yani" -> Jeremy Borey', apply: (r) => withSae(r, "Alioua Yani", JEREMY) },
  // SARCLA 24.10.2026, the "SAE values with nobody": "these are mistakes and should be corrected" - the ones that name
  // a person who still works here go to that person (the others - regions, "None", numbers - stay with rule 2)
  {
    id: "2026-10-24-sae-names", why: "SAE values written as a person's name -> that person",
    apply: (r) => [["Sara Gashi", "30050251"], ["Leart Asllani", "37413486"], ["Claudio Gabinato", "1229976030"], ["Hans Peter Höhn", "1229976027"], ["Luca Fantasia", "1229999587"]]
      .reduce((x, [sae, o]) => withSae(x, sae, o), r),
  },
  // SARCLA 24.10.2026: "Rochat Industrie to add, it is still on my name" (ERP 788310, on his list in the seed - not in
  // the three he kept when he saved Switzerland)
  { id: "2026-10-24-ch-rochat", why: "Switzerland: Rochat Industrie SA (788310) on Claudio Saraiva's key accounts", apply: (r) => withKeyAccount(r, "CH", CLAUDIO, "788310", "Claudio Saraiva - key customers") },
];

/** The fixes not applied yet, applied in order; `done` = the ids applied before. */
export function applyFixes(rules: AssignRules, done: string[]): { rules: AssignRules; applied: RuleFix[] } {
  const seen = new Set(done);
  let out = rules;
  const applied: RuleFix[] = [];
  for (const f of RULE_FIXES) {
    if (seen.has(f.id)) continue;
    out = f.apply(out);
    applied.push(f);
  }
  return { rules: out, applied };
}
