// BACK OFFICE DISTRIBUTION - AI for what the keywords leave as "Others" (SARCLA 19.10.2026: "do it but spend as less as
// possible"). Only e-mails NEITHER keyword classifier recognises are asked; the smallest Claude model, thinking off, the
// e-mail cut to its first 1,200 characters without the quoted history, e-mail addresses and phone numbers masked, one
// short JSON answer - about a thousand tokens an e-mail, at most AI_PER_DAY a day. Shadow: shown beside the classifiers
// on the Detection tab and measured against people's corrections - never routed on. BO_AI=off stops it.

import type Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, DROPDOWN_VALUES } from "./classifier";

export const AI_MODEL = process.env.BO_AI_MODEL || "claude-haiku-5-5";
export const AI_PER_RUN = 6;
export const AI_PER_DAY = 60;
const MAX_CHARS = 1200;

export type AiAnswer = { category: string | null; sub: string | null; why: string; model: string; tokens: number; at: string };

/** The sub-categories a category can have, as HubSpot's dropdown writes them. */
export const aiSubs = (category: string): string[] => [...new Set(Object.values(DROPDOWN_VALUES[category] ?? {}))];

/** What goes to the model: the subject and the first lines of the e-mail - no HTML, no quoted history, no addresses or phone numbers. */
export function aiText(subject: string | null | undefined, content: string | null | undefined): string {
  let body = String(content ?? "")
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
  // the history below the reply: the first quote marker ends the new text
  const cut = body.search(/^\s*(>|-{3,}\s*(original|ursprüngliche|message d'origine|messaggio originale)|(from|von|de|da|van)\s*:.*@|(gesendet|sent|envoyé|inviato)\s*:)/im);
  if (cut > 40) body = body.slice(0, cut);
  const clean = (s: string) => s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
    .replace(/(?:\+|\b00)\d{2}[\d\s/().-]{7,}\d/g, "[phone]")
    .replace(/\b0\d{2}[ /]\d{3} ?\d{2} ?\d{2}\b/g, "[phone]")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return `Subject: ${clean(String(subject ?? "")).slice(0, 200)}\n\n${clean(body).slice(0, MAX_CHARS)}`;
}

export function aiSystem(): string {
  const lines = CATEGORIES.map((c) => {
    const subs = aiSubs(c);
    return `- ${JSON.stringify(c)}${subs.length ? `; sub: ${subs.map((x) => JSON.stringify(x)).join(", ")}` : ""}`;
  }).join("\n");
  return `You file e-mails that reach the Back Office of APSOparts, an industrial web shop (seals, O-rings, hoses, plastics), as its HubSpot tickets are filed. Pick the customer's main reason - one category and, if it has them, one sub-category, written exactly as below. Supplier mails, newsletters, spam, internal mails and anything that fits none: "Others".
${lines}
- "Others"
Answer only JSON: {"category":"...","sub":"..." or "","why":"max 12 words"}`;
}

/** The model's answer, checked against the lists: an unknown category is Others, an unknown sub-category is none. */
export function aiParse(text: string): { category: string | null; sub: string | null; why: string } | null {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let j: { category?: unknown; sub?: unknown; why?: unknown };
  try { j = JSON.parse(text.slice(a, b + 1)); } catch { return null; }
  const cat = typeof j.category === "string" && CATEGORIES.includes(j.category) ? j.category : null;
  const sub = cat && typeof j.sub === "string" && aiSubs(cat).includes(j.sub) ? j.sub : null;
  return { category: cat, sub, why: String(j.why ?? "").slice(0, 120) };
}

let thinkingOff = true; // switched to false if the model refuses the parameter
/** One e-mail, one call. Throws when no usable answer came back (the next run asks again). */
export async function aiClassify(client: Anthropic, subject: string | null | undefined, content: string | null | undefined): Promise<AiAnswer> {
  const ask = async () => client.messages.create({
    model: AI_MODEL, max_tokens: thinkingOff ? 120 : 1200, system: aiSystem(),
    messages: [{ role: "user", content: aiText(subject, content) }],
    ...(thinkingOff ? { thinking: { type: "disabled" } } : {}),
  } as Parameters<typeof client.messages.create>[0]) as Promise<{ content: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }>;
  let msg;
  try { msg = await ask(); } catch (e) {
    if (!thinkingOff || !/thinking/i.test(String((e as Error).message))) throw e;
    thinkingOff = false;
    msg = await ask();
  }
  const text = msg.content.filter((x) => x.type === "text").map((x) => x.text ?? "").join("");
  const r = aiParse(text);
  if (!r) throw new Error(`no answer from the model: "${text.slice(0, 60)}"`);
  return { ...r, model: AI_MODEL, tokens: (msg.usage?.input_tokens ?? 0) + (msg.usage?.output_tokens ?? 0), at: new Date().toISOString() };
}
