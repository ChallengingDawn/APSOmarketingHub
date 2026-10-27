// CHAT STEERING - where the settings live and what the topic tabs show (rules: steeringRules.ts). The master copy is
// the hub's kv "chat:steering"; every save keeps what was there before under "chat:steering:log:<time>". The figures
// come from the hub's own filing of every chat (topics.ts, apsomh_chat_filing: Enquiry Category + sub-categories
// from the whole chat) and, for the hand-overs, the ticket's state in HubSpot now.

import { query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { ownerNames } from "@/lib/integrations/erosion";
import { definitions } from "./topics";
import { orchestrator, orchestratorKey } from "./orchestrator";
import { adminToken as searchBarKey, gateway as searchBarGateway } from "@/lib/searchbar/gateway";
import { NO_REQUEST } from "./shape";
import { DEFAULT_STEERING, STEERING_TOPICS, cleanSteering, routeFor, todayRoute, type Route, type Steering } from "./steeringRules";

const KV = "chat:steering";

export async function getSteering(): Promise<Steering> {
  const s = await kvGet<Steering>(KV).catch(() => undefined);
  return s?.topics ? s : DEFAULT_STEERING;
}

/** HubSpot's sub-category options of each topic (level 1 and 2), read live. */
export async function topicOptions(): Promise<Record<string, { sub1: string[]; sub2: string[] }>> {
  const defs = await definitions();
  return Object.fromEntries(STEERING_TOPICS.map((t) => {
    const d = defs.find((x) => x.value === t);
    return [t, { sub1: d?.sub1?.options ?? [], sub2: d?.sub2?.options ?? [] }];
  }));
}

export async function saveSteering(input: unknown, by: string): Promise<{ steering: Steering; pushed: boolean }> {
  const prev = await getSteering();
  const next = { ...cleanSteering(input, await topicOptions(), prev), by, at: new Date().toISOString() };
  await kvSet(`${KV}:log:${next.at}`, prev);               // what was there before - the change can be put back
  await kvSet(KV, next);
  figuresCache.clear();
  return { steering: next, pushed: await pushSteering(next) };
}

/* ── the chat's brain (the orchestrator on Railway) ──────────────────────────────────────────────── */
// The brain cannot reach the hub (no public way in), so the hub pushes: on every save, and whenever the page sees the
// brain holding an older version. The brain uses them in SHADOW only - it logs where they would send each hand-over.

async function pushSteering(s: Steering): Promise<boolean> {
  if (!orchestratorKey()) return false;
  try {
    await orchestrator("/dashboard/steering", { method: "PUT", body: s, timeoutMs: 10_000 });
    return true;
  } catch (e) {
    console.warn(`[chat-steering] routes v${s.version} not sent to the brain: ${(e as Error).message}`);
    return false;
  }
}

export type BrainState = { reachable: boolean; held: boolean; version: number | null };
async function brainState(s: Steering): Promise<BrainState> {
  if (!orchestratorKey()) return { reachable: false, held: false, version: null };
  try {
    let b = await orchestrator<{ held: boolean; version?: number }>("/dashboard/steering", { timeoutMs: 8_000 });
    if (!b.held || b.version !== s.version) {                // behind (a lost push, a new brain): send them again
      if (await pushSteering(s)) b = { held: true, version: s.version };
    }
    return { reachable: true, held: !!b.held, version: b.held ? b.version ?? null : null };
  } catch {
    return { reachable: false, held: false, version: null };
  }
}

type ShadowRow = { category_code: string | null; handler: string | null; steer_route: string | null; n: number };
/** The brain's own shadow log: per topic, its real hand-overs and where the routes would have sent them. */
async function brainShadow(fromIso: string): Promise<ShadowRow[] | null> {
  if (!orchestratorKey()) return null;
  const days = Math.max(1, Math.ceil((Date.now() - Date.parse(fromIso)) / 86_400_000));
  try {
    return (await orchestrator<{ rows: ShadowRow[] }>(`/dashboard/steering-shadow?days=${days}`, { timeoutMs: 10_000 })).rows ?? [];
  } catch {
    return null;
  }
}

/* ── the figures ─────────────────────────────────────────────────────────────────────────────────── */

export type SubFigures = { level: 1 | 2; value: string; chats: number; aiAlone: number; tsa: number; bo: number };
export type OpenHandover = { ticketId: string; summary: string; handedAt: string | null; owner: string | null; stage: string | null; today: Route; steering: Route | null };
/** the brain's shadow for one topic: its real hand-overs of the period, and where the routes would have sent them */
export type TopicShadow = { handovers: number; elsewhere: number; would: Record<Route | "none", number> };
export type TopicFigures = {
  topic: string; chats: number; aiAlone: number; tsa: number; bo: number;
  /** hand-overs the topic's routes would have sent elsewhere than the chat did */
  elsewhere: number;
  subs: SubFigures[]; open: OpenHandover[]; openTotal: number;
  /** hand-overs whose ticket is closed in HubSpot now */
  closedTotal: number;
  /** HubSpot chat only: the brain's own log (null = the brain could not be asked) */
  shadow?: TopicShadow | null;
};
export type SteeringData = {
  steering: Steering; options: Record<string, { sub1: string[]; sub2: string[] }>; topics: TopicFigures[]; noRequest: number; from: string; openRead: boolean;
  /** HubSpot chat only: does the chat's brain hold these routes */
  brain?: BrainState;
};

const figuresCache = new Map<string, { at: number; d: SteeringData }>();
type Row = { category: string; sub1: string | null; sub2: string | null; handed: boolean; team: string | null; ticket_id: string | null; summary: string; last_at: string | null };
type Ticket = { id: string; properties: Record<string, string | null> };

let stagesCache: { at: number; m: Map<string, string> } | null = null;
async function stageNames(): Promise<Map<string, string>> {
  if (stagesCache && Date.now() - stagesCache.at < 60 * 60_000) return stagesCache.m;
  const m = new Map<string, string>();
  const r = await hubspotFetchJson<{ results?: { label: string; stages: { id: string; label: string }[] }[] }>({ path: "/crm/v3/pipelines/tickets" });
  for (const p of r.results ?? []) for (const s of p.stages) m.set(s.id, `${p.label} · ${s.label.trim()}`);
  stagesCache = { at: Date.now(), m };
  return m;
}

/** The handed-over chats' tickets as they are in HubSpot now (open = no close date). 300 at most, newest first. */
async function handedTickets(ids: string[]): Promise<Map<string, Ticket> | null> {
  const out = new Map<string, Ticket>();
  try {
    for (let i = 0; i < ids.length; i += 100) {
      const r = await hubspotFetchJson<{ results?: Ticket[] }>({
        path: "/crm/v3/objects/tickets/batch/read", method: "POST",
        body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id", "closed_date", "createdate"] },
      });
      for (const t of r.results ?? []) out.set(String(t.id), t);
    }
    return out;
  } catch (e) {
    console.warn(`[chat-steering] hand-over tickets not read: ${(e as Error).message}`);
    return null;
  }
}

/* ── the search bar chat's hand-overs: its form to the team (SARCLA 27.10.2026: "search bar chat should have the same
   KPIs, with the form submission to the teams") ─────────────────────────────────────────────────────────────────── */
// The bar's chat hands over with a form (name, e-mail, category): the smart-bar gateway writes the contact, the team's
// contact workflow makes the ticket, and the gateway keeps each form (/api/smart-bar/handoffs: category, sub-category,
// the contact, no e-mail). Handed = a form HubSpot took; TSA or Back Office = the pipeline of the ticket it made (the
// topic's route while none is found); open / closed = that ticket now.
type Handoff = { at: string; locale: string | null; category: string | null; sub_category: string | null; hubspot_ok: boolean; contact_id: string | null };
async function barHandoffs(fromIso: string): Promise<Handoff[] | null> {
  if (!searchBarKey()) return null;
  const days = Math.max(1, Math.ceil((Date.now() - Date.parse(fromIso)) / 86_400_000));
  try {
    const r = await searchBarGateway<{ handoffs?: Handoff[] }>(`/api/smart-bar/handoffs?days=${days}`, { timeoutMs: 10_000 });
    return (r.handoffs ?? []).filter((h) => Date.parse(h.at) >= Date.parse(fromIso));
  } catch {
    return null;
  }
}
const BO_PIPELINE = "1726786777";
const pipelineRoute = (t: Ticket | undefined): Route | null => (t?.properties.hs_pipeline ? (t.properties.hs_pipeline === BO_PIPELINE ? "bo" : "tsa") : null);
/** each form's ticket: the contact's first ticket created from the form on (within two days), as HubSpot holds it now */
async function formTickets(handoffs: Handoff[]): Promise<Map<Handoff, Ticket> | null> {
  const mine = handoffs.filter((h) => h.hubspot_ok && h.contact_id).slice(0, 300);
  const out = new Map<Handoff, Ticket>();
  if (!mine.length) return out;
  try {
    const contacts = [...new Set(mine.map((h) => String(h.contact_id)))];
    const byContact = new Map<string, string[]>();
    for (let i = 0; i < contacts.length; i += 100) {
      const r = await hubspotFetchJson<{ results?: { from: { id: string }; to: { toObjectId: number | string }[] }[] }>({
        path: "/crm/v4/associations/contacts/tickets/batch/read", method: "POST", body: { inputs: contacts.slice(i, i + 100).map((id) => ({ id })) },
      });
      for (const x of r.results ?? []) byContact.set(String(x.from.id), x.to.map((t) => String(t.toObjectId)));
    }
    const tickets = await handedTickets([...new Set([...byContact.values()].flat())].slice(0, 500));
    if (!tickets) return null;
    for (const h of mine) {
      const at = Date.parse(h.at);
      const t = (byContact.get(String(h.contact_id)) ?? []).map((id) => tickets.get(id)).filter((x): x is Ticket => !!x)
        .filter((x) => { const c = Date.parse(x.properties.createdate ?? ""); return c >= at - 5 * 60_000 && c <= at + 2 * 86_400_000; })
        .sort((a, b) => Date.parse(a.properties.createdate ?? "") - Date.parse(b.properties.createdate ?? ""))[0];
      if (t) out.set(h, t);
    }
    return out;
  } catch (e) {
    console.warn(`[chat-steering] search bar form tickets not read: ${(e as Error).message}`);
    return null;
  }
}

async function barData(fromIso: string, steering: Steering, options: Record<string, { sub1: string[]; sub2: string[] }>): Promise<SteeringData> {
  const rows = (await query<Row>(
    `SELECT category, sub1, sub2, handed, team, ticket_id, summary, last_at FROM apsomh_chat_filing
      WHERE source = 'searchbar' AND started_at >= $1 ORDER BY last_at DESC NULLS LAST`, [fromIso])).rows;
  const handoffs = await barHandoffs(fromIso);
  const [tickets, stages, names] = await Promise.all([
    handoffs ? formTickets(handoffs) : Promise.resolve(null),
    stageNames().catch(() => new Map<string, string>()),
    ownerNames().catch(() => new Map<string, string>()),
  ]);
  const norm = (r: Route | null): Route | null => (r === "ecom" ? "bo" : r);
  const topics: TopicFigures[] = STEERING_TOPICS.map((topic) => {
    const chats = rows.filter((r) => r.category === topic);
    const forms = (handoffs ?? []).filter((h) => h.hubspot_ok && h.category === topic);
    const route = (h: Handoff) => pipelineRoute(tickets?.get(h)) ?? norm(routeFor(steering, topic, h.sub_category, null)) ?? "tsa";
    const split = (list: Handoff[]) => ({ tsa: list.filter((h) => route(h) === "tsa").length, bo: list.filter((h) => route(h) === "bo").length });
    const subFig = (level: 1 | 2, value: string): SubFigures => {
      const c = chats.filter((r) => (level === 1 ? r.sub1 : r.sub2) === value).length;
      const f = level === 1 ? forms.filter((h) => h.sub_category === value) : [];
      return { level, value, chats: c, aiAlone: Math.max(0, c - f.length), ...split(f) };
    };
    const withTicket = forms.filter((h) => tickets?.has(h));
    const openForms = withTicket.filter((h) => !tickets!.get(h)!.properties.closed_date);
    return {
      topic, chats: chats.length, aiAlone: Math.max(0, chats.length - forms.length), ...split(forms),
      elsewhere: forms.filter((h) => norm(routeFor(steering, topic, h.sub_category, null)) !== route(h)).length,
      subs: [...options[topic].sub1.map((v) => subFig(1, v)), ...options[topic].sub2.map((v) => subFig(2, v))],
      open: openForms.slice(0, 50).map((h): OpenHandover => {
        const t = tickets!.get(h)!;
        return {
          ticketId: String(t.id), summary: `Search bar form: ${h.sub_category || topic}`, handedAt: h.at,
          owner: t.properties.hubspot_owner_id ? names.get(t.properties.hubspot_owner_id) ?? t.properties.hubspot_owner_id : null,
          stage: t.properties.hs_pipeline_stage ? stages.get(t.properties.hs_pipeline_stage) ?? t.properties.hs_pipeline_stage : null,
          today: route(h), steering: routeFor(steering, topic, h.sub_category, null),
        };
      }),
      openTotal: openForms.length, closedTotal: withTicket.length - openForms.length,
    };
  });
  return { steering, options, topics, noRequest: rows.filter((r) => r.category === NO_REQUEST).length, from: fromIso, openRead: handoffs !== null && tickets !== null };
}

/** channel: "hs" = HubSpot's chat (the shop's bubble and the www chatflow, each with a ticket), "bar" = the search
 *  bar's AI chat (its hand-over is the form to the team) - the page's master switch (SARCLA 27.10.2026). */
export type Channel = "hs" | "bar";
export async function steeringData(fromIso: string, channel: Channel = "hs"): Promise<SteeringData> {
  const ck = `${channel}:${fromIso.slice(0, 13)}`;
  const hit = figuresCache.get(ck);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.d;
  const [steering, options] = await Promise.all([getSteering(), topicOptions()]);
  if (channel === "bar") {
    const d = await barData(fromIso, steering, options);
    figuresCache.set(ck, { at: Date.now(), d });
    return d;
  }
  const rows = (await query<Row>(
    `SELECT category, sub1, sub2, handed, team, ticket_id, summary, last_at FROM apsomh_chat_filing
      WHERE source = 'chat' AND started_at >= $1 ORDER BY last_at DESC NULLS LAST`, [fromIso])).rows;
  const handedIds = [...new Set(rows.filter((r) => r.handed && r.ticket_id && (STEERING_TOPICS as readonly string[]).includes(r.category)).map((r) => String(r.ticket_id)))].slice(0, 300);
  const hs = channel === "hs";
  const [tickets, stages, names, brain, shadowRows] = await Promise.all([
    handedTickets(handedIds),
    stageNames().catch(() => new Map<string, string>()),
    ownerNames().catch(() => new Map<string, string>()),
    hs ? brainState(steering) : Promise.resolve(undefined),
    hs ? brainShadow(fromIso) : Promise.resolve(null),
  ]);
  const shadowOf = (topic: string): TopicShadow | null => {
    if (!shadowRows) return null;
    const mine = shadowRows.filter((r) => r.category_code === topic);
    const would: Record<Route | "none", number> = { tsa: 0, bo: 0, ecom: 0, none: 0 };
    let elsewhere = 0;
    for (const r of mine) {
      const w = (["tsa", "bo", "ecom"].includes(r.steer_route ?? "") ? r.steer_route : "none") as Route | "none";
      would[w] += Number(r.n);
      const real = r.handler === "BO" ? "bo" : r.handler === "TSA" ? "tsa" : null;
      if (real && w !== "none" && (w === "ecom" ? "bo" : w) !== real) elsewhere += Number(r.n);
    }
    return { handovers: mine.reduce((a, r) => a + Number(r.n), 0), elsewhere, would };
  };
  const topics: TopicFigures[] = STEERING_TOPICS.map((topic) => {
    const mine = rows.filter((r) => r.category === topic);
    const count = (list: Row[]) => ({
      chats: list.length, aiAlone: list.filter((r) => !r.handed).length,
      tsa: list.filter((r) => r.handed && todayRoute(r.team) === "tsa").length, bo: list.filter((r) => r.handed && todayRoute(r.team) === "bo").length,
    });
    // the shop bug goes through the Back Office's stage today: E-Commerce counts as the Back Office here
    const same = (a: Route | null, b: Route) => (a === "ecom" ? "bo" : a) === b;
    const subs: SubFigures[] = [
      ...options[topic].sub1.map((value) => ({ level: 1 as const, value, ...count(mine.filter((r) => r.sub1 === value)) })),
      ...options[topic].sub2.map((value) => ({ level: 2 as const, value, ...count(mine.filter((r) => r.sub2 === value)) })),
    ];
    const isOpen = (r: Row) => { const t = r.ticket_id ? tickets?.get(String(r.ticket_id)) : undefined; return t ? !t.properties.closed_date : null; };
    const closedTotal = mine.filter((r) => r.handed && isOpen(r) === false).length;
    const openList = mine.filter((r) => r.handed && isOpen(r) === true).map((r): OpenHandover => {
      const t = tickets!.get(String(r.ticket_id))!;
      return {
        ticketId: String(r.ticket_id), summary: r.summary, handedAt: t.properties.createdate ?? r.last_at,
        owner: t.properties.hubspot_owner_id ? names.get(t.properties.hubspot_owner_id) ?? t.properties.hubspot_owner_id : null,
        stage: t.properties.hs_pipeline_stage ? stages.get(t.properties.hs_pipeline_stage) ?? t.properties.hs_pipeline_stage : null,
        today: todayRoute(r.team), steering: routeFor(steering, topic, r.sub1, r.sub2),
      };
    });
    return {
      topic, ...count(mine),
      elsewhere: mine.filter((r) => r.handed && !same(routeFor(steering, topic, r.sub1, r.sub2), todayRoute(r.team))).length,
      subs, open: openList.slice(0, 50), openTotal: openList.length, closedTotal,
      ...(hs ? { shadow: shadowOf(topic) } : {}),
    };
  });
  const d: SteeringData = { steering, options, topics, noRequest: rows.filter((r) => r.category === NO_REQUEST).length, from: fromIso, openRead: tickets !== null, ...(brain ? { brain } : {}) };
  figuresCache.set(ck, { at: Date.now(), d });
  return d;
}
