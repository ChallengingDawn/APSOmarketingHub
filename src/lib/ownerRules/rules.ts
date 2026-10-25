// OWNER REDIRECTION - the rules, and nothing but the rules (pure: no I/O, tested).
//
// SARCLA, 12.10.2026: "migrate this app to the marketing HUB as a hubspot app and allow
// more redirects - basically adding a user and redirecting towards another - and then we
// can delete france owners". It replaces the HubSpot project sarcla-france-owner, whose
// one rule (a French company belongs to Jeremy Borey, and so do its contacts, open
// tickets and open tasks) is rule 1 here, unchanged.
//
// An ordered list, the first rule that matches wins:
//   country  the company's country is one of a list (any case; country_custom too, with
//            its own list) -> the company goes to an owner, and so do ALL its contacts,
//            open tickets and open tasks, whoever owned them (as the France app did)
//   owner    the company is owned by a person (who left or moved) -> it goes to another,
//            and only the contacts, open tickets and open tasks THAT person owned follow
// Tickets: only the sales pipelines ESO and TSA ever follow (CASCADE_TICKET_PIPELINES);
// Back Office, GQS and every other pipeline keep their owner (SARCLA 19.10.2026).
// Both write hubspot_owner_id AND region_responsibility (the ownership workflow copies
// region_responsibility into the owner ~1 s later, so writing only the owner would be
// reverted), and only what differs - so the write's own webhook finds nothing to do and
// it stops after two events. A company no rule matches is left alone: leaving France does
// not hand a company back.
//
// The SAME logic runs in two places, which must agree to the letter:
//   - the HubSpot app function (hubspot-apsomarketinghub, ownerRedirection.js) - the
//     instant reaction to a webhook; a port of this file in plain JavaScript
//   - the hub's 15-minute safety net (sweep.ts)
// Both read the rules from the one document the hub publishes to HubSpot (hubspot.ts),
// never from anywhere else - so they cannot disagree about which rules are on.

import { createHash } from "node:crypto";

export const DOC_KIND = "apsohub.owner_redirection";
export const DOC_VERSION = 1;
/** The KPI custom object's record that carries the published rules (see hubspot.ts). */
export const KPI_OBJECT = "2-201387076";
/** Letters and underscores only: found with an exact-match search, which must not trip over punctuation. */
export const RECORD_NAME = "apsohub_owner_redirection_rules";
export const DOC_PROPERTY = "apsohub_config_json";
/** HubSpot holds 65,536 characters in a text property; stay well under it. */
export const MAX_DOC_CHARS = 60_000;
export const MAX_RULES = 50;
/** How many owner hand-overs one company may chain through before it counts as a loop. */
const MAX_STEPS = 8;

export type Cascade = { contacts: boolean; tickets: boolean; tasks: boolean };
export const FULL_CASCADE: Cascade = { contacts: true, tickets: true, tasks: true };
export const CHILD_TYPES = ["contacts", "tickets", "tasks"] as const;
export type ChildType = (typeof CHILD_TYPES)[number];

type Base = { id: string; enabled: boolean; toOwner: string; cascade: Cascade; note: string };
export type CountryRule = Base & { kind: "country"; countries: string[]; customCountries: string[] };
export type OwnerRule = Base & { kind: "owner"; fromOwner: string };
/** A rule as the hub keeps and edits it. */
export type Rule = CountryRule | OwnerRule;

/** A rule as published to HubSpot: enabled ones only, no note, keys in a fixed order. */
export type PubRule =
  | { id: string; kind: "country"; countries: string[]; customCountries: string[]; toOwner: string; cascade: Cascade }
  | { id: string; kind: "owner"; fromOwner: string; toOwner: string; cascade: Cascade };

export type Doc = {
  kind: typeof DOC_KIND;
  version: typeof DOC_VERSION;
  publishedAt: string;
  publishedBy: string;
  rules: PubRule[];
  /** sha256 of JSON.stringify(rules) - a hand edit or a cut-off value is refused, never guessed at. */
  hash: string;
};

/** Today's France app, exactly: country France or FR (any case), or country_custom France -> Jeremy Borey. */
export const JEREMY_BOREY = "29117550";
export const SEED_RULE: CountryRule = {
  id: "france", enabled: true, kind: "country",
  countries: ["France", "FR"], customCountries: ["France"],
  toOwner: JEREMY_BOREY, cascade: { ...FULL_CASCADE },
  note: "French customers belong to Jeremy Borey - the rule of the old HubSpot app sarcla-france-owner (live since 01.09.2026).",
};

/**
 * The redirections of the people who have left, as the HubSpot workflows run them today (read 25.10.2026) - SARCLA
 * 25.10.2026: "STACHR (Stahl -> TSA), Paulina (Bozek -> TSA), NIBE NEW RABE (Nitschke -> Bernd Rausmann), Andrea to Luca,
 * PIRAHM (Pirzad -> TSA): this we should bring as overrides on the hub". Owner rules with the full cascade; for someone
 * who has left the sweep also moves every open ticket and task they still own (sweep.ts leavers), as those workflows
 * did. Added once to the hub's rules (store.ts), NOT published - Publish on the page puts them to work.
 */
export const TSA_TEAM = "1202569408";
export const LEAVER_RULES: OwnerRule[] = [
  { id: "leaver-stahl", enabled: true, kind: "owner", fromOwner: "32984810", toOwner: TSA_TEAM, cascade: { ...FULL_CASCADE },
    note: "Christopher Stahl has left: his companies, contacts, open tickets and tasks go to TSA Team - as SARCLA | STACHR TASK / TICKET REDIRECTION did." },
  { id: "leaver-bozek", enabled: true, kind: "owner", fromOwner: "31218632", toOwner: TSA_TEAM, cascade: { ...FULL_CASCADE },
    note: "Paulina Bozek has left: her companies, contacts, open tickets and tasks go to TSA Team - as FEHDIA | Paulina TASK / TICKET REDIRECTION did." },
  { id: "leaver-kulczyk", enabled: true, kind: "owner", fromOwner: "1229976038", toOwner: TSA_TEAM, cascade: { ...FULL_CASCADE },
    note: "Paulina Kulczyk has left: her open tickets and tasks go to TSA Team - as FEHDIA | Paulina TASK / TICKET REDIRECTION did." },
  { id: "leaver-nitschke", enabled: true, kind: "owner", fromOwner: "1229976034", toOwner: "817647087", cascade: { ...FULL_CASCADE },
    note: "Benjamin Nitschke has left: his companies, contacts, open tickets and tasks go to Bernd Rausmann - as FEHDIA | NIBE TASK / TICKET REDIRECTION NEW RABE did." },
  { id: "leaver-codognola", enabled: true, kind: "owner", fromOwner: "29285069", toOwner: "1229999587", cascade: { ...FULL_CASCADE },
    note: "Andrea Codognola has left: her open tickets and tasks go to Luca Fantasia - as Tasks / Tickets Andrea to Luca did." },
  { id: "leaver-pirzad", enabled: true, kind: "owner", fromOwner: "30795573", toOwner: TSA_TEAM, cascade: { ...FULL_CASCADE },
    note: "Ahmad Pirzad has left: his open tickets and tasks go to TSA Team - as Tasks reassignment PIRAHM to TSA did (Tasks CH / Tickets CH gave the Swiss ones to Claudio Saraiva)." },
];

/** The company properties the rules read. */
export type CompanyProps = {
  country?: string | null;
  country_custom?: string | null;
  hubspot_owner_id?: string | null;
  region_responsibility?: string | null;
};
export const COMPANY_PROPS = ["name", "country", "country_custom", "hubspot_owner_id", "region_responsibility"] as const;

export const norm = (s: unknown): string => String(s ?? "").trim().toLowerCase();

/**
 * A HubSpot record id as text. The hub's kv store parses what it holds as JSON, so the
 * id "455649266923" it was given comes back as the NUMBER 455649266923 - and a number
 * is never === the same id as text (12.10.2026: the second publish took its own record
 * for a duplicate and archived it).
 */
export const recordIdOf = (id: unknown): string | null =>
  id === null || id === undefined || String(id).trim() === "" ? null : String(id).trim();

/** The records the search found that are NOT the one just written - duplicates to archive. */
export function otherRecords(found: unknown[], keep: unknown): string[] {
  const k = recordIdOf(keep);
  return found.map(recordIdOf).filter((x): x is string => x !== null && x !== k);
}
const own = (s: unknown): string => String(s ?? "").trim();
const OWNER_ID = /^\d{1,20}$/;
const RULE_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

/* ── shape ─────────────────────────────────────────────────────────────── */

function cleanList(v: unknown, max: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") return null;
    const t = x.trim();
    if (!t) continue;
    if (t.length > 60) return null;
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.length <= max ? out : null;
}

function cleanCascade(v: unknown): Cascade | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  if (typeof c.contacts !== "boolean" || typeof c.tickets !== "boolean" || typeof c.tasks !== "boolean") return null;
  return { contacts: c.contacts, tickets: c.tickets, tasks: c.tasks };
}

/**
 * A rule as the page sends it -> a clean rule, or what is wrong with it. Countries are
 * trimmed and de-duplicated (any case); an empty country list is refused.
 */
export function checkRule(input: unknown): { ok: true; rule: Rule } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "No rule." };
  const r = input as Record<string, unknown>;
  const id = String(r.id ?? "");
  if (!RULE_ID.test(id)) return { ok: false, error: "The rule has no valid id." };
  const enabled = r.enabled !== false;
  const toOwner = own(r.toOwner);
  if (!OWNER_ID.test(toOwner)) return { ok: false, error: "Choose who the companies go to." };
  const cascade = cleanCascade(r.cascade ?? FULL_CASCADE);
  if (!cascade) return { ok: false, error: "Contacts, open tickets and open tasks must each be on or off." };
  const note = String(r.note ?? "").trim();
  if (note.length > 500) return { ok: false, error: "The note is longer than 500 characters." };
  if (r.kind === "country") {
    const countries = cleanList(r.countries ?? [], 40);
    const customCountries = cleanList(r.customCountries ?? [], 40);
    if (!countries || !customCountries) return { ok: false, error: "Countries: at most 40, each at most 60 characters." };
    if (!countries.length && !customCountries.length) return { ok: false, error: "Name at least one country." };
    return { ok: true, rule: { id, enabled, kind: "country", countries, customCountries, toOwner, cascade, note } };
  }
  if (r.kind === "owner") {
    const fromOwner = own(r.fromOwner);
    if (!OWNER_ID.test(fromOwner)) return { ok: false, error: "Choose whose companies move." };
    if (fromOwner === toOwner) return { ok: false, error: "A person's companies cannot go to the same person." };
    return { ok: true, rule: { id, enabled, kind: "owner", fromOwner, toOwner, cascade, note } };
  }
  return { ok: false, error: "A rule is either by country or by owner." };
}

/** The published form of a rule - fixed key order, so the hash is the same wherever it is computed. */
export function toPub(r: Rule | PubRule): PubRule {
  const cascade = { contacts: !!r.cascade.contacts, tickets: !!r.cascade.tickets, tasks: !!r.cascade.tasks };
  return r.kind === "country"
    ? { id: r.id, kind: "country", countries: [...r.countries], customCountries: [...r.customCountries], toOwner: r.toOwner, cascade }
    : { id: r.id, kind: "owner", fromOwner: r.fromOwner, toOwner: r.toOwner, cascade };
}

export const publishedRules = (rules: Rule[]): PubRule[] => rules.filter((r) => r.enabled).map(toPub);
export const rulesHash = (rules: PubRule[]): string => createHash("sha256").update(JSON.stringify(rules), "utf8").digest("hex");

export function buildDoc(rules: Rule[], publishedBy: string, publishedAt: string): Doc {
  const pub = publishedRules(rules);
  return { kind: DOC_KIND, version: DOC_VERSION, publishedAt, publishedBy, rules: pub, hash: rulesHash(pub) };
}

/**
 * The published document, read back from HubSpot -> the rules, or why they cannot be
 * trusted. Anything unexpected is refused: the caller then does NOTHING (it never
 * falls back to a guess, an older copy or a default).
 */
export function parseDoc(raw: unknown): { ok: true; doc: Doc } | { ok: false; error: string } {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "no rules published" };
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "the published rules are not valid JSON" };
  }
  if (!d || typeof d !== "object" || d.kind !== DOC_KIND) return { ok: false, error: "not an owner-redirection document" };
  if (d.version !== DOC_VERSION) return { ok: false, error: `document version ${String(d.version)} is not ${DOC_VERSION}` };
  if (!Array.isArray(d.rules) || d.rules.length > MAX_RULES) return { ok: false, error: "the rule list is missing or too long" };
  if (typeof d.hash !== "string" || rulesHash(d.rules as PubRule[]) !== d.hash) return { ok: false, error: "the rules do not match their checksum (edited by hand, or cut off)" };
  const rules: PubRule[] = [];
  const ids = new Set<string>();
  for (const x of d.rules as unknown[]) {
    const c = checkRule({ ...(x as object), enabled: true, note: "" });
    if (!c.ok) return { ok: false, error: `a published rule is invalid: ${c.error}` };
    if (ids.has(c.rule.id)) return { ok: false, error: `rule id ${c.rule.id} is there twice` };
    ids.add(c.rule.id);
    rules.push(toPub(c.rule));
  }
  if (rulesHash(rules) !== d.hash) return { ok: false, error: "the rules are not in their canonical form" };
  return { ok: true, doc: { kind: DOC_KIND, version: DOC_VERSION, publishedAt: String(d.publishedAt ?? ""), publishedBy: String(d.publishedBy ?? ""), rules, hash: d.hash } };
}

/* ── matching ──────────────────────────────────────────────────────────── */

export function matches(r: PubRule, c: CompanyProps): boolean {
  if (r.kind === "owner") return own(c.hubspot_owner_id) === r.fromOwner;
  const country = norm(c.country);
  if (country && r.countries.some((x) => norm(x) === country)) return true;
  const custom = norm(c.country_custom);
  return !!custom && r.customCountries.some((x) => norm(x) === custom);
}

/** The first rule that matches, or null. */
export function decide(c: CompanyProps, rules: PubRule[]): PubRule | null {
  for (const r of rules) if (matches(r, c)) return r;
  return null;
}

/** Which of a company's children follow it: all of them, those of these owners, or none. */
export type ChildFilter = "all" | "none" | string[];
export type Filters = Record<ChildType, ChildFilter>;

export type Resolution =
  | { kind: "none" }
  | { kind: "loop"; chain: string[]; owners: string[] }
  | {
      kind: "apply";
      /** The owner the company ends on. */
      to: string;
      /** The rules that took it there, first match first (rule ids). */
      chain: string[];
      /** The first rule that matched - the one a correction is counted under. */
      rule: string;
      /** What to write on the company - only what differs. Empty = the company is already right. */
      changes: Record<string, string>;
      filters: Filters;
      /**
       * True when the company still matches a rule once it is on `to` (a country rule):
       * the company is written first, as the France app did, and a retry finds it again.
       * False for a pure owner hand-over: the children go FIRST and the company last, so a
       * failure half-way leaves the company on the old owner and the retry (or the sweep)
       * starts over - written first, a failed cascade would never be found again.
       */
      companyFirst: boolean;
    };

/**
 * Where a company ends up, following the rules as far as they go: owner A -> B, then
 * B -> C, until no rule moves it any more (its own write's webhook then finds nothing to
 * do). A chain that comes back to an owner it already left is a loop: nothing is done.
 */
export function resolve(c: CompanyProps, rules: PubRule[]): Resolution {
  let owner = own(c.hubspot_owner_id);
  const seen = new Set<string>([owner]);
  const chain: PubRule[] = [];
  let settled = false;
  for (let step = 0; step <= MAX_STEPS; step++) {
    const r = decide({ ...c, hubspot_owner_id: owner }, rules);
    if (!r) break;
    if (chain[chain.length - 1] !== r) chain.push(r);
    if (r.toOwner === owner) {
      settled = true;
      break;
    }
    if (seen.has(r.toOwner) || step === MAX_STEPS) return { kind: "loop", chain: chain.map((x) => x.id), owners: [...seen, r.toOwner] };
    seen.add(r.toOwner);
    owner = r.toOwner;
  }
  if (!chain.length) return { kind: "none" };
  const changes: Record<string, string> = {};
  if (own(c.hubspot_owner_id) !== owner) changes.hubspot_owner_id = owner;
  if (own(c.region_responsibility) !== owner) changes.region_responsibility = owner;
  const filters = {} as Filters;
  for (const t of CHILD_TYPES) {
    if (chain.some((r) => r.kind === "country" && r.cascade[t])) filters[t] = "all";
    else {
      const from = [...new Set(chain.filter((r): r is Extract<PubRule, { kind: "owner" }> => r.kind === "owner" && r.cascade[t]).map((r) => r.fromOwner))];
      filters[t] = from.length ? from : "none";
    }
  }
  return { kind: "apply", to: owner, chain: chain.map((r) => r.id), rule: chain[0].id, changes, filters, companyFirst: settled };
}

/** Does a child (contact, open ticket, open task) with this owner move to `to`? */
export function childMoves(childOwner: unknown, filter: ChildFilter, to: string): boolean {
  const o = own(childOwner);
  if (filter === "none" || o === to) return false;
  return filter === "all" || filter.includes(o);
}

/**
 * The ONLY ticket pipelines a company's owner change may move tickets in: the sales
 * pipelines ESO (1726599376) and TSA (1726599377). Every other pipeline - Back Office
 * 1726786777, GQS 1726786775, Special Prices Requests 1553929403, Product Management
 * 1737150687, chat 0 and any pipeline added later - belongs to the Back Office or its own
 * team, and its tickets keep their owner whoever owns the company.
 *
 * SARCLA, 19.10.2026 - the wrong-owner loop: the ERP chain's customer_agents step changed
 * the owner of 230 companies at 08:41; this cascade then gave Back Office ticket
 * 436617700592 the company's sales owner (Jeremy Borey), and ten minutes later the
 * wrong_owners sweep saw a sales person owning a Back Office ticket and moved it to ESO
 * as "WRONG OWNER PLEASE CORRECT IT". An allow-list, not a deny-list: a new pipeline is
 * left alone until someone decides it follows the company.
 *
 * The HubSpot app function (ownerRedirection.js) holds the same list - keep them equal.
 */
export const CASCADE_TICKET_PIPELINES: readonly string[] = ["1726599376", "1726599377"];

/** The ticket properties ticketMoves reads. */
export const TICKET_PROPS = ["hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id"] as const;
export type TicketProps = { hs_pipeline?: string | null; hs_pipeline_stage?: string | null; hubspot_owner_id?: string | null };

/**
 * Does this ticket follow its company to `to`? Only when it is in a sales pipeline
 * (CASCADE_TICKET_PIPELINES), still open (its stage is not one of `closedStages`), and
 * childMoves says its owner goes. A ticket whose pipeline is unknown (not read) stays.
 */
export function ticketMoves(t: TicketProps, closedStages: ReadonlySet<string>, filter: ChildFilter, to: string): boolean {
  if (!CASCADE_TICKET_PIPELINES.includes(own(t.hs_pipeline))) return false;
  if (closedStages.has(own(t.hs_pipeline_stage))) return false;
  return childMoves(t.hubspot_owner_id, filter, to);
}

/** Companies that are handled together: the same target, order and cascade. */
export const groupKey = (r: Extract<Resolution, { kind: "apply" }>): string =>
  `${r.to}|${r.companyFirst ? 1 : 0}|${CHILD_TYPES.map((t) => (Array.isArray(r.filters[t]) ? (r.filters[t] as string[]).join(",") : r.filters[t])).join("|")}`;

/* ── the list as a whole ───────────────────────────────────────────────── */

/**
 * What is wrong with a list of rules (errors: it is not saved) and what may surprise
 * (warnings: saved, shown on the page). The loop check tries every country the rules
 * name (and none of them) with every owner they name (and an unowned company): any start
 * that does not settle is two rules handing companies back and forth for ever.
 */
export function ruleSetProblems(rules: Rule[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const label = new Map(rules.map((r, i) => [r.id, `rule ${i + 1}`]));
  const name = (id: string) => label.get(id) ?? id;
  if (rules.length > MAX_RULES) errors.push(`At most ${MAX_RULES} rules.`);
  const ids = new Set<string>();
  for (const r of rules) {
    if (ids.has(r.id)) errors.push(`Rule id ${r.id} is there twice.`);
    ids.add(r.id);
  }
  const on = publishedRules(rules);
  if (JSON.stringify(on).length > MAX_DOC_CHARS - 500) errors.push("The rules are too long to publish to HubSpot.");

  const owners = new Set<string>(["", "0"]);
  for (const r of on) {
    owners.add(r.toOwner);
    if (r.kind === "owner") owners.add(r.fromOwner);
  }
  const places: CompanyProps[] = [{ country: "", country_custom: "" }];
  for (const r of on) {
    if (r.kind !== "country") continue;
    for (const x of r.countries) places.push({ country: x });
    for (const x of r.customCountries) places.push({ country_custom: x });
  }
  const loops = new Set<string>();
  const at = new Map(rules.map((r, i) => [r.id, i]));
  for (const p of places) {
    for (const o of owners) {
      const res = resolve({ ...p, hubspot_owner_id: o }, on);
      // the same pair of rules, whichever end it starts from, is one message
      if (res.kind === "loop") loops.add([...new Set(res.chain)].sort((a, b) => (at.get(a) ?? 0) - (at.get(b) ?? 0)).map(name).join(" and "));
    }
  }
  for (const l of loops) errors.push(`${l[0].toUpperCase()}${l.slice(1)} would hand companies back and forth for ever - change one of them.`);

  // rules that can never apply: everything they match is taken by an earlier rule
  for (let i = 0; i < on.length; i++) {
    const r = on[i];
    const before = on.slice(0, i);
    if (r.kind === "country") {
      const taken = new Set(before.flatMap((b) => (b.kind === "country" ? b.countries.map(norm) : [])));
      const takenCustom = new Set(before.flatMap((b) => (b.kind === "country" ? b.customCountries.map(norm) : [])));
      if (r.countries.every((x) => taken.has(norm(x))) && r.customCountries.every((x) => takenCustom.has(norm(x)))) {
        warnings.push(`${name(r.id)} never applies: the rules before it already take all its countries.`);
      }
    } else if (before.some((b) => b.kind === "owner" && b.fromOwner === r.fromOwner)) {
      warnings.push(`${name(r.id)} never applies: a rule before it already moves the same person's companies.`);
    } else {
      const kept = before.filter((b) => b.kind === "country" && b.toOwner === r.fromOwner);
      if (kept.length) warnings.push(`${name(r.id)} does not move the companies ${kept.map((b) => name(b.id)).join(" and ")} give${kept.length === 1 ? "s" : ""} to the same person - ${kept.length === 1 ? "that rule comes" : "those rules come"} first.`);
    }
  }
  return { errors, warnings };
}

/** A new rule's id: short, lower-case, unique in the list. */
export function newRuleId(existing: Iterable<string>, random: () => string): string {
  const taken = new Set(existing);
  for (let i = 0; i < 20; i++) {
    const id = `r-${random().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)}`;
    if (id.length > 4 && !taken.has(id)) return id;
  }
  throw new Error("could not make a rule id");
}
