// CHAT STEERING - the rules, pure (SARCLA 26-27.10.2026: "really steering tabs with the different topics"; "here you
// have to follow the enquiry category really and the sub-categories, this is a very important part"). The AI always
// tries first; only when a person is needed does the topic's route apply:
//   tsa  - a sales topic: an available TSA person at once (Mon-Fri 08-17), else the TSA stage until someone takes it;
//   bo   - not sales: the Back Office, stage CHAT/C2S Issue, owner = ERP sales agent > SA Sub > least busy, a call
//          within the hour (the ticket is the call), an older ticket on the same order merged into the chat's;
//   ecom - the shop bug (Website Issue / Other Issue) to the E-Commerce team, as the chat's workflow does today.
// One tab per Enquiry Category (HubSpot's own values, no "Others"); a sub-category (level 1 or 2) can take another
// route than its topic, the more precise rule wins. Kept in the hub (kv chat:steering, steering.ts); the chat does
// not use it until a topic is switched live.

export type Route = "tsa" | "bo" | "ecom";
export const ROUTE_LABEL: Record<Route, string> = { tsa: "TSA", bo: "Back Office call-back", ecom: "E-Commerce team" };
export type SubRule = { level: 1 | 2; value: string; route: Route };
export type TopicSteering = { route: Route; subs: SubRule[] };
export type Steering = {
  version: number;
  /** today's rule in the chat: an order number in the chat always means the Back Office */
  orderNumberToBo: boolean;
  topics: Record<string, TopicSteering>;
  /** per topic: does the chat use these routes yet (all off until the chat's brain applies them) */
  live: Record<string, boolean>;
  by: string | null; at: string | null;
};

/** The tabs, in HubSpot's own words and order of importance for the chat. */
export const STEERING_TOPICS = ["Product Information", "Product Price", "Delivery", "Website Issue", "Invoicing & Accounting", "Order Cancellation"] as const;
export const topicSlug = (t: string) => t.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The starting values (SARCLA 27.10.2026, "show me the tabs mapping and let's move"). */
export const DEFAULT_STEERING: Steering = {
  version: 1,
  orderNumberToBo: true,
  topics: {
    "Product Information": { route: "tsa", subs: [
      { level: 1, value: "3D Model request", route: "bo" },
      { level: 1, value: "Conformities / Certificates", route: "bo" },
      { level: 2, value: "Technical question on conformities", route: "tsa" },
    ] },
    "Product Price": { route: "tsa", subs: [
      { level: 1, value: "Wrong price on my order", route: "bo" },
      { level: 2, value: "Can't use C2S or QuickOrder", route: "bo" },
    ] },
    "Delivery": { route: "bo", subs: [
      { level: 1, value: "Pre Order", route: "tsa" },
      { level: 2, value: "I have not yet placed an order", route: "tsa" },
    ] },
    "Website Issue": { route: "bo", subs: [
      { level: 1, value: "Login Issue", route: "bo" },
      { level: 1, value: "Other Issue", route: "ecom" },
    ] },
    "Invoicing & Accounting": { route: "bo", subs: [] },
    "Order Cancellation": { route: "bo", subs: [] },
  },
  live: {},
  by: null, at: null,
};

/** The route a chat of this category / sub-category takes - sub-category 2 before 1 before the topic. Null: no topic
 *  (no request, an unknown or retired value) - the AI keeps the chat. */
export function routeFor(s: Steering, category: string | null | undefined, sub1?: string | null, sub2?: string | null): Route | null {
  const t = category ? s.topics[category] : undefined;
  if (!t) return null;
  const r2 = sub2 ? t.subs.find((x) => x.level === 2 && x.value === sub2) : undefined;
  if (r2) return r2.route;
  const r1 = sub1 ? t.subs.find((x) => x.level === 1 && x.value === sub1) : undefined;
  return r1 ? r1.route : t.route;
}

/** Where the chat sends a hand-over TODAY, as it logs it: back_office / finance / marketing = Back Office, else TSA. */
export function todayRoute(routingTeam: string | null | undefined): Route {
  return ["back_office", "finance", "marketing"].includes(routingTeam ?? "") ? "bo" : "tsa";
}

const ROUTES: Route[] = ["tsa", "bo", "ecom"];
/**
 * A steering sent by the page, checked against HubSpot's options: only the six topics, a route each, sub-category rules
 * only on values the topic really has (level 1 or 2), no rule twice. Throws a sentence the page can show.
 */
export function cleanSteering(input: unknown, options: Record<string, { sub1: string[]; sub2: string[] }>, prev: Steering): Steering {
  const o = (input ?? {}) as Partial<Steering>;
  const topics: Steering["topics"] = {};
  for (const topic of STEERING_TOPICS) {
    const t = (o.topics ?? {})[topic] ?? prev.topics[topic];
    if (!t || !ROUTES.includes(t.route)) throw new Error(`${topic}: pick TSA, Back Office or E-Commerce`);
    const opts = options[topic] ?? { sub1: [], sub2: [] };
    const seen = new Set<string>();
    const subs: SubRule[] = [];
    for (const r of Array.isArray(t.subs) ? t.subs : []) {
      const level = r.level === 2 ? 2 : 1;
      if (!(level === 1 ? opts.sub1 : opts.sub2).includes(r.value)) throw new Error(`${topic}: "${String(r.value).slice(0, 60)}" is not one of its sub-categories in HubSpot`);
      if (!ROUTES.includes(r.route)) throw new Error(`${topic} / ${r.value}: pick TSA, Back Office or E-Commerce`);
      const k = `${level}:${r.value}`;
      if (seen.has(k)) continue;
      seen.add(k);
      subs.push({ level, value: r.value, route: r.route });
    }
    topics[topic] = { route: t.route, subs };
  }
  return {
    version: prev.version + 1,
    orderNumberToBo: typeof o.orderNumberToBo === "boolean" ? o.orderNumberToBo : prev.orderNumberToBo,
    topics,
    live: prev.live,                                   // switched on per topic only once the chat applies it
    by: null, at: null,
  };
}
