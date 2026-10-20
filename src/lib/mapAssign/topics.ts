// MAP ASSIGNMENT - the differences grouped by WHY (SARCLA 20.10.2026, after "9,200 companies would change owner - TSA
// Team gets 7,892 ...": "Why these differences - it's where I get really lost. Let's do the first batch of difference
// logic so I can understand per topic and give my ok"). Every company whose owner, region responsibility or contacts
// differ from the saved rules goes into ONE topic, the first that fits, in TOPIC_ORDER. An OK is given per topic, for
// the topic as it is now; when its company count moves by more than 10% since, the page says so (the OK is kept).
//
// Pure: no database, no "@/" imports (tests compile without path aliases). The read and the kv answers: topicsDb.ts.
// GET /api/uc/map-assignment?topics=1[&country=CC] returns TopicsData; PUT {topicOk: {topic, ok}} answers one.

import type { OwnerId } from "./rules";

export type TopicId =
  | "no-country" | "left" | "region" | "contacts" | "sae-nobody" | "sae-elsewhere" | "rule1" | "rule2" | "key" | "redirection"
  /** never expected (the engine writes only the vias above) - so a company is never dropped from the counts */
  | "other";

/** First match wins, in this order; the page shows the topics in it too. */
export const TOPIC_ORDER: readonly TopicId[] = ["no-country", "left", "region", "contacts", "sae-nobody", "sae-elsewhere", "rule1", "rule2", "key", "redirection", "other"];
export const isTopicId = (v: unknown): v is TopicId => typeof v === "string" && (TOPIC_ORDER as readonly string[]).includes(v);

/** The plain title and the one sentence why, as the page shows them. */
export const TOPIC_TEXT: Record<TopicId, { title: string; why: string }> = {
  "no-country": {
    title: "No country in HubSpot: the default person takes them",
    why: "Neither Country nor Country (custom) is filled, so no zip-code map can apply: a known SAE person takes them, otherwise the default person. Filling the country in HubSpot fixes it.",
  },
  left: {
    title: "Their person has left HubSpot: the default person takes them",
    why: "The rules point to someone who is deactivated in HubSpot. Nothing is ever given to a person who left, so the default person takes them until the rules name someone new.",
  },
  region: {
    title: "Owner already right - only Region responsibility to fill",
    why: "The company owner is already the person the rules give. Only the Region responsibility field is empty or names someone else.",
  },
  contacts: {
    title: "Company right - its contacts follow",
    why: "Owner and Region responsibility are right on the company, but some of its contacts still have another owner, region or SAE. They follow their company.",
  },
  "sae-nobody": {
    title: "SAE with nobody in the table: the zip code decides (rule 2)",
    why: "Performis gives an SAE that the SAE table does not know, so the zip-code zone decides - or the default person when no zone fits.",
  },
  "sae-elsewhere": {
    title: "SAE person does not work this country: the zip code decides (rule 2)",
    why: "The SAE table names someone who does not work in this country, so the zip-code zone decides - or the default person when no zone fits.",
  },
  rule1: {
    title: "Rule 1: the Performis SAE gives another person than HubSpot has today",
    why: "The SAE from Performis, through the SAE table, names a different person than the company owner in HubSpot today.",
  },
  rule2: {
    title: "Rule 2: no SAE yet - the zip code gives another person",
    why: "No SAE (or the country goes by the map only): the zip-code zone names a different person than the owner today. No zone for the zip code = the country's default person.",
  },
  key: {
    title: "Key account: its own person",
    why: "The ERP customer is on a key-account list, so that list's person takes it - before the SAE and the zip code.",
  },
  redirection: {
    title: "Kept by an Owner redirection rule",
    why: "An Owner redirection rule you chose to keep over the map gives these companies to its own person.",
  },
  other: {
    title: "Something else differs",
    why: "These differ from the rules for a reason none of the topics above covers.",
  },
};

/** One stored company, as the topics need it (the engine's apsomh_map_assign row). */
export type TopicRow = {
  id: string; name: string | null; country: string | null; zip: string | null; sae: string | null;
  ownerNow: OwnerId | null; regionNow: OwnerId | null;
  /** owner_decided: the person the saved rules give */
  decided: OwnerId;
  /** "sae" rule 1, "zone" / "default" rule 2, "key", "redirection" */
  via: string;
  /** "sae-unmapped", "owner-deactivated", "no-country", "no-zip", "not-in-country" */
  flags: string[];
  /** contacts whose owner / region / SAE differ from the company's decided ones (null = not counted yet) */
  contactsOff: number | null;
  /** revenue this year (EUR), only to pick telling examples; null = unknown */
  revenue?: number | null;
};

/** Ids compared as text - HubSpot ids come back as numbers from kv and sometimes from pg. null = "" (nobody). */
const sameId = (a: unknown, b: unknown) => String(a ?? "") === String(b ?? "");
const off = (r: TopicRow) => Math.max(0, Number(r.contactsOff) || 0);

/** As the engine's SQL: owner_now IS DISTINCT FROM owner_decided OR region_now IS DISTINCT FROM owner_decided OR contacts_off > 0. */
export function differs(r: TopicRow): boolean {
  return !sameId(r.ownerNow, r.decided) || !sameId(r.regionNow, r.decided) || off(r) > 0;
}

/** The company's topic - the first that fits, in TOPIC_ORDER; null when nothing differs. */
export function topicOf(r: TopicRow): TopicId | null {
  if (!differs(r)) return null;
  const flags = r.flags ?? [];
  if (!String(r.country ?? "").trim()) return "no-country";
  if (flags.includes("owner-deactivated")) return "left";
  const ownerRight = sameId(r.ownerNow, r.decided);
  if (ownerRight && !sameId(r.regionNow, r.decided)) return "region";
  if (ownerRight) return "contacts"; // owner and region right: it differs by its contacts only
  if (flags.includes("sae-unmapped")) return "sae-nobody";
  if (flags.includes("not-in-country")) return "sae-elsewhere";
  switch (r.via) {
    case "sae": return "rule1";
    case "zone": case "default": return "rule2";
    case "key": return "key";
    case "redirection": return "redirection";
    default: return "other";
  }
}

/* ── the OK answers ── */

/** An OK as stored (kv "mapAssign:topicsOk" -> {[topic]: TopicOk}): when, who, and the topic's companies (every
 *  country) at that moment. */
export type TopicOk = { at: string; by: string; companies: number };
/** More than this share up or down since the OK: "changed since your OK". */
export const OK_DRIFT = 0.1;

/** The topic moved by more than 10% (of the count at the OK) since the OK was given. */
export function changedSinceOk(okCompanies: number, now: number): boolean {
  const then = Math.max(0, Number(okCompanies) || 0);
  if (then === 0) return now > 0;
  return Math.abs(now - then) > then * OK_DRIFT;
}

/** The kv value, cleaned: known topics only, text where text is meant (kv parses JSON - "123" comes back a number). */
export function cleanOks(raw: unknown): Partial<Record<TopicId, TopicOk>> {
  const out: Partial<Record<TopicId, TopicOk>> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isTopicId(k) || !v || typeof v !== "object") continue;
    const x = v as { at?: unknown; by?: unknown; companies?: unknown };
    const companies = Number(x.companies);
    if (!x.at || !Number.isFinite(companies)) continue;
    out[k] = { at: String(x.at), by: String(x.by ?? ""), companies: Math.max(0, Math.round(companies)) };
  }
  return out;
}

/* ── what the page gets ── */

/** Owner now -> owner by the rules (the region topic: region responsibility now -> the owner; the contacts topic: the
 *  owner, from = to). */
export type TopicMove = { from: OwnerId | null; to: OwnerId; companies: number; contacts: number };
export type TopicExample = {
  id: string; name: string; country: string | null; zip: string | null; sae: string | null;
  from: OwnerId | null; to: OwnerId;
  /** its contacts that follow */
  contacts: number;
};
export type TopicStat = {
  topic: TopicId; title: string; why: string;
  /** what `moves` and the examples' from / to mean: the owner changes, the region responsibility is filled, or only
   *  the contacts follow (from = to) */
  kind: "owner" | "region" | "contacts";
  /** in the country asked for (all countries when none) */
  companies: number; contacts: number;
  /** the topic in every country - what an OK covers */
  all: number;
  /** country -> companies, most first ("??" = no country) */
  countries: { country: string; companies: number }[];
  /** the biggest moves (at most 8), and what is left besides them */
  moves: TopicMove[];
  more: { moves: number; companies: number };
  /** 5 examples, one from each of the biggest moves in turn, biggest customers first */
  examples: TopicExample[];
  /** the OK, if any: `changed` = the topic moved by more than 10% since (the OK is kept, the page flags it) */
  ok: (TopicOk & { changed: boolean }) | null;
};
export type TopicsData = {
  /** the last scan */
  at: string | null;
  /** the filter: a country code, "??" (no country) or null (every country) */
  country: string | null;
  /** every country with a difference, most first - the filter's pills (not narrowed by the filter) */
  countries: { country: string; companies: number; changeOwner: number }[];
  /** in the filter: companies that differ, their contacts, and how many of them change owner */
  total: { companies: number; contacts: number; changeOwner: number };
  /** non-empty topics only, in TOPIC_ORDER */
  topics: TopicStat[];
};
/** PUT body: an OK for one topic (ok: false takes it back); `country` only picks what the answer's data shows. */
export type TopicOkPut = { topicOk: { topic: TopicId; ok: boolean; country?: string | null } };

/** The engine's mark for a company whose country cannot be read (engine.ts NO_COUNTRY). */
export const NO_COUNTRY = "??";
const ccOf = (r: TopicRow) => (String(r.country ?? "").trim() ? String(r.country).trim().toUpperCase() : NO_COUNTRY);
const MOVES_SHOWN = 8;
const EXAMPLES = 5;

const kindOf = (t: TopicId): TopicStat["kind"] => (t === "region" ? "region" : t === "contacts" ? "contacts" : "owner");

/** Each topic's companies in every country - what an OK is given on and compared with. */
export function topicCounts(rows: TopicRow[]): Partial<Record<TopicId, number>> {
  const out: Partial<Record<TopicId, number>> = {};
  for (const r of rows) { const t = topicOf(r); if (t) out[t] = (out[t] ?? 0) + 1; }
  return out;
}

/**
 * The topics, from the differing rows (rows that do not differ are skipped): per topic in the country asked for
 * (null / "" = every country, "??" = no country) the companies, their contacts, the countries, the biggest moves
 * and 5 examples; the OK answers with their "changed since" flag (on the topic's count over every country).
 */
export function buildTopics(rows: TopicRow[], opts: { country?: string | null; oks?: Partial<Record<TopicId, TopicOk>>; at?: string | null } = {}): TopicsData {
  const want = String(opts.country ?? "").trim().toUpperCase() || null;
  const oks = opts.oks ?? {};
  const all: Partial<Record<TopicId, number>> = {};
  const byCountry = new Map<string, { companies: number; changeOwner: number }>();
  const groups = new Map<TopicId, { row: TopicRow; from: OwnerId | null }[]>();
  const total = { companies: 0, contacts: 0, changeOwner: 0 };
  for (const r of rows) {
    const t = topicOf(r);
    if (!t) continue;
    all[t] = (all[t] ?? 0) + 1;
    const cc = ccOf(r);
    const moves = !sameId(r.ownerNow, r.decided);
    const c = byCountry.get(cc) ?? { companies: 0, changeOwner: 0 };
    c.companies += 1; if (moves) c.changeOwner += 1;
    byCountry.set(cc, c);
    if (want && cc !== want) continue;
    total.companies += 1; total.contacts += off(r); if (moves) total.changeOwner += 1;
    const g = groups.get(t) ?? [];
    g.push({ row: r, from: t === "region" ? (r.regionNow ?? null) : (r.ownerNow ?? null) });
    groups.set(t, g);
  }

  const topics: TopicStat[] = [];
  for (const t of TOPIC_ORDER) {
    const g = groups.get(t);
    if (!g?.length) continue;
    const countries = new Map<string, number>();
    const moves = new Map<string, TopicMove & { rows: TopicRow[] }>();
    let contacts = 0;
    for (const { row, from } of g) {
      contacts += off(row);
      const cc = ccOf(row);
      countries.set(cc, (countries.get(cc) ?? 0) + 1);
      const key = `${String(from ?? "")}>${String(row.decided)}`;
      let m = moves.get(key);
      if (!m) { m = { from: from === null || from === undefined || from === "" ? null : String(from), to: String(row.decided), companies: 0, contacts: 0, rows: [] }; moves.set(key, m); }
      m.companies += 1; m.contacts += off(row); m.rows.push(row);
    }
    const sorted = [...moves.values()].sort((a, b) => b.companies - a.companies || b.contacts - a.contacts || `${a.from ?? ""}>${a.to}`.localeCompare(`${b.from ?? ""}>${b.to}`));
    const shown = sorted.slice(0, MOVES_SHOWN);
    const rest = sorted.slice(MOVES_SHOWN);

    // examples: one from each of the biggest moves in turn, the biggest customer of the move first, then by name
    const pools = sorted.slice(0, EXAMPLES).map((m) => ({
      m, rows: [...m.rows].sort((a, b) => (Number(b.revenue) || 0) - (Number(a.revenue) || 0) || String(a.name ?? "").localeCompare(String(b.name ?? "")) || String(a.id).localeCompare(String(b.id))),
    }));
    const examples: TopicExample[] = [];
    for (let i = 0; examples.length < EXAMPLES && pools.some((p) => p.rows.length > i); i++) {
      for (const p of pools) {
        if (examples.length >= EXAMPLES) break;
        const r = p.rows[i];
        if (!r) continue;
        examples.push({ id: String(r.id), name: r.name?.trim() || `Company ${r.id}`, country: r.country, zip: r.zip, sae: r.sae, from: p.m.from, to: p.m.to, contacts: off(r) });
      }
    }

    const ok = oks[t];
    const now = all[t] ?? 0;
    topics.push({
      topic: t, ...TOPIC_TEXT[t], kind: kindOf(t),
      companies: g.length, contacts, all: now,
      countries: [...countries].map(([country, companies]) => ({ country, companies })).sort((a, b) => b.companies - a.companies || a.country.localeCompare(b.country)),
      moves: shown.map(({ from, to, companies, contacts: n }) => ({ from, to, companies, contacts: n })),
      more: { moves: rest.length, companies: rest.reduce((a, m) => a + m.companies, 0) },
      examples,
      ok: ok ? { ...ok, changed: changedSinceOk(ok.companies, now) } : null,
    });
  }

  return {
    at: opts.at ?? null,
    country: want,
    countries: [...byCountry].map(([country, v]) => ({ country, ...v })).sort((a, b) => b.companies - a.companies || a.country.localeCompare(b.country)),
    total,
    topics,
  };
}
