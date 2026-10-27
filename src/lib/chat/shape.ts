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
  /** filed by the hub after the chat (Topics): its Enquiry Category and sub-category, the one-line summary, whether a
   *  person wrote, who filed it, and the filing's key (to correct it) */
  topic?: string; topic_sub1?: string | null; summary?: string; agent_wrote?: boolean | null; by?: string; filing_key?: string;
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

/**
 * What a chat is filed under: the ticket property **Enquiry Category** and its sub-categories, exactly as HubSpot
 * defines them (SARCLA 18.10.2026: "these definitions should be the property's ones" - read from
 * /crm/v3/properties/tickets on 18.10.2026; the filing job re-reads them from HubSpot on every run, this copy is for
 * the page and as the fallback). Each category keeps its own sub-category fields and its "add more details" box -
 * the TICKET's field names (the orchestrator's map holds three contact-style names the ticket does not have).
 */
export type SubDef = { prop: string; options: string[] };
export type CategoryDef = { value: string; sub1?: SubDef; sub2?: SubDef; text?: string; hint: string; aiChoice: boolean };

export const CATEGORIES: CategoryDef[] = [
  { value: "Product Information", hint: "a technical question, which product or material fits, finding a product or an alternative, a data sheet, a 3D model, the minimum order quantity, certificates and conformities", aiChoice: true,
    sub1: { prop: "enquiry_sub_category___product_information___1", options: ["Technical question on a product", "I need an alternative on a existing product", "Product cannot be found in the shop/Alternative products", "Technical Data Sheet request", "3D Model request", "Minimum order quantity for a product", "Conformities / Certificates"] },
    sub2: { prop: "enquiry_sub_category___product_information___2", options: ["Technical question on a product", "Costumer knows AP reference but can't find on shop (old article or no sales permission) and when the article is orderable but only via Quick Order", "Cannot find product", "Technical Data Sheet request", "3D Model request", "Minimum order quantity for a product", "Costumer documentation EDA requests", "Company certificates ISO", "Self-declaration APSO for supplier creation", "Ongoing or past ordered certificates", "Technical question on conformities", "Certificates on order"] },
    text: "enquiry_textbox___product_information" },
  { value: "Product Price", hint: "a price, the price not shown, a quotation, a wrong price on an order", aiChoice: true,
    sub1: { prop: "enquiry_sub_category___price_1", options: ["Price is not visible", "Request for quotation", "Wrong price on my order"] },
    sub2: { prop: "enquiry_sub_category___price_2", options: ["Can't use C2S or QuickOrder", "No account at APSO", "Request for quotation", "Order price is incorrect or missing"] },
    text: "enquiry_textbox___price" },
  { value: "Delivery", hint: "where an order is, a delivery date, a late delivery, a faster lead time, returning goods", aiChoice: true,
    sub1: { prop: "enquiry_sub_category___delivery___1", options: ["Pre Order", "Existing Order", "Previous Order", "Return Goods"] },
    sub2: { prop: "enquiry_sub_category___delivery___2", options: ["I have not yet placed an order", "Delivery is late", "I require faster lead time", "Issue with existing delivery"] },
    text: "enquiry_textbox___delivery" },
  { value: "Website Issue", hint: "logging in, registering, a password, an error on the website or in the cart", aiChoice: true,
    sub1: { prop: "enquiry_sub_category___website_issue___1", options: ["Login Issue", "Other Issue"] },
    text: "enquiry_textbox___website_issue" },
  { value: "Invoicing & Accounting", hint: "an invoice, a payment, VAT, a credit note", aiChoice: true,
    sub1: { prop: "enquiry_sub_category___invoicing___accounting___1", options: ["Invoice not received", "Other invoicing issue"] },
    sub2: { prop: "enquiry_sub_category___invoicing__amp__accounting___2", options: ["I have not received my invoice", "Invoice amount incorrect/Unpaid invoice"] },
    text: "enquiry_textbox___invoicing___accounting" },
  { value: "Order Cancellation", hint: "cancelling or changing an order", aiChoice: true,
    sub1: { prop: "enquiry_sub_category___order_cancellation___1", options: ["Cancel existing order"] },
    text: "enquiry_textbox___order_cancellation" },
  // Back Office files these by hand: shown, never chosen by the AI (certificates go under Product Information)
  { value: "Certificates (ONLY FOR BO)", hint: "", aiChoice: false },
  // SARCLA 27.10.2026: "NO MORE OTHER ... REAL OPTION ONLY" - never chosen by the AI, never offered to a person
  { value: "Others", hint: "", aiChoice: false },
];
/** The options a chat can be filed under - the real ones only (no "Others"). */
export const FILING_CATEGORIES = CATEGORIES.filter((c) => c.value !== "Others");
/** The customer asked nothing at all (a greeting, a test, only "a person please"). Never a HubSpot value: such a chat
 *  is not written to its ticket, which keeps what it has. */
export const NO_REQUEST = "No request";
export const categoryOf = (v: string | null | undefined) => CATEGORIES.find((c) => c.value === v) ?? null;
/** "Could not be read": a chat HubSpot no longer holds, kept so it is not asked for again */
export const categoryLabel = (v: string | null | undefined) => (v === "unreadable" ? "Could not be read" : v || "Not filed yet");

/** What the HubSpot side did with a filed chat (hs_state). */
export type HsState = "pending" | "would-write" | "written" | "same" | "kept" | "error";

/** One run of the filing job. */
export type TopicsRun = {
  at: string; ok: boolean; filed: number; unreadable: number; failed: number; waiting: number | null; error: string | null;
  /** the HubSpot side of the same run: written, already right, kept (a person set it in HubSpot), would change (preview) */
  hubspot?: { written: number; same: number; kept: number; wouldWrite: number; errors: number; mode: "preview" | "write" } | null;
};
