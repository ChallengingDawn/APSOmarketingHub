// ENQUIRY CATEGORY AT THE END OF A TICKET - the AI's closest topic for a customer e-mail it could not place (SARCLA
// 26.10.2026: "I need the Other completely solved" - picked "the AI always picks a topic"). Asked only when 88's
// aiClassify answered "Others" on a ticket the sentiment sweep scored as a real customer (it has a tone): the same model,
// the same masked text (88's aiText), but "Others" is not on the list - the model names the closest topic and how sure
// it is, or "Spam or advertising" when nobody asks anything (a sample of 10 had 6 adverts, spam, a job application and
// an IT notice). "low" is still written; the Detection tab shows it apart (kv ticketClose:guessed), so it can be checked.

import type Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, aiSubs, aiText } from "../boDistribution/aiClassify";
import { CATEGORIES } from "../boDistribution/classifier";
import { TOPIC } from "./topics";

export type Sure = "high" | "medium" | "low";
export type Guess = { category: string; sub: string | null; why: string; sure: Sure };

const TOPICS = () => [...CATEGORIES.filter((c) => c !== "Others"), TOPIC.spam];

export function guessSystem(): string {
  const lines = TOPICS().map((c) => {
    if (c === TOPIC.spam) return `- ${JSON.stringify(c)} - nobody asks APSOparts anything: advertising, spam, prize draws, surveys, newsletters, job applications, IT or security notices`;
    const subs = aiSubs(c);
    return `- ${JSON.stringify(c)}${subs.length ? `; sub: ${subs.map((x) => JSON.stringify(x)).join(", ")}` : ""}`;
  }).join("\n");
  return `You file an e-mail from outside to the Back Office of APSOparts, an industrial web shop (seals, O-rings, hoses, plastics). A first reading found no clear reason; it must still go to the topic it is closest to - there is no "other". If someone asks or tells APSOparts something about buying, an order, a product, a price, an invoice or the shop, pick that topic; if nobody asks anything, it is "Spam or advertising". Pick exactly one category from this list and, if it has them, one sub-category:
${lines}
Say how sure you are: "high" (the e-mail says it), "medium" (most likely), "low" (only the closest guess).
Answer only JSON: {"category":"...","sub":"..." or "","sure":"high"|"medium"|"low","why":"max 12 words"}`;
}

/** The model's answer, checked against the list: no known category = no answer (asked again next time). */
export function guessParse(text: string): Omit<Guess, never> | null {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let j: { category?: unknown; sub?: unknown; sure?: unknown; why?: unknown };
  try { j = JSON.parse(text.slice(a, b + 1)); } catch { return null; }
  const category = typeof j.category === "string" && TOPICS().includes(j.category) ? j.category : null;
  if (!category) return null;
  const sub = typeof j.sub === "string" && aiSubs(category).includes(j.sub) ? j.sub : null;
  const sure: Sure = j.sure === "high" || j.sure === "medium" ? j.sure : "low";
  return { category, sub, sure, why: String(j.why ?? "").slice(0, 120) };
}

let thinkingOff = true; // switched to false if the model refuses the parameter
export async function aiGuess(client: Anthropic, subject: string | null | undefined, content: string | null | undefined): Promise<Guess | null> {
  const ask = async () => client.messages.create({
    model: AI_MODEL, max_tokens: thinkingOff ? 160 : 1200, system: guessSystem(),
    messages: [{ role: "user", content: aiText(subject, content) }],
    ...(thinkingOff ? { thinking: { type: "disabled" } } : {}),
  } as Parameters<typeof client.messages.create>[0]) as Promise<{ content: { type: string; text?: string }[] }>;
  let msg;
  try { msg = await ask(); } catch (e) {
    if (!thinkingOff || !/thinking/i.test(String((e as Error).message))) throw e;
    thinkingOff = false;
    msg = await ask();
  }
  return guessParse(msg.content.filter((x) => x.type === "text").map((x) => x.text ?? "").join(""));
}
