// THE TICKET STEPS' RULES, with no HubSpot in them - ported line for line from the
// Compass connector (service/wrong_owners.py, deputy_sweep.py, ticket_assoc.py,
// 08.10.2026) so the hub decides every ticket the same way. Where Python's string
// semantics decide anything they are kept: slicing and sorting by code point, its
// whitespace for strip(), its Unicode \d \w \b and its re.I. Relative imports only:
// tests/connectors-tickets.test.ts holds these to it; the I/O is in ./tickets.ts.

export type Props = Record<string, string | null | undefined>;

/* ── Python string semantics ───────────────────────────────────────────── */

// str.isspace(): Python counts \x1c-\x1f and \x85, JavaScript counts ﻿ instead
const PY_WS = "\\t\\n\\x0b\\x0c\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const STRIP_RE = new RegExp(`^[${PY_WS}]+|[${PY_WS}]+$`, "gu");

/** str.strip() */
export const pyStrip = (s: string): string => s.replace(STRIP_RE, "");

/** s[:n] - by code point, not by UTF-16 unit. */
export function pySlice(s: string, n: number): string {
  if (s.length <= n) return s;
  let i = 0;
  for (let cp = 0; i < s.length && cp < n; cp++) i += (s.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
  return s.slice(0, i);
}

/** Python's string order: by code point (JavaScript's < compares UTF-16 units). */
export function pyCmp(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length) {
    const x = a.codePointAt(i) ?? 0, y = b.codePointAt(i) ?? 0;
    if (x !== y) return x < y ? -1 : 1;
    i += x > 0xffff ? 2 : 1;
  }
  return a.length === b.length ? 0 : a.length > b.length ? 1 : -1;
}
export const pySorted = (xs: Iterable<string>): string[] => [...xs].sort(pyCmp);

/** str.zfill(width) */
export function pyZfill(s: string, width: number): string {
  const len = [...s].length;
  if (len >= width) return s;
  const pad = "0".repeat(width - len);
  return s[0] === "+" || s[0] === "-" ? s[0] + pad + s.slice(1) : pad + s;
}

/** Python truthiness of a parsed JSON value. */
export function pyTruthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false || v === 0 || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

/** A bare NaN in JSON: Python reads a float that is truthy and fails every comparison. */
export const PY_NAN = "\u0000NaN";

/** str(v) for the JSON scalars that can reach it (a float like 10.0 already reads as 10). */
export function pyStr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (v === PY_NAN) return "nan";
  if (v === Infinity) return "inf";
  if (v === -Infinity) return "-inf";
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : JSON.stringify(v);
}

/** json.loads: Python also reads NaN / Infinity, which json.dumps writes for a float nan or inf. */
export function pyJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const fixed = raw.replace(/"(?:[^"\\]|\\.)*"|(-?Infinity|NaN)/g, (m, bare: string | undefined) =>
      bare === undefined ? m : bare === "NaN" ? JSON.stringify(PY_NAN) : bare.replace("Infinity", "1e400"));
    return JSON.parse(fixed); // throws like json.loads when it is not JSON at all
  }
}

const isDict = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const daysIn = (y: number, mo: number): number =>
  [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];

/** datetime(y, mo, d, h, mi, s, tzinfo=utc) as epoch ms; null where Python's datetime() refuses it. */
export function utcMs(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number | null {
  if (!(y >= 1 && y <= 9999 && mo >= 1 && mo <= 12 && d >= 1 && d <= daysIn(y, mo) && h <= 23 && mi <= 59 && s <= 59)) return null;
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d); // Date.UTC would read years 0-99 as 1900-1999
  t.setUTCHours(h, mi, s, 0);
  return t.getTime();
}

// Python's \w (str patterns): letters, numbers, underscore - not combining marks
const W = "[\\p{L}\\p{N}_]";
const B0 = `(?<!${W})`, B1 = `(?!${W})`, D = "\\p{Nd}";
// re.I: Python also folds 'İ' and 'ı' onto 'i' (JavaScript's /iu folds 'ſ' onto 's' and 'K' onto 'k' like Python)
const I = "[iİı]";
const S = `[${PY_WS}]`;

/* ── 1. wrong owners ───────────────────────────────────────────────────── */

export const BO = "1726786777", ESO = "1726599376", TSA = "1726599377";
export const PIPE_NAME: Record<string, string> = { [BO]: "Back Office", [ESO]: "ESO", [TSA]: "TSA" };
export const PIPE_TEAM: Record<string, string> = { [BO]: "Backoffice Team", [ESO]: "ESO", [TSA]: "TSA" };
export const ESO_REDIR = "2624466140", TSA_REDIR = "2621331643", BO_REMIND = "2338266327";
export const MAIDA = "1207485931";
export const PREFIX = "WRONG OWNER PLEASE CORRECT IT - ";
/** Roles as the business states them, overriding the portal's stale team field. */
export const ROLE_OVERRIDE: Record<string, string> = {
  "Yani Alioua": "ESO", "Diana Fehr": "ESO", "Claudio Saraiva": "ESO",
  "Christopher Stahl": "ESO", "Bernd Rausmann": "ESO",
  "Daniel Wieland": "E-Commerce",
  "Alexandre Lecomte": "Management", "Monika Zihlmann": "Management",
};
/** People who legitimately own tickets in more than one pipeline: never flagged there. */
export const MULTI_ROLE: Record<string, Set<string>> = {
  "Marc Frech": new Set(["ESO", "TSA"]),
  "Bernd Rausmann": new Set(["ESO", "TSA"]),
};
/** Campaigns whose tickets are owned by the campaign owner by design. */
export const CAMPAIGN_RE = new RegExp(`marc ch push|nancy ch push|helpl${I}ne|b${I}sphenol|lost lead`, "iu");
export const WRONG_OWNER_PROPS = ["wrong_owner_original_subject", "wrong_owner_flagged_at", "wrong_owner_reason", "wrong_owner_owner_at_flag"] as const;

export type OwnerInfo = { name: string; primary: string | null };
export type StageInfo = { label: string; pipe: string; closed: boolean };
type OwnerRow = { id: string | number; firstName?: unknown; lastName?: unknown; teams?: { name?: unknown; primary?: unknown }[] | null };
type PipelineRow = { id: string; stages?: { id: string; label: string; metadata?: Record<string, unknown> | null }[] };

/** wrong_owners.owners(): one page of /crm/v3/owners into {id: {name, primary team}}. */
export function addOwners(out: Map<string, OwnerInfo>, rows: OwnerRow[]): Map<string, OwnerInfo> {
  for (const o of rows) {
    const teams = pyTruthy(o.teams) ? o.teams! : [];
    const firstPrimary = teams.find((t) => pyTruthy(t.primary));
    const primary = (firstPrimary && pyTruthy(firstPrimary.name) ? firstPrimary.name : null) ?? (teams.length ? teams[0].name ?? null : null);
    const part = (v: unknown) => (pyTruthy(v) ? pyStr(v) : "");
    out.set(String(o.id), { name: pyStrip(`${part(o.firstName)} ${part(o.lastName)}`), primary: primary === null ? null : String(primary) });
  }
  return out;
}

/** wrong_owners.stages(): every ticket stage -> its pipeline and whether it is closed. */
export function stageIndex(pipelines: PipelineRow[]): Map<string, StageInfo> {
  const out = new Map<string, StageInfo>();
  for (const p of pipelines) {
    for (const s of p.stages ?? []) {
      const state = s.metadata && "ticketState" in s.metadata ? pyStr(s.metadata.ticketState) : "";
      out.set(s.id, { label: s.label, pipe: p.id, closed: state.toUpperCase() === "CLOSED" });
    }
  }
  return out;
}

export type Verdict = { pipe: string; stage: string; owner: string; reason: string };

/** wrong_owners._verdict: null when the ticket is where it belongs, else the correction. */
export function verdict(pipe: string, ownerId: string | null | undefined, who: Map<string, OwnerInfo>): Verdict | null {
  const o = who.get(String(ownerId || ""));
  const want = PIPE_TEAM[pipe];
  if (!o) return null; // no owner, or a deactivated one
  const name = o.name;
  const role = name in ROLE_OVERRIDE ? ROLE_OVERRIDE[name] : o.primary || "(no team)";
  if (role === want || (MULTI_ROLE[name]?.has(want) ?? false)) return null;
  const why = (r: string) => `${name} is ${r}; the ticket was open in the ${PIPE_NAME[pipe]} pipeline`;
  if (role === "Backoffice Team") return { pipe: BO, stage: BO_REMIND, owner: MAIDA, reason: why("Back Office") };
  if (role === "ESO") return { pipe: ESO, stage: ESO_REDIR, owner: String(ownerId), reason: why("ESO") };
  if (role === "TSA") return { pipe: TSA, stage: TSA_REDIR, owner: String(ownerId), reason: why("TSA") };
  return null; // Management, E-Commerce, anything else: leave alone
}

export type WrongOwnerAction =
  | { kind: "restore"; props: Record<string, string>; subject: string; why: "closed" | "taken over" }
  | { kind: "flag"; props: Record<string, string>; subject: string; from: string; to: string; reason: string }
  | { kind: "campaign" }
  | { kind: "none" };

/**
 * One ticket of wrong_owners.run(): restore a flagged ticket once a human has taken it
 * over (owner differs from the one at flagging) or it is closed; otherwise flag a ticket
 * whose pipeline does not match its owner's role. `nowIso` is "yyyy-mm-ddThh:mm:ssZ".
 */
export function wrongOwnerAction(p: Props, stages: Map<string, StageInfo>, who: Map<string, OwnerInfo>, nowIso: string): WrongOwnerAction {
  const st = stages.get(p.hs_pipeline_stage || "");
  const pipe = p.hs_pipeline ?? "";
  const owner = p.hubspot_owner_id;
  const subject = p.subject || "";
  if (p.wrong_owner_flagged_at) {
    // restore only once somebody else really holds it, or it is closed - not merely
    // because the correction made owner and pipeline agree
    const takenOver = String(owner || "") !== String(p.wrong_owner_owner_at_flag || "");
    if (!takenOver && !st?.closed) return { kind: "none" };
    const original = p.wrong_owner_original_subject || subject.replace(PREFIX, "");
    return {
      kind: "restore", subject: pySlice(original, 80), why: st?.closed ? "closed" : "taken over",
      props: { subject: original, wrong_owner_flagged_at: "", wrong_owner_original_subject: "", wrong_owner_reason: "", wrong_owner_owner_at_flag: "" },
    };
  }
  if (st?.closed || !(pipe in PIPE_TEAM)) return { kind: "none" };
  if (CAMPAIGN_RE.test(subject)) return { kind: "campaign" };
  const v = verdict(pipe, owner, who);
  if (!v) return { kind: "none" };
  return {
    kind: "flag", subject: pySlice(subject, 80), from: PIPE_NAME[pipe], to: PIPE_NAME[v.pipe], reason: v.reason,
    props: {
      subject: pySlice(PREFIX + subject, 500), hs_pipeline: v.pipe, hs_pipeline_stage: v.stage, hubspot_owner_id: v.owner,
      wrong_owner_original_subject: pySlice(subject, 500), wrong_owner_flagged_at: nowIso,
      wrong_owner_reason: pySlice(v.reason, 500), wrong_owner_owner_at_flag: v.owner,
    },
  };
}

/**
 * The search that finds every ticket wrongOwnerAction can act on in one pipeline: not in
 * a closed stage (of ANY pipeline - exactly the connector's "st.closed" skip, so a stage
 * it does not know still counts as open), or carrying the flag. Everything else is "none"
 * by the rules above, so the hub does not read it - and an id cursor never meets the
 * 10,000-result cap. More than 100 closed stages: no stage filter, every ticket is read.
 */
export function wrongOwnerSearch(pid: string, stages: Map<string, StageInfo>, cursor: string, flagReadable: boolean): object {
  const closed = [...stages].filter(([, s]) => s.closed).map(([id]) => id);
  const base = [{ propertyName: "hs_pipeline", operator: "EQ", value: pid }, { propertyName: "hs_object_id", operator: "GT", value: cursor }];
  const stageFilter = closed.length && closed.length <= 100 ? [{ propertyName: "hs_pipeline_stage", operator: "NOT_IN", values: closed }] : [];
  const filterGroups: object[] = [{ filters: [...base, ...stageFilter] }];
  if (stageFilter.length && flagReadable) filterGroups.push({ filters: [...base, { propertyName: "wrong_owner_flagged_at", operator: "HAS_PROPERTY" }] });
  return {
    limit: 200, filterGroups, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
    properties: ["subject", "hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id", ...WRONG_OWNER_PROPS],
  };
}

/* ── 2. deputy sweep ───────────────────────────────────────────────────── */

export const DEPUTY_PIPELINE = ESO;
export const NEW = "2338232556", REDIRECTED = "2624466140", CUSTOMER_REPLIED = "3259123944";
export const DEPUTY_STAGES = [NEW, REDIRECTED, CUSTOMER_REPLIED];
export const TSA_OWNER = "1202569408";
export const SYSTEM_PREFIXES = ["EROSION |", "SEPT PUSH |", "Lost Lead", "Push for", "C2S PROBLEM", "DUPLICATE", "DUP |"];
export const USER_PROPS = ["hubspot_owner_id", "hs_email", "hs_is_out_of_office", "ap_deputy_owner_id", "ap_deputy_2_owner_id", "hs_out_of_office_hours"];

/** Campaign tickets written by our own engines stay with the absent owner. */
export const isSystemSubject = (subject: string | null | undefined): boolean => {
  const s = pyStrip(subject || "");
  return SYSTEM_PREFIXES.some((p) => s.startsWith(p));
};

const pyNum = (v: unknown): number | null => (typeof v === "number" ? v : typeof v === "boolean" ? Number(v) : v === PY_NAN ? NaN : null);

/**
 * The absence window holding `now` in hs_out_of_office_hours (the LAST such window, as
 * deputy_sweep._user_state finds it). Anything Python would choke on ends the scan
 * with whatever was found before it, exactly as its try/except does.
 */
export function oooWindow(raw: string | null | undefined, nowMs: number): [number, number] | null {
  let win: [number, number] | null = null;
  let arr: unknown;
  try {
    arr = pyJson(raw || "[]");
  } catch {
    return null;
  }
  // a text or a dict iterates characters / keys and .get fails at once; None or a number is not iterable
  if (!Array.isArray(arr)) return null;
  for (const w of arr) {
    if (!isDict(w)) return win;
    const s = pyNum("startTimestamp" in w ? w.startTimestamp : 0);
    if (s === null) return win; // a non-number compared with a float: TypeError
    if (!(s <= nowMs)) continue;
    const e = pyNum("endTimestamp" in w ? w.endTimestamp : 0);
    if (e === null) return win;
    if (!(nowMs <= e)) continue;
    if (!("startTimestamp" in w)) return win; // w["startTimestamp"]: KeyError
    win = [s, e];
  }
  return win;
}

export type UserState = { exists: boolean; ooo: boolean; d1: string | null; d2: string | null; who: string; window: [number, number] | null };

/** deputy_sweep._user_state from the users search's first result (null = none found). */
export function userState(ownerId: string, props: Props | null, nowMs: number): UserState {
  if (!props) return { exists: false, ooo: false, d1: null, d2: null, who: ownerId, window: null };
  return {
    exists: true,
    ooo: pyStr(props.hs_is_out_of_office).toLowerCase() === "true",
    d1: props.ap_deputy_owner_id || null,
    d2: props.ap_deputy_2_owner_id || null,
    who: props.hs_email || ownerId,
    window: oooWindow(props.hs_out_of_office_hours, nowMs),
  };
}

export type DeputyTarget = { need: string } | { to: string | null; reason: string };

/** deputy_sweep._target - or the user it still has to look up ({need}). */
export function deputyTarget(owner: string, get: (id: string) => UserState | undefined, tsaFallback: boolean): DeputyTarget {
  const o = get(owner);
  if (!o) return { need: owner };
  if (!o.exists || !o.ooo) return { to: null, reason: "" };
  for (const [label, cand] of [["D1", o.d1], ["D2", o.d2]] as const) {
    if (!cand) continue;
    const c = get(cand);
    if (!c) return { need: cand };
    if (c.exists && !c.ooo) return { to: cand, reason: `${o.who} away -> ${label}` };
  }
  if (tsaFallback) return { to: TSA_OWNER, reason: `${o.who} away -> TSA (no usable deputy)` };
  return { to: null, reason: `${o.who} away, no usable deputy` };
}

const STRPTIME = new RegExp("^(\\d{4})-(1[0-2]|0[1-9]|[1-9])-(3[01]|[12]\\d|0[1-9]|[1-9]| [1-9])T(2[0-3]|[0-1]\\d|\\d):([0-5]\\d|\\d):(6[0-1]|[0-5]\\d|\\d)$", "i");

/** createdate[:19] through strptime("%Y-%m-%dT%H:%M:%S") as UTC ms; null where Python raises. */
export function createdUtcMs(createdate: unknown): number | null {
  if (typeof createdate !== "string") return null; // missing / None: KeyError, TypeError
  const m = STRPTIME.exec(pySlice(createdate, 19));
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((x) => Number(x.trim()));
  return utcMs(y, mo, d, h, mi, s);
}

export type DeputyDecision =
  | { need: string }
  | { kind: "none" | "system" | "no_window" | "before_window" }
  | { kind: "move"; to: string; reason: string; props: Record<string, string> };

/**
 * One ticket of deputy_sweep.run(). DELIBERATE FIX: an owner who is out of office with
 * no absence window holding "now" is skipped ("no_window") - the connector moved every
 * ticket in those stages then, however old, because it could not tell which arrived
 * during the absence.
 */
export function deputyDecision(p: Props, get: (id: string) => UserState | undefined, tsaFallback: boolean): DeputyDecision {
  const owner = p.hubspot_owner_id;
  if (!owner) return { kind: "none" };
  const t = deputyTarget(owner, get, tsaFallback);
  if ("need" in t) return t;
  if (!t.to || t.to === owner) return { kind: "none" };
  if (isSystemSubject(p.subject)) return { kind: "system" };
  const win = get(owner)!.window;
  if (!win) return { kind: "no_window" };
  const ts = createdUtcMs(p.createdate);
  if (ts !== null && ts < win[0]) return { kind: "before_window" };
  const props: Record<string, string> = { hubspot_owner_id: t.to };
  if (p.hs_pipeline_stage === CUSTOMER_REPLIED) props.hs_pipeline_stage = NEW;
  return { kind: "move", to: t.to, reason: t.reason, props };
}

/** The note the connector left on a reassigned ticket (its text, as HTML for the v3 notes API). */
export function deputyNote(owner: string, to: string, reason: string): string {
  const text = `DEPUTY REASSIGNMENT (connector sweep)\n\nOriginal owner: ${owner} (out of office)\nNew owner: ${to}\n${reason}\n\n-- SARCLA deputy sweep`;
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

/* ── 3. ticket associations ────────────────────────────────────────────── */

export const PP_OBJ = "2-200042439";
export const PP_ASSOC_TYPE = 154; // USER_DEFINED "Referenced article"; 152 stays reserved for erosion
export const ASSOC_PIPELINES: Record<string, "BO" | "ESO" | "TSA"> = { [BO]: "BO", [ESO]: "ESO", [TSA]: "TSA" };
export const ASSOC_FIELDS = ["subject", "content", "order_number", "order_id", "article", "article_number", "articles_on_the_ticket", "hs_pipeline", "createdate", "c2s_ticket"];
export const ORDER_PROPS = ["order_order_number", "cuttosize_order", "order_customer_number", "order_mandant", "order_positions_json"];

export const ORDER_RE = new RegExp(`${B0}([AG]${D}{2}\\.${D}{6})(\\.${D}{3})?${B1}`, "gu");
export const ART_RE = new RegExp(`${B0}(${D}{10})${B1}`, "gu");
export const C2S_RE = new RegExp(
  `${B0}c2s${B1}|cut[^\\n]{0,3}to[^\\n]{0,3}s${I}ze|zuschn${I}tt|zuschn${I}tte|coupe${S}+sur${S}+mesure`, "iu",
);

/** The ticket's own evidence: its fields joined, at most 8,000 characters. */
export function ticketBlob(p: Props): string {
  const parts = [p.subject, p.content, p.order_number, p.order_id, p.article, p.article_number, p.articles_on_the_ticket];
  return pySlice(parts.filter((x): x is string => !!x).join(" "), 8000);
}

export type OrderRef = [string, string | null];

/** Order numbers in the text, base + optional delivery suffix: sorted, at most 6. */
export function orderRefs(text: string): OrderRef[] {
  const seen = new Map<string, [string, string]>();
  for (const m of text.matchAll(ORDER_RE)) seen.set(`${m[1]}\u0000${m[2] ?? ""}`, [m[1], m[2] ?? ""]);
  return [...seen.values()]
    .sort((a, b) => pyCmp(a[0], b[0]) || pyCmp(a[1], b[1]))
    .slice(0, 6)
    .map(([b, s]) => [b, s || null]);
}

/** 10-digit article candidates in the text. */
export const articleCandidates = (text: string): Set<string> => new Set([...text.matchAll(ART_RE)].map((m) => m[1]));

/** Cut-to-size in the text. */
export const mentionsC2S = (text: string): boolean => C2S_RE.test(text);

/** The order numbers to look up: a bare base asks for its first three deliveries. */
export function wantedOrderNumbers(refs: OrderRef[]): string[] {
  const want = new Set<string>();
  for (const [base, suf] of refs) {
    if (suf) want.add(base + suf);
    else for (const s of [".000", ".001", ".002"]) want.add(base + s);
  }
  return pySorted(want);
}

/** _resolve_orders: the first 20 positions' articles of an order ("a" or "article"). */
export function positionArticles(raw: string | null | undefined): string[] {
  let arr: unknown;
  try {
    arr = pyJson(raw || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return []; // a dict / None / number / text: Python raises inside its try
  const out: string[] = [];
  for (const x of arr.slice(0, 20)) {
    if (!isDict(x)) return []; // .get on a non-dict raises: the whole list is dropped
    const v = pyTruthy(x.a) ? x.a : pyTruthy(x.article) ? x.article : "";
    out.push(pyStrip(pyStr(v)));
  }
  return out.filter((a) => a);
}

export type FoundOrder = { id: string; c2s: boolean; customer: string; mandant: string; arts: string[] };

/** One order search result as _resolve_orders keeps it, under its order number. */
export function foundOrder(o: { id: string; properties?: Props }): [string, FoundOrder] {
  const p = o.properties ?? {};
  return [p.order_order_number ?? "", {
    id: o.id, c2s: p.cuttosize_order === "true", customer: p.order_customer_number || "", mandant: p.order_mandant || "", arts: positionArticles(p.order_positions_json),
  }];
}

/** The article candidates to validate: the text's, plus each linked order's first 6 - sorted, at most 12. */
export function articlesToCheck(fromText: Set<string>, orders: Map<string, FoundOrder>): string[] {
  const all = new Set(fromText);
  for (const o of orders.values()) for (const a of o.arts.slice(0, 6)) all.add(a);
  return pySorted(all).slice(0, 12);
}

/** _resolve_articles, the part before the search: cache hits, and what still has to be looked up. */
export function articlesFromCache(arts: string[], cache: Map<string, string | null>): { out: Map<string, string>; missing: string[] } {
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const a of arts) {
    if (cache.has(a)) {
      const id = cache.get(a);
      if (id) out.set(a, id);
    } else missing.push(a);
  }
  return { out, missing };
}

/** The values to search P&P article_number for: each candidate, and its 10-digit zero-padded form. */
export function articleSearchValues(missing: string[]): string[] {
  const cands: string[] = [];
  for (const a of missing) {
    cands.push(a);
    const z = pyZfill(a, 10);
    if (z !== a) cands.push(z);
  }
  return cands;
}

/** _resolve_articles, the part after a search page: a found article_number answers itself and its unpadded form. */
export function absorbArticles(missing: string[], results: { id: string; properties?: Props }[], cache: Map<string, string | null>, out: Map<string, string>): void {
  const want = new Set(missing);
  for (const o of results) {
    const n = pyStrip(o.properties?.article_number || "");
    for (const orig of [n, n.replace(/^0+/, "")]) {
      if (want.has(orig)) {
        cache.set(orig, o.id);
        out.set(orig, o.id);
      }
    }
  }
}

/** _resolve_articles, the end: what was not found is remembered as not found. */
export function rememberMissing(missing: string[], cache: Map<string, string | null>): void {
  for (const a of missing) if (!cache.has(a)) cache.set(a, null);
}

const ISO_DT = new RegExp(
  "^(\\d{4})-(\\d{2})-(\\d{2})(?:[^](\\d{2})(?::?(\\d{2})(?::?(\\d{2})(?:[.,](\\d+))?)?)?(?:([+-])(\\d{2})(?::?(\\d{2})(?::?(\\d{2}))?)?)?)?$", "u",
);

/**
 * The ticket's createdate as ms the way ticket_assoc reads it:
 * int(datetime.fromisoformat(createdate).timestamp() * 1000), float rounding included.
 * An empty createdate is 1970; one that is not ISO throws, as it does in Python.
 */
export function createdMsIso(createdate: string | null | undefined): number {
  const s = (createdate || "1970-01-01T00:00:00+00:00").replace("Z", "+00:00");
  // any single separator; hh[:mm[:ss[.f...]]] or basic hhmmss; offset ±hh[[:]mm[[:]ss]]
  const m = ISO_DT.exec(s);
  const [, y, mo, d, h = "0", mi = "0", sec = "0", frac = "", sign, oh = "0", om = "0", os = "0"] = m ?? [];
  const base = m ? utcMs(Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(sec)) : null;
  if (base === null) throw new Error(`createdate is not an ISO date: ${s.slice(0, 40)}`);
  const offset = sign ? (sign === "-" ? -1 : 1) * (Number(oh) * 3600 + Number(om) * 60 + Number(os)) * 1000 : 0; // naive: the server's zone, UTC
  const micros = (base - offset) * 1000 + Number(frac.slice(0, 6).padEnd(6, "0") || "0");
  return Math.trunc((micros / 1e6) * 1000);
}

/** UTC day of epoch ms, "yyyy-mm-dd". */
export const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const ymd = (ms: number): string | null => {
  const t = new Date(ms);
  const y = t.getUTCFullYear();
  return y < 1 || y > 9999 ? null : `${String(y).padStart(4, "0")}-${t.toISOString().slice(-19, -14)}`;
};

/** CPython's iso_to_ymd: ISO year, week (1-52, 53 where the year has one), weekday 1-7. */
function isoWeekDay(y: number, w: number, d: number): string | null {
  const jan1 = utcMs(y, 1, 1);
  if (jan1 === null) return null;
  const first = (new Date(jan1).getUTCDay() + 6) % 7; // Monday = 0
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (w <= 0 || w >= 53) {
    if (!(w === 53 && (first === 3 || (first === 2 && leap)))) return null;
  }
  if (d <= 0 || d >= 8) return null;
  const jan4 = jan1 + 3 * 86_400_000;
  const monday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * 86_400_000;
  return ymd(monday + ((w - 1) * 7 + d - 1) * 86_400_000);
}

/**
 * date.fromisoformat(s[:10]) as "yyyy-mm-dd", or null where Python raises - CPython's C
 * parser: 7, 8 or 10 UTF-8 bytes, digits read from the left, the rest not checked; ISO
 * week dates ("2026-W41-3") included.
 */
export function isoDay(v: string | null | undefined): string | null {
  const s = pySlice(v || "", 10);
  const len = new TextEncoder().encode(s).length;
  if (![7, 8, 10].includes(len)) return null;
  const dig = (i: number, n: number) => (/^[0-9]+$/.test(s.slice(i, i + n)) && s.slice(i, i + n).length === n ? Number(s.slice(i, i + n)) : null);
  const y = dig(0, 4);
  if (y === null) return null;
  const sep = s[4] === "-";
  let p = sep ? 5 : 4;
  if (s[p] === "W") {
    const w = dig(p + 1, 2);
    if (w === null) return null;
    p += 3;
    let wd = 1;
    if (p < len) {
      if (sep && s[p++] !== "-") return null;
      const x = dig(p, 1);
      if (x === null) return null;
      wd = x;
    }
    return isoWeekDay(y, w, wd);
  }
  const mo = dig(p, 2);
  if (mo === null) return null;
  p += 2;
  if (sep && s[p++] !== "-") return null;
  const d = dig(p, 2);
  if (d === null || utcMs(y, mo, d) === null) return null;
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The company's ERP key as [mandant, customer number]; null without a "-". */
export function companyKey(un: string | null | undefined): [string, string] | null {
  const s = pyStrip(un || "");
  const i = s.indexOf("-");
  return i < 0 ? null : [s.slice(0, i), s.slice(i + 1)];
}

/** The order search for the offer match: the company's orders from 30 days before to 90 after the ticket. */
export function offerSearch(mandant: string, customer: string, createdMs: number): Record<string, unknown> {
  return {
    filterGroups: [{ filters: [
      { propertyName: "order_customer_number", operator: "EQ", value: customer },
      { propertyName: "order_mandant", operator: "EQ", value: mandant },
      { propertyName: "order_order_date", operator: "GTE", value: String(createdMs - 30 * 86_400_000) },
      { propertyName: "order_order_date", operator: "LTE", value: String(createdMs + 90 * 86_400_000) },
    ] }],
    sorts: [{ propertyName: "order_order_date", direction: "DESCENDING" }],
    properties: ["order_order_number", "order_order_date", "order_positions_json", "cuttosize_order"],
    limit: 100,
  };
}

export type OfferHit = { id: string; number: string; converted: boolean; c2s: boolean };

/**
 * One order of the offer match: does it carry the article (as is or zero-padded)?
 * converted = ordered on or after the ticket's day. Positions Python could not read
 * (not a list, a line that is not an object, an article that is not text) raise there
 * and stop the whole sweep; here they simply do not match.
 */
export function offerHit(o: { id: string; properties?: Props }, article: string, createdDay: string): OfferHit | null {
  const p = o.properties ?? {};
  let arr: unknown;
  try {
    arr = pyJson(p.order_positions_json || "[]");
  } catch {
    arr = [];
  }
  if (!Array.isArray(arr)) return null;
  const forms = new Set([article, pyZfill(article, 10)]);
  const has = arr.some((x) => {
    if (!isDict(x)) return false;
    const v = pyTruthy(x.article) ? x.article : pyTruthy(x.a) ? x.a : "";
    return typeof v === "string" && forms.has(pyStrip(v));
  });
  if (!has) return null;
  const od = isoDay(p.order_order_date);
  return { id: o.id, number: p.order_order_number ?? "", converted: od !== null && od >= createdDay, c2s: p.cuttosize_order === "true" };
}

export type AssocPlan = {
  props: Record<string, string>;
  filled: string[];
  orderIds: string[];
  ppIds: string[];
};

/**
 * What ticket_assoc._process writes: reference fields only when EMPTY, the C2S flag
 * when not yet set, the first 4 text orders + first 3 offer orders, the first 5 articles.
 */
export function assocPlan(p: Props, orders: Map<string, FoundOrder>, arts: Map<string, string>, offerOrders: [string, string, boolean][], c2s: boolean): AssocPlan {
  const props: Record<string, string> = {};
  const filled: string[] = [];
  const onums = pySorted(orders.keys());
  const anums = pySorted(arts.keys());
  if (onums.length && !pyStrip(p.order_number || "")) {
    props.order_number = onums[0];
    filled.push("order_number");
  }
  if (anums.length && !pyStrip(p.articles_on_the_ticket || "")) {
    props.articles_on_the_ticket = pySlice(anums.join("; "), 250);
    filled.push("articles_on_the_ticket");
  }
  if (c2s && p.c2s_ticket !== "true") props.c2s_ticket = "true";
  const orderIds = [...new Set([...onums.slice(0, 4).map((n) => orders.get(n)!.id), ...offerOrders.slice(0, 3).map(([id]) => id)])];
  const ppIds = [...new Set(anums.slice(0, 5).map((a) => arts.get(a)!))];
  return { props, filled, orderIds, ppIds };
}

/** An existing ticket->order link counts when it carries the unlabeled (HUBSPOT_DEFINED) type. */
export const hasDefaultType = (types: { category?: string; typeId?: number }[] | undefined): boolean =>
  (types ?? []).some((t) => t.category === "HUBSPOT_DEFINED");

/** An existing ticket->P&P link counts only with the "Referenced article" label (154). */
export const hasArticleType = (types: { category?: string; typeId?: number }[] | undefined): boolean =>
  (types ?? []).some((t) => t.category === "USER_DEFINED" && Number(t.typeId) === PP_ASSOC_TYPE);
