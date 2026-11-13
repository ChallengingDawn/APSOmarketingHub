// A/B TESTING > MISSION CONTROL - every test the hub knows of, in one record (SARCLA 13.11.2026: "develop a lot the A/B
// testing tool, this is really not clear; it should record the past tests as well, and this should be connected with the
// tests in Webyn ... a mission control A/B testing, then completely different categories: pages that are sent to test, and
// microservices"). The figures and words of one test, pure (relative imports only: the tests load it as is).
//
// A test comes from one of four places, each with a stable key:
//   convert-<id>   APSOconvert's page tests (the hub's own, src/lib/convert/tests.ts)
//   webyn-<page>   Webyn's tests as the shop saw them (the gateway's /convert/webyn: its page, test group vs the page)
//   chat-<round>   the shop chat's e-mail test, one per round (the gateway's chat A/B, src/lib/chat/abtest.ts)
//   manual-<n>     typed in: an idea, a test of another tool, an earlier one - the past is recorded too
// What a SOURCE says (status, dates, arms) is refreshed by the sync; what a PERSON says (the decision, what we learned,
// the hypothesis, the owner, the score of an idea, a result another tool reported) is never written over.

import { rateOf, twoProportionP, type Rate } from "../chat/abStats";

export type Source = "apsoconvert" | "webyn" | "chat" | "manual";
export type Category = "page" | "microservice";
export type Status = "idea" | "planned" | "running" | "paused" | "ended";
export type Decision = "ship" | "keep-control" | "iterate" | "inconclusive";
export type Outcome = "won" | "lost" | "flat" | "too-early" | "no-data";

/** One version of a test; the control is the page or the service as it is. */
export type Arm = { key: string; name: string; control: boolean; visitors: number; conversions: number };
export type Ice = { impact: number; confidence: number; ease: number };

export type Experiment = {
  key: string; source: Source; category: Category;
  /** a microservice's id (chat, search-bar, directup ...); null for a page */
  service: string | null;
  /** the page's host and path, or the service's name */
  host: string | null; surface: string;
  name: string; hypothesis: string; metric: string;
  status: Status; startedAt: string | null; endedAt: string | null;
  arms: Arm[];
  /** a second figure the source also counts (the chat: who wrote) - shown, never deciding */
  secondary: { metric: string; arms: Arm[] } | null;
  /** the source's own verdict in words, when it has one */
  verdict: string | null;
  /** where the test is run from in the hub */
  link: string | null;
  /** what the test changes, as the source names it (Webyn's changes, APSOconvert's version) */
  changes: string[];
  // a person's
  decision: Decision | null; learning: string; owner: string | null; ice: Ice | null; notes: string;
  /** the result another tool reported (Webyn's dashboard), typed in */
  reported: string;
  decidedBy: string | null; decidedAt: string | null;
  createdBy: string | null; createdAt: string; updatedBy: string | null; updatedAt: string; syncedAt: string | null;
};

export const SOURCE_LABEL: Record<Source, string> = { apsoconvert: "APSOconvert", webyn: "Webyn", chat: "Shop chat", manual: "Recorded by hand" };
export const STATUS_LABEL: Record<Status, string> = { idea: "Idea", planned: "Planned", running: "Running", paused: "Paused", ended: "Ended" };
export const DECISION_LABEL: Record<Decision, string> = {
  ship: "Ship the winner", "keep-control": "Keep it as it is", iterate: "Test a new version", inconclusive: "No conclusion",
};
export const OUTCOME_LABEL: Record<Outcome, string> = {
  won: "Version won", lost: "Version lost", flat: "No real difference", "too-early": "Too early", "no-data": "No figures",
};
/** a version needs this many visitors, the control too, before an outcome is read */
export const MIN_ARM = 100;
const SIG = 0.05;

/** The services whose tests the hub can hold - with or without one running. */
export const SERVICES: { id: string; name: string; what: string }[] = [
  { id: "chat", name: "Shop chat", what: "When and how the chat asks for the e-mail, what it offers, how it hands over" },
  { id: "search-bar", name: "Search bar", what: "The smart search's results, its AI answers, what it shows first" },
  { id: "directup", name: "DirectUP", what: "The order tool: upload an order list, check the lines, put them in the cart" },
  { id: "3d", name: "3D gateway", what: "The 3D models and drawings on product pages" },
];

export type ArmFigures = Arm & { rate: Rate };
export type Reading = {
  arms: ArmFigures[];
  /** the best challenger against the control */
  best: { key: string; name: string; diff: number | null; lift: number | null; p: number | null } | null;
  outcome: Outcome;
  visitors: number;
};

/** The figures of a test: each arm's rate with its 95% range, the best version against the control, the outcome. */
export function readArms(arms: Arm[]): Reading {
  const withRate = arms.map((a) => ({ ...a, rate: rateOf(a.conversions, a.visitors) }));
  const visitors = arms.reduce((s, a) => s + a.visitors, 0);
  const control = withRate.find((a) => a.control);
  const others = withRate.filter((a) => !a.control && a.visitors > 0);
  if (!control || !others.length || !visitors) return { arms: withRate, best: null, outcome: "no-data", visitors };
  const scored = others.map((a) => {
    const diff = a.rate.rate !== null && control.rate.rate !== null ? a.rate.rate - control.rate.rate : null;
    return { key: a.key, name: a.name, diff, lift: diff !== null && control.rate.rate ? diff / control.rate.rate : null, p: twoProportionP(a.conversions, a.visitors, control.conversions, control.visitors), n: a.visitors };
  }).sort((x, y) => (y.diff ?? -1) - (x.diff ?? -1));
  const best = scored[0];
  const early = control.visitors < MIN_ARM || best.n < MIN_ARM;
  const outcome: Outcome = early ? "too-early" : best.p !== null && best.p < SIG ? ((best.diff ?? 0) > 0 ? "won" : "lost")
    // the best one is not clearly better: is any clearly worse?
    : scored.some((s) => s.p !== null && s.p < SIG && (s.diff ?? 0) < 0 && s.n >= MIN_ARM) ? "lost" : "flat";
  return { arms: withRate, best: { key: best.key, name: best.name, diff: best.diff, lift: best.lift, p: best.p }, outcome, visitors };
}

/** Needs a person: it ended (or a running one is clearly read) and nobody decided yet. */
export function needsDecision(e: Experiment, r = readArms(e.arms)): boolean {
  if (e.decision) return false;
  if (e.status === "ended") return true;
  return e.status === "running" && (r.outcome === "won" || r.outcome === "lost");
}

/** Days from the start to the end (or now). */
export function daysOf(e: Pick<Experiment, "startedAt" | "endedAt">, now = new Date()): number | null {
  if (!e.startedAt) return null;
  const end = e.endedAt ? new Date(e.endedAt) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(e.startedAt).getTime()) / 86_400_000));
}

/** Where a test runs - two running on the same place cannot be told apart. */
export const placeOf = (e: Pick<Experiment, "category" | "service" | "host" | "surface">) =>
  e.category === "microservice" ? `service:${e.service ?? e.surface}` : `${e.host ?? ""}${e.surface}`;

/** Running tests that share a page or a service (APSOconvert and Webyn on one page, two chat tests ...). */
export function clashes(list: Experiment[]): { place: string; keys: string[] }[] {
  const by = new Map<string, string[]>();
  for (const e of list) if (e.status === "running" || e.status === "paused") by.set(placeOf(e), [...(by.get(placeOf(e)) ?? []), e.key]);
  return [...by].filter(([, k]) => k.length > 1).map(([place, keys]) => ({ place, keys }));
}

/** An idea's score: the mean of impact, confidence and ease (each 1-10), one decimal. */
export const iceScore = (i: Ice | null) => (i ? Math.round(((i.impact + i.confidence + i.ease) / 3) * 10) / 10 : null);

/* ── the sources, mapped (the shapes as the gateway gives them) ── */

export type ChatRoundIn = {
  v: number; current: boolean; on: boolean; firstAt: string | null; lastAt: string | null;
  /** All countries: per variant, visitors who opened the chat, who wrote, who gave an e-mail */
  arms: { variant: "later" | "first" | "mid"; visitors: number; chats: number; emails: number }[];
  verdict: string | null;
};
const CHAT_NAME: Record<string, string> = { later: "E-mail later (today's chat)", first: "E-mail first", mid: "Summary mid-chat" };
export function fromChatRound(r: ChatRoundIn): Omit<Experiment, PersonFields> {
  const variants = r.arms.filter((a) => a.visitors > 0 || r.current);
  const order = ["later", "first", "mid"];
  const sorted = [...variants].sort((a, b) => order.indexOf(a.variant) - order.indexOf(b.variant));
  const running = r.current && r.on;
  return {
    key: `chat-${r.v}`, source: "chat", category: "microservice", service: "chat", host: null, surface: "Shop chat",
    name: `Chat: the e-mail - round ${r.v} (${sorted.map((a) => CHAT_NAME[a.variant].replace(/ \(.*\)$/, "")).join(" / ")})`,
    metric: "Gave an e-mail, per visitor who opened the chat",
    status: running ? "running" : "ended", startedAt: r.firstAt, endedAt: running ? null : r.lastAt,
    arms: sorted.map((a) => ({ key: a.variant, name: CHAT_NAME[a.variant], control: a.variant === "later", visitors: a.visitors, conversions: a.emails })),
    secondary: { metric: "Wrote a message, per visitor who opened the chat", arms: sorted.map((a) => ({ key: a.variant, name: CHAT_NAME[a.variant], control: a.variant === "later", visitors: a.visitors, conversions: a.chats })) },
    verdict: r.verdict, link: "/website/ab-testing/chat", changes: sorted.filter((a) => a.variant !== "later").map((a) => CHAT_NAME[a.variant]),
  };
}

export type WebynPageIn = {
  page: string; first_at: string; last_at: string;
  groups: { t: { visitors: number; carted: number }; o: { visitors: number; carted: number } };
  paths: { host: string; path: string; visitors: number }[];
  params: { id: string; version: string | null; name: string | null; type: string | null }[];
};
/** A Webyn page is a test once its test group was seen (else Webyn only measures that page). Quiet 3 days: ended. */
export function fromWebynPage(w: WebynPageIn, now = new Date()): Omit<Experiment, PersonFields> | null {
  if (!w.groups.t.visitors && !w.params.length) return null;
  const top = w.paths[0] ?? null;
  const ab = w.params.filter((p) => !p.type || p.type === "None");
  const names = [...new Set((ab.length ? ab : w.params).map((p) => p.name).filter((n): n is string => !!n))];
  const quiet = now.getTime() - new Date(w.last_at).getTime() > 3 * 86_400_000;
  return {
    key: `webyn-${w.page}`, source: "webyn", category: "page", service: null, host: top?.host ?? null, surface: top?.path ?? `Webyn page ${w.page}`,
    name: names.length ? `Webyn: ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}` : `Webyn test on ${top?.path ?? w.page}`,
    metric: "Put something in the cart, per visitor of the page",
    status: quiet ? "ended" : "running", startedAt: w.first_at, endedAt: quiet ? w.last_at : null,
    arms: [
      { key: "o", name: "The page as it is", control: true, visitors: w.groups.o.visitors, conversions: w.groups.o.carted },
      { key: "t", name: "Webyn's version", control: false, visitors: w.groups.t.visitors, conversions: w.groups.t.carted },
    ],
    secondary: null, verdict: null, link: null, changes: names,
  };
}

export type PersonFields = "hypothesis" | "decision" | "learning" | "owner" | "ice" | "notes" | "reported" | "decidedBy" | "decidedAt"
  | "createdBy" | "createdAt" | "updatedBy" | "updatedAt" | "syncedAt";
