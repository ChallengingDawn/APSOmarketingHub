// THE MODEL, ASKED ONLY WHERE THE WORDS RUN OUT (SARCLA 24.10.2026, hybrid).
//
// The keyword layer can answer about a fifth of real Back-Office tickets with any confidence -
// measured, not assumed: on 106 real tickets it was sure about 20 and had no evidence at all on
// 73. The old workflow called those 73 "neutral", which reads like an answer and is not one.
// So the model is asked about them, and only them: a clear "Reklamation, inakzeptabel" never
// costs a call, and neither does a machine ticket, because the gate drops it before this point.
//
// Built like the Back-Office classifier's AI (aiClassify.ts), for the same reason SARCLA gave
// then - "spend as less as possible": the smallest model, thinking off, the mail cut to its first
// 1,200 characters without the quoted history, addresses and phone numbers masked, one short JSON
// answer. About a thousand tokens a ticket and roughly 43 tickets a day at current volume.
//
// The model is also asked whether a human customer is really talking. That is a second opinion on
// the gate rather than a replacement for it: the gate decides, this is what the report compares it
// against, so the exclusion rules can be checked against something other than their own author.

import type Anthropic from "@anthropic-ai/sdk";
import { mailText, type Mail } from "./detect";

export const AI_MODEL = process.env.BO_SENTIMENT_MODEL || "claude-haiku-5-5";
/** Per sweep, and per day. A backlog must not turn into a bill. */
export const AI_PER_RUN = 8;
export const AI_PER_DAY = 120;
const MAX_CHARS = 1200;

export type AiTone = "positive" | "neutral" | "negative";
export type AiResolution = "positive" | "neutral" | "negative" | "unknown";

export type AiAnswer = {
  tone: AiTone;
  resolution: AiResolution;
  /** The model's own view on whether a human customer is talking here. */
  machine: boolean;
  why: string;
  model: string;
  tokens: number;
  at: string;
};

/** Addresses and phone numbers never leave the hub. */
function clean(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
    .replace(/(?:\+|\b00)\d{2}[\d\s/().-]{7,}\d/g, "[phone]")
    .replace(/\b0\d{2}[ /]\d{3} ?\d{2} ?\d{2}\b/g, "[phone]")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * What the model is shown: who wrote what, newest last, cut short.
 *
 * The sides are labelled rather than merged, because the two questions are about different
 * authors - how the CUSTOMER sounds, and whether WE resolved it. Handing over an unlabelled
 * blob is how the old scoring came to read our own apology as a failed resolution.
 */
export function aiText(subject: string | null | undefined, mails: Mail[]): string {
  const lines: string[] = [`Subject: ${clean(String(subject ?? "")).slice(0, 200)}`];
  for (const m of mails) {
    const body = clean(mailText(m)).slice(0, 600);
    if (!body) continue;
    const who = (m.direction || "") === "INCOMING_EMAIL" ? "CUSTOMER" : "US";
    lines.push(`\n[${who}]\n${body}`);
  }
  return lines.join("\n").slice(0, MAX_CHARS + 400);
}

export function aiSystem(): string {
  return `You read e-mail threads on tickets at the Back Office of APSOparts, an industrial supplier of seals, O-rings, hoses and plastics. Answer two separate questions about one thread.

"tone" - how the CUSTOMER sounds, and nothing else:
- "negative" only if they are dissatisfied, complaining, angry or let down.
- "positive" if they are pleased, thankful beyond politeness, or satisfied.
- "neutral" for ordinary business: an order, a question, a date, a document request.
A deadline is NOT dissatisfaction. "This is urgent", "we need it today", "asap" is a neutral request unless they also complain. Routine courtesy ("thanks", "best regards") is neutral, not positive. A reminder or a chase is only mildly negative; judge by whether they sound unhappy.

"resolution" - whether WE resolved the customer's matter, judged only from what WE wrote:
- "positive" if we solved it, shipped, credited, corrected, confirmed or answered fully.
- "negative" if we refused, could not help, had no stock, or left it open.
- "neutral" if we replied without settling it.
- "unknown" if we wrote nothing, or nothing that says either way.
An apology is not a failure: "sorry for the delay, the credit note is issued" is positive.

"machine" - true if no human customer is talking in this thread: an automatic notification, a system warning, a newsletter, an order confirmation nobody answered, a bounce, an out-of-office, or only our own colleagues writing. Otherwise false.

Answer only JSON: {"tone":"...","resolution":"...","machine":true|false,"why":"max 12 words"}`;
}

const TONES: AiTone[] = ["positive", "neutral", "negative"];
const RESOLUTIONS: AiResolution[] = ["positive", "neutral", "negative", "unknown"];

/** The answer, checked against the allowed values. Anything unexpected is no answer at all. */
export function aiParse(text: string): Omit<AiAnswer, "model" | "tokens" | "at"> | null {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let j: { tone?: unknown; resolution?: unknown; machine?: unknown; why?: unknown };
  try { j = JSON.parse(text.slice(a, b + 1)); } catch { return null; }
  const tone = typeof j.tone === "string" && (TONES as string[]).includes(j.tone) ? (j.tone as AiTone) : null;
  const resolution = typeof j.resolution === "string" && (RESOLUTIONS as string[]).includes(j.resolution)
    ? (j.resolution as AiResolution) : null;
  if (!tone || !resolution) return null;
  return {
    tone, resolution,
    machine: j.machine === true,
    why: String(j.why ?? "").slice(0, 120),
  };
}

let thinkingOff = true; // switched off once if the model refuses the parameter
/** One ticket, one call. Throws when nothing usable came back, so the next sweep can try again. */
export async function aiSentiment(
  client: Anthropic,
  subject: string | null | undefined,
  mails: Mail[],
): Promise<AiAnswer> {
  const ask = async () => client.messages.create({
    model: AI_MODEL,
    max_tokens: thinkingOff ? 150 : 1200,
    system: aiSystem(),
    messages: [{ role: "user", content: aiText(subject, mails) }],
    ...(thinkingOff ? { thinking: { type: "disabled" } } : {}),
  } as Parameters<typeof client.messages.create>[0]) as Promise<{
    content: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  }>;
  let msg;
  try {
    msg = await ask();
  } catch (e) {
    if (!thinkingOff || !/thinking/i.test(String((e as Error).message))) throw e;
    thinkingOff = false;
    msg = await ask();
  }
  const text = msg.content.filter((x) => x.type === "text").map((x) => x.text ?? "").join("");
  const r = aiParse(text);
  if (!r) throw new Error(`no answer from the model: "${text.slice(0, 60)}"`);
  return {
    ...r,
    model: AI_MODEL,
    tokens: (msg.usage?.input_tokens ?? 0) + (msg.usage?.output_tokens ?? 0),
    at: new Date().toISOString(),
  };
}
