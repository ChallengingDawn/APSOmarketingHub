// ENQUIRY CATEGORY AT THE END OF A TICKET - the rules, with no HubSpot in them (SARCLA 25.10.2026: "is CLASSIFIER END OF
// TICKET - ENQUIRY CATEGORY still needed with the detection tab? in 265 days we should retrieve and improve a lot
// detection"). The workflow (4088710379) keyword-scored the conversation of a Back Office ticket entering Resolved when
// its category was empty or "Others". Measured 25.10 on the 2,459 tickets of 265 days left "Others"/empty: keywords are
// wrong on what is left (the AI agreed on 14 of 60 - Microsoft 365 quarantine notices, Task Status Reports and
// newsletters filed as Delivery or Product Price; 540 of 604 keyword "Delivery" had only our own words). So: a ticket
// the sentiment sweep marks as no customer request gets the hidden topic of what it is (topics.ts: Internal, Automatic
// or Empty e-mail - SARCLA 26.10.2026, "we should be able to recognise 100%"); every other one is read by the AI (88's
// aiClassify, unchanged) on the whole conversation. A category is only ever written onto "Others" or empty.

import { PROPERTY_MAPPING, extractOrderNumbers } from "../boDistribution/classifier";
import { FLAG_TOPIC, TOPIC } from "./topics";

export const WORKFLOW_ID = "4088710379";
export const BO = "1726786777";
export const RESOLVED = "2338266328";

/** Why a ticket stays Others, in words. */
export const STAY_TEXT: Record<string, string> = {
  unclear: "No clear customer reason",
  ai_failed: "The AI gave no answer - tried again later",
};
/** The hidden topic a sentiment flag means, or null when the AI reads the ticket. */
export const flagTopic = (notValid: string | null | undefined): string | null => (notValid ? FLAG_TOPIC[notValid] ?? null : null);
/** A category nobody has decided yet: the only kind this ever writes over. */
export const isOpen = (cat: string | null | undefined) => !cat || cat === "Others";

export type Decision = {
  category: string | null; sub: string | null; order: string | null;
  /** why: the AI's few words, the sentiment flag, or STAY_TEXT's key when it stays Others */
  why: string; stay: string | null; by: "ai" | "flag" | "empty";
};

const strip = (h: string | null | undefined) => String(h ?? "")
  .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|tr|li)>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
/** One message without the history quoted below it. */
export function ownText(html: string | null | undefined, max = 2000): string {
  const s = strip(html);
  const cut = s.search(/^\s*(>|-{3,}\s*(original|ursprüngliche|message d'origine|messaggio originale)|(from|von|de|da|van)\s*:.*@|(gesendet|sent|envoyé|inviato)\s*:)/im);
  return (cut > 40 ? s.slice(0, cut) : s).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

export type Mail = { text?: string | null; html?: string | null; direction?: string | null; at?: string | null };
/** The whole conversation as the AI reads it: the customer's e-mails first (else all of them), the chat, the notes. */
export function conversation(t: { content?: string | null; mails: Mail[]; chat?: string[]; notes?: (string | null)[] }): string {
  const mails = [...t.mails].sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
  const incoming = mails.filter((m) => /INCOMING/.test(m.direction ?? ""));
  const parts = (incoming.length ? incoming : mails).slice(0, 5).map((m) => ownText(m.text || m.html));
  if (!parts.join("").trim() && t.content) parts.push(ownText(t.content));
  if (t.chat?.length) parts.push(t.chat.join("\n").slice(0, 2000));
  for (const n of (t.notes ?? []).slice(0, 3)) if (n) parts.push(strip(n).trim().slice(0, 500));
  return parts.filter(Boolean).join("\n\n");
}

/** Before the AI: no customer request (the sentiment flag) or nothing to read gets its hidden topic. null = ask the AI. */
export function before(t: { subject?: string | null; text: string; notValid?: string | null }): Decision | null {
  const topic = flagTopic(t.notValid);
  if (topic) return { category: topic, sub: null, order: null, why: t.notValid!, stay: null, by: "flag" };
  if (!(t.subject ?? "").trim() && !t.text.trim()) return { category: TOPIC.empty, sub: null, order: null, why: "nothing to read", stay: null, by: "empty" };
  return null;
}
/** The AI's answer as a decision; the order number read from the text. */
export function fromAi(ans: { category: string | null; sub: string | null; why: string } | null, text: string, subject?: string | null): Decision {
  if (!ans) return { category: null, sub: null, order: null, why: "ai_failed", stay: "ai_failed", by: "ai" };
  if (!ans.category || ans.category === "Others") return { category: null, sub: null, order: null, why: ans.why || "unclear", stay: "unclear", by: "ai" };
  const order = extractOrderNumbers(`${subject ?? ""} ${text}`)[0] ?? null;
  return { category: ans.category, sub: ans.sub, order, why: ans.why, stay: null, by: "ai" };
}

/** What is written on the ticket: the category, its own sub-category property, the order number when it has none. */
export function patchFor(d: Decision, current: { order_number?: string | null }): Record<string, string> {
  if (!d.category) return {};
  const p: Record<string, string> = { [PROPERTY_MAPPING.main_category]: d.category };
  const subProp = PROPERTY_MAPPING.sub_categories[d.category];
  if (subProp && d.sub) p[subProp] = d.sub;
  if (d.order && !(current.order_number ?? "").trim()) p[PROPERTY_MAPPING.order_number] = d.order;
  return p;
}
