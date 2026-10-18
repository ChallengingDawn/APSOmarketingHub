// CHAT - what the orchestrator answers, and two helpers: no server imports, so the page's client components can
// use it (src/lib/chat/orchestrator.ts holds the key and the database setting and must stay on the server).

export type Health = { status: "healthy" | "degraded" | "unhealthy"; redis: string; postgres: string; hubspot: string; embedding: string; claude: string };

/** Numbers come back from Postgres as strings (COUNT, SUM, AVG). */
type N = number | string | null;
/** unit: "chats" from /dashboard/chat-stats (18.10.2026); "messages" when the hub had to fall back to /dashboard/stats,
 *  which counts a row per message - 545 rows were 222 chats in the 30 days to 18.10.2026. */
export type Unit = "chats" | "messages";
export type Stats = {
  unit?: Unit;
  period: { days: number; since: string };
  totals: { total: N; escalated: N; avg_turns: N };
  byCategory: { category: string; count: N }[];
  byLanguage: { language: string; count: N }[];
  byDay: { date: string; total: N; escalated: N }[];
  escalationByTeam: { routing_team: string | null; count: N }[];
};

export type Conversation = {
  id: number; session_hash: string; hubspot_contact_id: string | null; language_code: string | null;
  category_code: string | null; sub_l1: string | null; sub_l2: string | null; routing_team: string | null;
  escalated: boolean; escalation_reason: string | null; hubspot_ticket_id: string | null; turns_count: number;
  started_at: string; debug_log?: string | null; handler?: string | null;
  /** per chat (/dashboard/chats): customer messages and the last one's time */
  messages?: number; last_at?: string;
  /** filed by the hub after the chat (Topics): its topic, one-line summary, whether a person wrote, who filed it */
  topic?: string; summary?: string; agent_wrote?: boolean | null; by?: string;
};
export type Conversations = { unit?: Unit; conversations: Conversation[]; total: number; limit: number; offset: number };

export type Turn = { role: string; content?: string; text?: string; ts?: string | number };
export type ConversationDetail = { log: Conversation | null; session: { turns?: Turn[] } & Record<string, unknown> | null };

/** POST /dashboard/test-dry: the AI's answer to one message, as the chatflow gets it (processTurn), written nowhere. */
export type TestAnswer = {
  reply?: string; enquiry_category?: string; sub_l1?: string; sub_l2?: string; intent?: string; routing_team?: string | null;
  escalate?: boolean; conversation_summary?: string; order_number?: string; article_skus?: string;
  product_links?: unknown; turn_count?: number; duration_ms?: number;
  _dryRun?: boolean; _ms?: number; _conversationId?: string;
};

export const num = (v: N | undefined) => (v == null ? 0 : Number(v) || 0);

/** Who handles a conversation, as the old dashboard put it: the AI, or the team it was handed to. */
export function handlerOf(c: Pick<Conversation, "escalated" | "routing_team" | "handler">): "AI" | "BO" | "TSA" | string {
  if (c.handler) return c.handler;
  if (!c.escalated) return "AI";
  return ["back_office", "finance", "marketing"].includes(c.routing_team ?? "") ? "BO" : "TSA";
}

/** One line of a chat as HubSpot holds it (src/lib/chat/transcript.ts): who wrote, when, what. */
export type TranscriptItem = { at: string; who: "customer" | "ai" | "agent" | "system"; name: string | null; text: string };
/** A whole chat from HubSpot, with its hand-over: when the bot let go, who took it, when a person first wrote. */
export type Transcript = {
  threadId: string; status: string; inbox: string | null; openedAt: string | null; closedAt: string | null;
  handedAt: string | null; agent: { name: string | null; at: string } | null; agentFirstReplyAt: string | null;
  agentMessages: number; items: TranscriptItem[]; link: string;
};

/** The chat went live on the shop on 13.04.2026; 23.03-12.04 was the test phase (~9,300 scripted chats, no
 *  tickets). Counts start here so the test phase neither swamps the chart nor fills "Not classified". */
export const LIVE_FROM = "2026-04-13";

/** The fixed topics a chat is filed under after it ended (src/lib/chat/topics.ts) - the customer's main reason. */
export const TOPICS = [
  { key: "order_status", label: "Order status & delivery", hint: "where is my order, delivery date, tracking, late, shipping costs" },
  { key: "price_quote", label: "Price & quote", hint: "a price, a quote or offer, a discount, the price not shown, volume prices" },
  { key: "product_choice", label: "Product choice & technical", hint: "which product or material fits, temperature, media, dimensions, compatibility" },
  { key: "find_article", label: "Find an article", hint: "looking for a part number, an equivalent of another brand's part, a special article" },
  { key: "availability", label: "Stock & lead time", hint: "in stock?, lead time, minimum order quantity" },
  { key: "order_change", label: "Change or cancel an order", hint: "cancel, change quantity or address" },
  { key: "invoice_payment", label: "Invoice & payment", hint: "invoice, payment method, VAT, credit note" },
  { key: "certificates", label: "Certificates & documents", hint: "DoC, FDA, 3.1 certificate, CAD or 3D files, data sheets" },
  { key: "account_website", label: "Account & website", hint: "login, registration, password, a website error, the cart" },
  { key: "returns_complaint", label: "Return or complaint", hint: "wrong or faulty part, a return, a complaint" },
  { key: "samples", label: "Samples", hint: "free samples" },
  { key: "wants_person", label: "Only wants a person", hint: "asks only for a human, a phone number or a contact, nothing else" },
  { key: "other", label: "Other", hint: "spam, a test, a greeting only, unrelated" },
] as const;
export type TopicKey = (typeof TOPICS)[number]["key"];
/** a chat HubSpot no longer holds is kept as "unreadable" so it is not asked for again */
export const topicLabel = (k: string) => (TOPICS.find((t) => t.key === k)?.label ?? (k === "unreadable" ? "Could not be read" : k));

/** One run of the filing job. */
export type TopicsRun = { at: string; ok: boolean; filed: number; unreadable: number; failed: number; waiting: number | null; error: string | null };
