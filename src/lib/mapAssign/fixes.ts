// MAP ASSIGNMENT - corrections SARCLA asked for once the rules were his own (saved on the page 24.10.2026 14:49): the
// seed in the code no longer reaches the saved rules, so each correction is applied ONCE to the saved rules by the
// engine (engine.ts applyRuleFixes, at the start of a run, under its lock) and remembered by id in kv
// "mapAssign:fixes" - an edit made on the page afterwards is never overwritten. The seed (seed.ts) carries the same.
//
// Pure: tests use it as is.

import { saeKey, type AssignRules, type OwnerId } from "./rules";

const TSA = "1202569408", JEREMY = "29117550", CLAUDIO = "1229976033", JAMES = "38431796";

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

/** Who takes over from someone who has left - as the HubSpot redirection workflows move their tickets and tasks today
 *  (read 25.10.2026): SARCLA | STACHR TASK/TICKET REDIRECTION, FEHDIA | Paulina TASK/TICKET REDIRECTION (Paulina Bozek and
 *  Paulina Kulczyk), FEHDIA | NIBE TASK/TICKET REDIRECTION NEW RABE, Tasks/Tickets Andrea to Luca, Tasks reassignment
 *  PIRAHM to TSA (Ahmad Pirzad's Swiss tickets and tasks go to Claudio Saraiva by "Tasks CH"/"Tickets CH"; he owns no
 *  company - TSA Team, as the general one). */
export const SUCCESSORS_FROM_WORKFLOWS: Record<OwnerId, OwnerId> = {
  "32984810": TSA, // Christopher Stahl -> TSA Team (1,590 companies)
  "31218632": TSA, // Paulina Bozek -> TSA Team (1,016)
  "1229976038": TSA, // Paulina Kulczyk -> TSA Team
  "1229976034": "817647087", // Benjamin Nitschke -> Bernd Rausmann (1,272)
  "29285069": "1229999587", // Andrea Codognola -> Luca Fantasia
  "30795573": TSA, // Ahmad Pirzad -> TSA Team
};

/** Where each successor comes from - shown next to it on the SAE table tab. */
export const SUCCESSOR_SOURCE: Record<OwnerId, string> = {
  "32984810": "SARCLA | STACHR TASK / TICKET REDIRECTION",
  "31218632": "FEHDIA | Paulina TASK / TICKET REDIRECTION",
  "1229976038": "FEHDIA | Paulina TASK / TICKET REDIRECTION",
  "1229976034": "FEHDIA | NIBE TASK / TICKET REDIRECTION NEW RABE",
  "29285069": "Tasks / Tickets Andrea to Luca",
  "30795573": "Tasks reassignment PIRAHM to TSA (Swiss tickets and tasks: Tasks CH / Tickets CH to Claudio Saraiva)",
};

/** Zone names without the workflows' "(placeholder for ...)" (SARCLA 25.10.2026: "take out this comment"). */
export function withoutPlaceholders(r: AssignRules): AssignRules {
  const countries = Object.fromEntries(Object.entries(r.countries).map(([cc, rule]) => [cc, {
    ...rule, zones: rule.zones.map((z) => (z.label && /\(placeholder for [^)]*\)/i.test(z.label) ? { ...z, label: z.label.replace(/\s*\(placeholder for [^)]*\)/gi, "").trim() } : z)),
  }]));
  return { ...r, countries };
}

RULE_FIXES.push(
  // SARCLA 25.10.2026: "check all the workflow redirections - task, ticket and assignment - and put them"; "the rules
  // should be filled" (the SAE rows of Stahl / Nitschke / Bozek still read "keep Christopher Stahl")
  { id: "2026-10-25-successors", why: "who takes over from the people who have left (the HubSpot redirection workflows)", apply: (r) => ({ ...r, successors: { ...SUCCESSORS_FROM_WORKFLOWS, ...(r.successors ?? {}) } }) },
  { id: "2026-10-25-zone-labels", why: "zone names without \"(placeholder for ...)\"", apply: withoutPlaceholders },
);

/**
 * Owner redirection's two rules as overrides on the map (SARCLA 25.10.2026: "that page should not exist"; "the override
 * on the map is the redirection, nothing more"):
 *   France -> Jeremy Borey      every SAE, every zip zone, every key-account list and the rest of France to Jeremy -
 *                               except James Koeremez's SAE ("Köremez James", and Sandra's now), which stays with him
 *                               (SARCLA 25.10.2026: "the redirection was for all France outside of SAE James")
 *   Sandra Kuridza -> James     her SAE to James Koeremez, in every country (rule 2: "owned by Sandra -> James")
 * Each shows as an override in the France window and in the SAE table; change a row there to undo a part.
 */
export function withRedirectionsOnTheMap(r: AssignRules): AssignRules {
  let out = withSae(r, "Kuridza Sandra", JAMES);
  const fr = out.countries.FR;
  if (!fr) return out;
  // James's SAEs (the table gives them to him) keep him - no override on them at any level
  const james = new Set(Object.entries(out.sae).filter(([, o]) => String(o) === JAMES).map(([k]) => saeKey(k)));
  const toJeremy = (m: Record<string, OwnerId> | undefined) => Object.fromEntries(Object.keys(m ?? {}).filter((k) => !james.has(saeKey(k))).map((k) => [k, JEREMY]));
  const deep = (m: Record<string, Record<string, OwnerId>> | undefined) => (m ? Object.fromEntries(Object.entries(m).map(([k, t]) => [k, toJeremy(t)])) : undefined);
  // one entry per SAE of the table (whatever its spelling in the old override), plus the ones only France had
  const saeOverride = toJeremy(fr.saeOverride);
  for (const k of Object.keys(out.sae)) {
    if (james.has(saeKey(k))) continue;
    for (const x of Object.keys(saeOverride)) if (x !== k && saeKey(x) === saeKey(k)) delete saeOverride[x];
    saeOverride[k] = JEREMY;
  }
  const add = (list: OwnerId[] | undefined, o: OwnerId) => (list?.length && !list.map(String).includes(o) ? [...list, o] : list);
  const people = add(add(fr.people, JEREMY), JAMES);
  out = { ...out, countries: { ...out.countries, FR: {
    ...fr, saeOverride,
    ...(fr.saeOverrideByRegion ? { saeOverrideByRegion: deep(fr.saeOverrideByRegion) } : {}),
    ...(fr.saeOverrideByZip ? { saeOverrideByZip: deep(fr.saeOverrideByZip) } : {}),
    zones: fr.zones.map((z) => ({ ...z, owner: JEREMY })),
    ...(fr.keyAccounts ? { keyAccounts: fr.keyAccounts.map((k) => ({ ...k, owner: JEREMY })) } : {}),
    defaultOwner: JEREMY,
    ...(people ? { people } : {}),
  } } };
  return out;
}

/** The fix that carries Owner redirection's rules - once it is in the saved rules, Owner redirection is switched off. */
export const REDIRECTIONS_FIX = "2026-10-25-redirections-on-the-map";
RULE_FIXES.push({ id: REDIRECTIONS_FIX, why: "Owner redirection's rules on the map: France -> Jeremy Borey (James Koeremez's SAE stays his), SAE Kuridza Sandra -> James Koeremez", apply: withRedirectionsOnTheMap });

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
