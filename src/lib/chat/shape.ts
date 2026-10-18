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
