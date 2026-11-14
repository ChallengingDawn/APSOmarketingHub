// TSA DISTRIBUTION - the rules, pure (the engine in engine.ts). SARCLA 13-14.11.2026: "TSA, we need to create a sub
// app TSA Distribution (and an ESO distribution for later): the back office should run as today to classify the ticket
// and point it again to the correct team, but today we have a lot of TSA non qualified - this should be really split".
//
// What the HubSpot workflow "SARCLA | TSA/HELPLINE MAIL TICKET CREATION" (2446008517) does, read 13.11.2026: a TSA
// ticket that enters New (its subject naming none of the campaign words), or Customer replied without ever having
// been in another TSA stage, is routed:
// - an e-mail: subject "HELPLINE | <subject> |", owner the TSA Team; then
//   - "Lead Action" (the AP online form): its code makes the contact and company, marks the lead, subject "AP LEAD |",
//     to the Back Office ("Redirected from Chat/Helpline");
//   - "Mahnung" (a payment reminder): resolution TSA NON QUALIFIED, subject "TSA | MAIL FROM FINANCE | …", a note;
//   - any other: to the Back Office, which classifies it and sends it to the right team;
// - an outbound ticket (HubSpot opens one when an agent writes to a customer first): TSA NON QUALIFIED, subject
//   "TSA | MAIL TO CUSTOMER | …", Closed - it opens again by itself when the customer answers;
// - anything else: nothing.
// The hub keeps the routing and splits TSA NON QUALIFIED into what it is (SARCLA 14.11.2026): "Outbound - TSA call"
// and "Finance reminder".

export const WORKFLOW_ID = "2446008517";
export const TSA = "1726599377", BO = "1726786777";
export const STAGE = {
  new: "2338232560", redirectedFromBo: "2621331643", waitingCustomer: "2338232561", inProgress: "4962938099",
  customerReplied: "3750003907", waitingInternally: "2338232562", longWait: "4962938100", closed: "2338232563",
  boRedirected: "2554860732",
} as const;
export const TSA_TEAM = "1202569408";
export const OUTBOUND_LABEL = "Outbound - TSA call";
export const FINANCE_LABEL = "Finance reminder";
/** The one label the workflow gave both - read as what it was, by its subject. */
export const OLD_NON_QUALIFIED = "TSA NON QUALIFIED";

const SKIP_NEW = ["Survey", "Push for Second Purchase", "Marc CH Push", "Nany CH Push", "New Registrant", "Qualified Lead", "EROSION", "PRICE CHECK"];
const SKIP_REPLIED = ["Survey", "Push for Second Purchase", "Qualified Lead", "New Registrant"];
/** "Customer replied" counts only for a ticket that was never in another TSA stage. */
const OTHER_TSA = [STAGE.redirectedFromBo, STAGE.inProgress, STAGE.closed, STAGE.waitingInternally, STAGE.waitingCustomer, STAGE.new, STAGE.longWait];

const has = (s: string | null | undefined, words: string[]) => { const t = String(s ?? "").toLowerCase(); return words.some((w) => t.includes(w.toLowerCase())); };

export type Facts = {
  /** The stage it entered TSA in, and the stages it had been in before. */
  stage: string; before: string[];
  /** The subject when it arrived (an e-mail's subject). */
  subject: string;
  sourceType: string | null; outbound: boolean;
};
export type Path = "helpline" | "lead" | "finance" | "outbound" | "none";
export type Decision = { path: Path; subject?: string; owner?: string; stage?: string; resolution?: string; lead?: boolean; note?: boolean };

/** Does the routing take this ticket at all (the workflow's trigger)? */
export function routes(f: Facts): boolean {
  if (f.stage === STAGE.new) return !has(f.subject, SKIP_NEW);
  if (f.stage === STAGE.customerReplied) return !has(f.subject, SKIP_REPLIED) && !f.before.some((s) => OTHER_TSA.includes(s as (typeof OTHER_TSA)[number]));
  return false;
}

/** What the hub does with a ticket the routing takes - the workflow's paths, with the two labels split. */
export function decide(f: Facts): Decision {
  if (!routes(f)) return { path: "none" };
  if ((f.sourceType ?? "").toUpperCase() === "EMAIL") {
    const subject = f.subject.trim();
    if (has(subject, ["Lead Action"])) return { path: "lead", subject: `AP LEAD | ${subject} |`, owner: TSA_TEAM, stage: STAGE.boRedirected, lead: true };
    if (has(subject, ["Mahnung"])) return { path: "finance", subject: `TSA | MAIL FROM FINANCE | RESOLUTION : ${FINANCE_LABEL}`, owner: TSA_TEAM, resolution: FINANCE_LABEL, note: true };
    return { path: "helpline", subject: `HELPLINE | ${subject} |`, owner: TSA_TEAM, stage: STAGE.boRedirected };
  }
  if (f.outbound) return { path: "outbound", subject: `TSA | MAIL TO CUSTOMER | RESOLUTION : ${OUTBOUND_LABEL}`, resolution: OUTBOUND_LABEL, stage: STAGE.closed };
  return { path: "none" };
}

type Change = { value: string; timestamp: string };
/**
 * The ticket as the routing met it, from its history: the first time it entered New (or Customer replied, never in
 * another TSA stage before) with a subject the trigger takes - the workflow enrols again each time it enters New, so a
 * ticket that came from the Back Office and only later reached New is taken then. The subject is the one it had at that
 * moment. None such: its first TSA stage, which the routing does not take.
 */
export function arrival(stages: Change[], subjects: Change[], sourceType: string | null, outbound: boolean, now: { stage: string; subject: string }): Facts {
  const st = [...stages].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const su = [...subjects].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const subjectAt = (t: string) => { let v = su[0]?.value ?? now.subject; for (const x of su) if (x.timestamp <= t) v = x.value; return v; };
  let firstTsa: Facts | null = null;
  for (let i = 0; i < st.length; i++) {
    const f: Facts = { stage: st[i].value, before: st.slice(0, i).map((x) => x.value), subject: subjectAt(st[i].timestamp), sourceType, outbound };
    if (routes(f)) return f;
    if (!firstTsa && (Object.values(STAGE) as string[]).includes(f.stage) && f.stage !== STAGE.boRedirected) firstTsa = f;
  }
  return firstTsa ?? { stage: now.stage, before: [], subject: su[0]?.value ?? now.subject, sourceType, outbound };
}

/** What a ticket's subject says the workflow did with it. */
export function pathOf(subject: string | null | undefined): Path {
  const s = String(subject ?? "").trim().toUpperCase();
  if (s.startsWith("AP LEAD |")) return "lead";
  if (s.startsWith("TSA | MAIL FROM FINANCE")) return "finance";
  if (s.startsWith("TSA | MAIL TO CUSTOMER")) return "outbound";
  if (s.startsWith("HELPLINE |")) return "helpline";
  return "none";
}

// ---------------- the funnel ----------------
export type Ticket = {
  id: string; created: string; subject: string; sourceType: string | null; outbound: boolean; objectSource: string | null;
  objectSourceDetail: string | null; pipeline: string; stage: string; resolution: string | null; lead: boolean;
};
export const WAYS = ["Helpline e-mail", "AP lead form", "Finance reminder", "Outbound - TSA call", "E-mail to TSA", "Web form", "Chat", "Erosion", "Campaigns & use cases", "Other"] as const;
export type Way = (typeof WAYS)[number];
export const OUTCOMES = ["Sent to the Back Office", "Ordered", "Closed by TSA", "Not a request", "Open"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** How a ticket came to TSA. */
export function wayIn(t: Ticket): Way {
  const p = pathOf(t.subject);
  if (p === "lead" || t.lead) return "AP lead form";
  if (p === "finance" || (t.resolution === FINANCE_LABEL)) return "Finance reminder";
  if (p === "outbound" || t.outbound || t.resolution === OUTBOUND_LABEL) return "Outbound - TSA call";
  if (p === "helpline") return "Helpline e-mail";
  const src = (t.sourceType ?? "").toUpperCase(), os = (t.objectSourceDetail ?? "").toUpperCase(), s = t.subject.toUpperCase();
  if (os.includes("EROSION") || s.startsWith("EROSION")) return "Erosion";
  if (src === "EMAIL") return "E-mail to TSA";
  if (src === "FORM") return "Web form";
  if (src === "CHAT") return "Chat";
  if (src === "AUTOMATION" || (t.objectSource ?? "").toUpperCase() === "AUTOMATION_PLATFORM" || (t.objectSource ?? "").toUpperCase() === "INTEGRATION") return "Campaigns & use cases";
  return "Other";
}

/** What became of it. */
export function outcomeOf(t: Ticket): Outcome {
  if (t.pipeline === BO) return "Sent to the Back Office";
  const r = (t.resolution ?? "").trim();
  if (r === OLD_NON_QUALIFIED || r === OUTBOUND_LABEL || r === FINANCE_LABEL) return "Not a request";
  if (r === "Ordered") return "Ordered";
  if (t.stage === STAGE.closed || r) return "Closed by TSA";
  return "Open";
}

/** The ISO week a day falls in, as its Monday (YYYY-MM-DD). */
export function weekOf(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}

export type Funnel = {
  total: number;
  ways: { way: Way; n: number; outcomes: Record<Outcome, number> }[];
  weeks: ({ week: string } & Record<Outcome, number>)[];
  /** The old one label, split by what it was. */
  nonQualified: { outbound: number; finance: number; other: number };
};
export function funnel(tickets: Ticket[]): Funnel {
  const blank = () => Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
  const ways = new Map<Way, { n: number; outcomes: Record<Outcome, number> }>();
  const weeks = new Map<string, Record<Outcome, number>>();
  const nq = { outbound: 0, finance: 0, other: 0 };
  for (const t of tickets) {
    const w = wayIn(t), o = outcomeOf(t);
    const row = ways.get(w) ?? { n: 0, outcomes: blank() };
    row.n++; row.outcomes[o]++; ways.set(w, row);
    const k = weekOf(t.created);
    const wk = weeks.get(k) ?? blank(); wk[o]++; weeks.set(k, wk);
    if (o === "Not a request") { if (w === "Outbound - TSA call") nq.outbound++; else if (w === "Finance reminder") nq.finance++; else nq.other++; }
  }
  return {
    total: tickets.length,
    ways: WAYS.filter((w) => ways.has(w)).map((w) => ({ way: w, ...ways.get(w)! })).sort((a, b) => b.n - a.n),
    weeks: [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, o]) => ({ week, ...o })),
    nonQualified: nq,
  };
}
