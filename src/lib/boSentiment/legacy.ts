// THE WORKFLOW, PORTED 1:1 - what HubSpot flow 4333972706 computes today, defects included.
//
// This module is deliberately NOT an improvement. It exists so the hub can reproduce the
// workflow's exact answer on a real ticket: that is what turns "the new scoring is better"
// into something provable instead of asserted, and it is how the Back-Office classifier port
// was accepted (6,184 tickets, 0 differences). Every quirk below is the workflow's own.
//
// Known defects, kept faithfully here and fixed in detect.ts:
//  1. WEIGHT BY REPETITION. score() scans the text once per list entry, so a term the list
//     repeats scores once per copy. "urgent" is listed SIX times, so a single polite
//     "this is urgent for us" scores 6 against a threshold of 2 - the ticket is negative
//     whatever its tone. complaint/beschwerde/plainte/reclamo/urgente score 3.
//  2. NO WORD BOUNDARIES. Matching is indexOf on a space-padded string, so entries match
//     inside words: the French "demande" (a request) contains "demand", "consent" contains
//     "sent", "against" contains "again", "closed lost" contains "lost".
//  3. THE TICKET'S OWN TEXT IS SCORED ON BOTH SIDES. subject/content/close notes are appended
//     to the customer text AND to the agent text, so the customer's subject counts as our
//     resolution and one "urgent" hits both properties.
//  4. DIRECTION BY ONE VALUE. Only "INCOMING_EMAIL" is the customer; every other direction,
//     FORWARDED_EMAIL included, is treated as our own words.
//  5. RAW COUNTS, NOT NORMALISED. A short transactional ticket cannot reach MIN=2 and is
//     forced to "neutral"; a long thread accumulates hits and tips.
//  6. NEUTRAL MEANS TWO THINGS - "nothing found" and "balanced" share one value.
//
// Pure: no I/O, no HubSpot. The caller supplies the text, which is what makes it testable.

import { RESOL_NEG, RESOL_POS, TONE_NEG, TONE_POS } from "./legacyLists";

export type Bucket = "positive" | "neutral" | "negative";

/** One mail of the thread, as the workflow reads it off the email object. */
export type ThreadMail = { text?: string | null; direction?: string | null };

export type LegacyInput = {
  subject?: string | null;
  content?: string | null;
  closed_lost_reason?: string | null;
  close_note?: string | null;
  /** The mails the workflow would have scored, in the order it would have scored them. */
  mails?: ThreadMail[];
};

export type LegacyResult = {
  tone: Bucket;
  resolution: Bucket;
  tonePos: number;
  toneNeg: number;
  resolPos: number;
  resolNeg: number;
  custChars: number;
  agentChars: number;
};

/** The workflow's normalize(): NFD accent strip, lower case, tags out, then a-z0-9 plus ' and -. */
export function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ").trim();
}

/**
 * The workflow's quoted-block markers.
 *
 * Written as one regex LITERAL, not assembled from strings: the workflow builds it with
 * `'\nfrom:' + ...` inside string concatenation, which is a level of escaping that does not
 * survive being copied between files - get it wrong by one backslash and the pattern becomes a
 * real newline followed by the letter "s", matches nothing, and the quoted history is silently
 * scored again. The pattern below is the workflow's, character for character.
 *
 * This was v4's one real precision win: before it, a complaint ticket scored 57 positive hits
 * because the customer's own signature and the whole forwarded reply chain were being counted.
 */
const QUOTED_MARKERS =
  /(\nfrom:\s+[^\n]*@|\ngesendet:\s|\nenvoy[eé]:\s|\nsent:\s|\non\s.{0,80}\swrote:|\nle\s.{0,40}\sa ecrit|\nil\s.{0,40}\sha scritto|\n-{3,}\s*(?:original\s+message|forwarded|weitergeleitet|original|forward)|\nplease note this email|\nthis e[- ]?mail (?:and any|may contain)|\ndiese e[- ]?mail (?:enthalt|ist vertraulich))/i;

/** Everything from the first quoted/forwarded marker is dropped. Applied to RAW text, before normalize. */
export function stripQuoted(text: string | null | undefined): string {
  if (!text) return "";
  const m = QUOTED_MARKERS.exec(text);
  return m ? text.slice(0, m.index) : text;
}

/**
 * The workflow's score(): every occurrence of every entry, counted.
 *
 * Defects 1 and 2 both live in these six lines, and both are deliberate here.
 */
export function score(text: string, list: readonly string[]): number {
  if (!text) return 0;
  const t = " " + text + " ";
  let n = 0;
  for (const kw of list) {
    if (!kw) continue;
    let idx = 0;
    while ((idx = t.indexOf(kw, idx)) !== -1) {
      n++;
      idx += kw.length;
    }
  }
  return n;
}

/** The workflow's thresholds: fewer than 2 hits on both sides is neutral, then a margin of 2 decides. */
export function bucket(posHits: number, negHits: number): Bucket {
  const MIN = 2;
  const diff = posHits - negHits;
  if (Math.max(posHits, negHits) < MIN) return "neutral";
  if (diff >= 2) return "positive";
  if (diff <= -2) return "negative";
  return "neutral";
}

/** How many mails of the thread the workflow actually scores, and which ones. */
export const LEGACY_MAIL_LIMIT = 20;
export const LEGACY_MAIL_SCORED = 10;

/** The workflow's answer for one ticket. */
export function legacyScore(input: LegacyInput): LegacyResult {
  const ticketText = normalize(
    (input.subject || "") + " " + (input.content || "") + " " +
    (input.closed_lost_reason || "") + " " + (input.close_note || ""),
  );
  const customer: string[] = [];
  const agent: string[] = [];
  for (const m of input.mails ?? []) {
    const txt = normalize(stripQuoted(m.text ?? ""));
    if (!txt) continue;
    if ((m.direction || "") === "INCOMING_EMAIL") customer.push(txt);
    else agent.push(txt);
  }
  // defect 3: the ticket's own text joins BOTH sides
  const custText = (customer.join(" ") + " " + ticketText).trim();
  const agentText = (agent.join(" ") + " " + ticketText).trim();
  const tonePos = score(custText, TONE_POS);
  const toneNeg = score(custText, TONE_NEG);
  const resolPos = score(agentText, RESOL_POS);
  const resolNeg = score(agentText, RESOL_NEG);
  return {
    tone: bucket(tonePos, toneNeg),
    resolution: bucket(resolPos, resolNeg),
    tonePos, toneNeg, resolPos, resolNeg,
    custChars: custText.length, agentChars: agentText.length,
  };
}

/**
 * Which list entries fired, and how much each scored - for the tab's "why did this ticket
 * get that answer" box, and for measuring which single term drives a bucket.
 */
export function hits(text: string, list: readonly string[]): { term: string; count: number }[] {
  const t = " " + text + " ";
  const tally = new Map<string, number>();
  for (const kw of list) {
    if (!kw) continue;
    let idx = 0, n = 0;
    while ((idx = t.indexOf(kw, idx)) !== -1) { n++; idx += kw.length; }
    if (n) tally.set(kw, (tally.get(kw) ?? 0) + n);
  }
  return [...tally.entries()].map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count);
}
