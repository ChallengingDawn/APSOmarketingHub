// THE CHAT'S SUMMARY BY E-MAIL - the A/B test's version 3 (SARCLA 13.11.2026: "on pourrait essayer de ne demander qu'au
// milieu de l'échange, et indiquer que c'est pour leur envoyer le résumé de l'échange par email"; sent "via the hub's
// SMTP"). In variant "mid" the shop chat offers, after the AI's 2nd answer, the conversation's summary by e-mail; the
// gateway (chatab.ts) queues the request with the address. The gateway cannot reach the hub (no public address), so the
// hub pulls: every 5 minutes, the requests whose conversation has been quiet for 20 minutes -
//   1. the whole conversation from HubSpot (the thread the gateway kept; the AI's and the team's replies the gateway
//      kept when HubSpot has none),
//   2. a summary in the visitor's language by Claude - only what the chat says, no address or phone number,
//   3. the mail through the hub's SMTP relay (sendHubMail), from APSOparts, replies to support,
//   4. the result back to the gateway - which wipes the address once sent (or given up after 5 tries).
// One copy of the hub at a time (advisory lock). CHAT_SUMMARY=off stops it; CHAT_SUMMARY_MODEL picks the model.

import type Anthropic from "@anthropic-ai/sdk";
import { getPool } from "@/lib/db/client";
import { kvSet } from "@/lib/db/init";
import { getAnthropic } from "@/lib/ai/claude";
import { gateway, adminKey as directupKey } from "@/lib/directup/gateway";
import { mailConfigured, sendHubMail } from "@/lib/notify/mailer";
import { threadTranscript } from "./transcript";
import { LANGUAGE, langOf, shopLinks, summaryMail, type Lang, type Line, type Written } from "./summaryText";

const LOCK = 4_107_260;
const TICK_MS = 5 * 60_000;
const QUIET_MIN = 20;
const PER_RUN = 20;
const MODEL = process.env.CHAT_SUMMARY_MODEL || "claude-opus-5-5";
export const KV_SUMMARY_RUN = "chat:summary:last-run";

type Due = {
  sid: string; email: string; lang: string | null; country: string | null; v: number | null; variant: string | null;
  requested_at: string; tries: number; thread_id: string | null;
  replies: { kind: string; name: string | null; text: string; at: string }[];
};
export type SummaryRun = { at: string; ok: boolean; sent: number; failed: number; skipped: number; error: string | null };

/** The conversation as the model reads it - the customer, the AI, the team; nothing of the system's own notes. */
async function conversationOf(d: Due): Promise<Line[]> {
  if (d.thread_id) {
    const t = await threadTranscript(d.thread_id).catch(() => null);
    const lines = (t?.items ?? []).filter((x) => x.who !== "system").map((x) => ({ who: x.who as Line["who"], name: x.name, text: x.text }));
    if (lines.length) return lines;
  }
  // no HubSpot thread (the mirror was off): the replies the gateway kept - the customer's questions are not among them
  return d.replies.map((r) => ({ who: r.kind === "t" ? "agent" : "ai", name: r.kind === "t" ? r.name : null, text: r.text }));
}

function systemPrompt(lang: Lang): string {
  return `You write the summary of a customer's chat with APSOparts, the online shop of Angst+Pfister for technical parts
(seals, O-rings, hoses, plastics, drive and vibration parts). The customer asked for it, and it is e-mailed to them.
Write in ${LANGUAGE[lang]}, addressing the customer formally and politely.
- "points": 2 to 6 short sentences: what the customer was looking for or asked, what was found or answered (article
  names and numbers, prices, quantities or delivery times ONLY as the chat states them), and anything agreed.
- "next": one or two sentences on what happens next or what is still open - only when the chat says so (e.g. the team
  will call back, the customer will send a drawing); otherwise "".
Use only facts from the chat; never invent a price, a stock level, a delivery time or a promise. Leave out e-mail
addresses, phone numbers, customer numbers and anything about how the chat works. Plain text, no markdown, no links
(the links are added below the summary).`;
}

/** Claude writes the points; a refusal or an unreadable answer throws (the request is tried again next run). */
export async function writeSummary(client: Anthropic, lang: Lang, lines: Line[]): Promise<Written> {
  const who = { customer: "Customer", ai: "APSOparts assistant (AI)", agent: "APSOparts team" } as const;
  const chat = lines.map((l) => `${who[l.who]}${l.who === "agent" && l.name ? ` (${l.name})` : ""}: ${l.text}`).join("\n\n");
  const params = {
    model: MODEL, max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: {
      type: "object", additionalProperties: false, required: ["points", "next"],
      properties: { points: { type: "array", items: { type: "string" } }, next: { type: "string" } },
    } } },
    system: systemPrompt(lang),
    messages: [{ role: "user", content: `The chat:\n\n${chat}` }],
  };
  const msg = await client.beta.messages.create(params as unknown as Parameters<typeof client.beta.messages.create>[0]) as unknown as {
    stop_reason?: string; content: { type: string; text?: string }[];
  };
  if (msg.stop_reason === "refusal") throw new Error("the model declined to write it");
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  let j: { points?: unknown; next?: unknown };
  try { j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { throw new Error(`no readable answer (stop ${msg.stop_reason ?? "?"})`); }
  const points = Array.isArray(j.points) ? j.points.map((p) => String(p).trim()).filter(Boolean).slice(0, 8) : [];
  if (!points.length) throw new Error("the summary came back empty");
  return { points, next: typeof j.next === "string" ? j.next.trim() : "" };
}

const mask = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");

async function report(sid: string, result: "sent" | "failed" | "skipped", error?: string) {
  await gateway(`/chat/summaries/${encodeURIComponent(sid)}`, { method: "PUT", body: { result, ...(error ? { error } : {}) } });
}

/** One run: the quiet requests, each written, sent and reported back. */
export async function sendDueSummaries(limit = PER_RUN): Promise<SummaryRun> {
  const at = new Date().toISOString();
  const why = !directupKey() ? "DIRECTUP_ADMIN_KEY is not set" : !mailConfigured() ? "no SMTP credentials (DOC_SMTP_USER / DOC_SMTP_PASS)" : !getAnthropic() ? "ANTHROPIC_API_KEY is not set" : null;
  if (why) return { at, ok: false, sent: 0, failed: 0, skipped: 0, error: why };
  const client = getAnthropic()!;
  const { due } = await gateway<{ due: Due[] }>(`/chat/summaries/due?quiet=${QUIET_MIN}&limit=${limit}`);
  const run: SummaryRun = { at, ok: true, sent: 0, failed: 0, skipped: 0, error: null };
  for (const d of due) {
    try {
      const lines = await conversationOf(d);
      if (!lines.some((l) => l.who !== "customer")) {             // nothing was answered: nothing to sum up
        await report(d.sid, "skipped", "nothing to summarise"); run.skipped++; continue;
      }
      const lang = langOf(d.lang);
      const written = await writeSummary(client, lang, lines);
      const mail = summaryMail(lang, written, shopLinks(lines));
      await sendHubMail({ to: d.email, subject: mail.subject, html: mail.html, text: mail.text });
      await report(d.sid, "sent");
      run.sent++;
      console.log(`[chat-summary] sent to ${mask(d.email)} (${lang}, ${d.country ?? "?"}, ${lines.length} messages${d.thread_id ? "" : ", no HubSpot thread"})`);
    } catch (e) {
      run.failed++;
      const msg = String((e as Error)?.message ?? e).slice(0, 280);
      console.warn(`[chat-summary] ${d.sid.slice(0, 8)} not sent (try ${d.tries + 1}): ${msg}`);
      await report(d.sid, "failed", msg).catch(() => {});
    }
  }
  return run;
}

/* ── the job: every 5 minutes, one of the hub's copies (an advisory lock) ── */
let started = false;
async function tick(): Promise<void> {
  let client;
  try { client = await getPool().connect(); } catch (e) { console.warn(`[chat-summary] tick skipped: ${(e as Error).message}`); return; }
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return;
    try {
      const r = await sendDueSummaries().catch((e): SummaryRun => ({ at: new Date().toISOString(), ok: false, sent: 0, failed: 0, skipped: 0, error: String((e as Error)?.message ?? e) }));
      if (r.sent || r.failed || r.skipped || r.error) await kvSet(KV_SUMMARY_RUN, r).catch(() => {});
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

export function startChatSummaries(): void {
  if (started || String(process.env.CHAT_SUMMARY ?? "").toLowerCase() === "off") return;
  started = true;
  console.log(`[chat-summary] on: the A/B test's chat summaries by e-mail, every 5 min once a chat is quiet ${QUIET_MIN} min (${MODEL})`);
  setInterval(() => void tick(), TICK_MS).unref?.();
  setTimeout(() => void tick(), 3 * 60_000).unref?.();
}
