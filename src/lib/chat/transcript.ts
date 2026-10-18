// CHAT - one chat's whole conversation, from HubSpot (SARCLA 18.10.2026: "improve the conversation layout, also
// the hand-overs"). The orchestrator's memory keeps a chat's last 10 messages for a while; HubSpot keeps all of
// it, the agents' replies too. Each chat ticket is associated with its conversation thread (orchestrator
// hubspot.js createTicket), so: ticket -> threads (v4 associations; the first that still exists is the chat) ->
// its messages and events -> the names of who wrote. Read with the hub's own HubSpot app; nothing is stored.
//
// What a hand-over looks like in a thread (a real one, 16.10.2026): the bot owns it (ASSIGNMENT to B-...), says it
// is passing it on, HubSpot unassigns the bot (ASSIGNMENT to nobody = the hand-over), then assigns an agent
// (ASSIGNMENT to A-...); the agent may or may not write in the chat before the thread is CLOSED.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import type { Transcript, TranscriptItem } from "./shape";

type Sender = { actorId?: string; name?: string };
type RawItem = {
  id: string; type: string; createdAt: string; text?: string; senders?: Sender[];
  assignedTo?: string | null; newStatus?: string;
};
type RawThread = { id: string; status?: string; inboxId?: string; closedAt?: string | null; createdAt?: string; assignedTo?: string | null };

const INBOX: Record<string, string> = { "499976776": "Help Desk", "248802342": "CHAT inbox" };
const PORTAL = "26492587";

/** HubSpot keeps the bot's messages as HTML; the page shows plain text. */
function plain(html: string | undefined): string {
  return (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/[ \t]+\n/g, "\n").trim();
}

const kindOf = (actorId: string | undefined): TranscriptItem["who"] =>
  actorId?.startsWith("V-") ? "customer" : actorId?.startsWith("B-") ? "ai" : actorId?.startsWith("A-") ? "agent" : "system";

async function messages(threadId: string): Promise<RawItem[]> {
  const out: RawItem[] = [];
  let after: string | undefined;
  for (let page = 0; page < 5; page++) {
    const r = await hubspotFetchJson<{ results?: RawItem[]; paging?: { next?: { after?: string } } }>({
      path: `/conversations/v3/conversations/threads/${threadId}/messages?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`,
    });
    out.push(...(r.results ?? []));
    after = r.paging?.next?.after;
    if (!after) break;
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function names(ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const want = [...new Set(ids.filter((id) => /^[ABV]-\d+$/.test(id)))];
  if (!want.length) return m;
  const r = await hubspotFetchJson<{ results?: { id: string; name?: string }[] }>({
    path: "/conversations/v3/conversations/actors/batch/read", method: "POST", body: { inputs: want },
  }).catch(() => ({ results: [] as { id: string; name?: string }[] }));
  for (const a of r.results ?? []) if (a.name) m.set(a.id, a.name);
  return m;
}

/** The chat behind a chat ticket, or null when the ticket has no conversation that still exists. */
export async function chatTranscript(ticketId: string): Promise<Transcript | null> {
  const assoc = await hubspotFetchJson<{ results?: { toObjectId: string | number }[] }>({
    path: `/crm/v4/objects/tickets/${ticketId}/associations/conversations`,
  });
  for (const id of (assoc.results ?? []).map((r) => String(r.toObjectId))) {
    let thread: RawThread;
    try {
      thread = await hubspotFetchJson<RawThread>({ path: `/conversations/v3/conversations/threads/${id}` });
    } catch { continue; }                                 // an archived thread answers 404 - try the next
    const raw = await messages(id);
    const who = await names([...raw.flatMap((x) => (x.senders ?? []).map((s) => s.actorId ?? "")), ...raw.map((x) => x.assignedTo ?? "")]);

    const items: TranscriptItem[] = [];
    let botHad = false, handedAt: string | null = null, agent: Transcript["agent"] = null, agentFirstReplyAt: string | null = null, agentMessages = 0;
    for (const x of raw) {
      if (x.type === "MESSAGE") {
        const s = x.senders?.[0];
        const k = kindOf(s?.actorId);
        const text = plain(x.text);
        if (!text) continue;
        if (k === "agent") { agentMessages++; agentFirstReplyAt ??= x.createdAt; }
        items.push({ at: x.createdAt, who: k, name: (s?.actorId && who.get(s.actorId)) || s?.name || null, text });
      } else if (x.type === "ASSIGNMENT") {
        const to = x.assignedTo ?? "";
        if (to.startsWith("B-")) { botHad = true; continue; }       // the bot takes every chat first: not news
        if (botHad && !handedAt) handedAt = x.createdAt;          // the bot let go: the hand-over
        if (to.startsWith("A-")) {
          const name = who.get(to) ?? null;
          agent ??= { name, at: x.createdAt };
          items.push({ at: x.createdAt, who: "system", name: null, text: `Assigned to ${name ?? "an agent"}` });
        } else if (botHad) {
          items.push({ at: x.createdAt, who: "system", name: null, text: "Handed over - waiting for a person" });
        }
      } else if (x.type === "THREAD_STATUS_CHANGE" && x.newStatus === "CLOSED") {
        items.push({ at: x.createdAt, who: "system", name: null, text: "Closed" });
      }
    }
    return {
      threadId: id, status: thread.status ?? "", inbox: thread.inboxId ? INBOX[thread.inboxId] ?? `inbox ${thread.inboxId}` : null,
      openedAt: raw[0]?.createdAt ?? thread.createdAt ?? null, closedAt: thread.closedAt ?? null,
      handedAt, agent, agentFirstReplyAt, agentMessages, items,
      link: `https://app-eu1.hubspot.com/live-messages/${PORTAL}/inbox/${id}`,
    };
  }
  return null;
}
