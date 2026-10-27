// ENQUIRY CATEGORY AT THE END OF A TICKET - the AI's closest topic for an e-mail nobody could place (SARCLA 26.10.2026: "I
// need the Other completely solved" - picked "the AI always picks a topic"; 27.10.2026: "Recognise should be 100%", and
// for Internal e-mail "what they are about"). The same model and the same masked text as 88's aiClassify (aiText), but
// "Others" is not on the list - the model names the closest topic and how sure it is.
// - from outside: a real topic, or "Spam or advertising" when nobody asks anything (a sample of 10 had 6 adverts, spam,
//   a job application and an IT notice);
// - from a colleague or a shared mailbox (Internal e-mail): a request they pass on gets its real topic ("Expedite
//   Request" -> Delivery), Finance's system mail Finance e-mail, other system reports Automatic e-mail, and only what is
//   internal admin with no customer matter stays Internal e-mail.
// "low" is still written; the Detection tab shows it apart (kv ticketClose:guessed), so it can be checked.

import type Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, aiSubs, aiText } from "../boDistribution/aiClassify";
import { CATEGORIES } from "../boDistribution/classifier";
import { TOPIC } from "./topics";

export type Sure = "high" | "medium" | "low";
export type Guess = { category: string; sub: string | null; why: string; sure: Sure };
/** who wrote it: someone outside, or one of us (a colleague or a shared mailbox) */
export type From = "outside" | "internal";

const BUSINESS = () => CATEGORIES.filter((c) => c !== "Others");
const EXTRA: Record<From, { topic: string; when: string }[]> = {
  outside: [
    { topic: TOPIC.spam, when: "nobody asks APSOparts anything: advertising, spam, prize draws, surveys, newsletters, job applications, IT or security notices" },
  ],
  internal: [
    { topic: TOPIC.finance, when: "a message from Finance's systems: a customer blocked or released, payment reminders (Mahnung), \"bez VK\"" },
    { topic: TOPIC.automatic, when: "any other system message or status report (Task Status Report, ERP or warehouse notices)" },
    { topic: TOPIC.spam, when: "advertising or spam that reached a colleague" },
    { topic: TOPIC.internal, when: "internal admin with no customer matter: supplier registrations, codes of conduct, office, people" },
  ],
};
const allowed = (from: From) => [...BUSINESS(), ...EXTRA[from].map((x) => x.topic)];

export function guessSystem(from: From = "outside"): string {
  const lines = [
    ...BUSINESS().map((c) => {
      const subs = aiSubs(c);
      return `- ${JSON.stringify(c)}${subs.length ? `; sub: ${subs.map((x) => JSON.stringify(x)).join(", ")}` : ""}`;
    }),
    ...EXTRA[from].map((x) => `- ${JSON.stringify(x.topic)} - ${x.when}`),
  ].join("\n");
  const who = from === "outside"
    ? `an e-mail from outside to the Back Office of APSOparts, an industrial web shop (seals, O-rings, hoses, plastics). A first reading found no clear reason; it must still go to the topic it is closest to - there is no "other". If someone asks or tells APSOparts something about buying, an order, a product, a price, an invoice or the shop, pick that topic; if nobody asks anything, it is "Spam or advertising".`
    : `an e-mail a colleague or a shared mailbox of APSOparts / Angst+Pfister sent to the Back Office of APSOparts, an industrial web shop (seals, O-rings, hoses, plastics). If it passes on or asks about a customer's matter - an order, a delivery, a price, a product, an invoice, the shop, a call back - pick that topic; otherwise say what kind of internal message it is. There is no "other".`;
  return `You file ${who} Pick exactly one category from this list and, if it has them, one sub-category:
${lines}
Say how sure you are: "high" (the e-mail says it), "medium" (most likely), "low" (only the closest guess).
Answer only JSON: {"category":"...","sub":"..." or "","sure":"high"|"medium"|"low","why":"max 12 words"}`;
}

/** The model's answer, checked against the list: no known category = no answer (asked again next time). */
export function guessParse(text: string, from: From = "outside"): Guess | null {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let j: { category?: unknown; sub?: unknown; sure?: unknown; why?: unknown };
  try { j = JSON.parse(text.slice(a, b + 1)); } catch { return null; }
  const category = typeof j.category === "string" && allowed(from).includes(j.category) ? j.category : null;
  if (!category) return null;
  const sub = typeof j.sub === "string" && aiSubs(category).includes(j.sub) ? j.sub : null;
  const sure: Sure = j.sure === "high" || j.sure === "medium" ? j.sure : "low";
  return { category, sub, sure, why: String(j.why ?? "").slice(0, 120) };
}

let thinkingOff = true; // switched to false if the model refuses the parameter
export async function aiGuess(client: Anthropic, subject: string | null | undefined, content: string | null | undefined, from: From = "outside"): Promise<Guess | null> {
  const ask = async () => client.messages.create({
    model: AI_MODEL, max_tokens: thinkingOff ? 160 : 1200, system: guessSystem(from),
    messages: [{ role: "user", content: aiText(subject, content) }],
    ...(thinkingOff ? { thinking: { type: "disabled" } } : {}),
  } as Parameters<typeof client.messages.create>[0]) as Promise<{ content: { type: string; text?: string }[] }>;
  let msg;
  try { msg = await ask(); } catch (e) {
    if (!thinkingOff || !/thinking/i.test(String((e as Error).message))) throw e;
    thinkingOff = false;
    msg = await ask();
  }
  return guessParse(msg.content.filter((x) => x.type === "text").map((x) => x.text ?? "").join(""), from);
}
