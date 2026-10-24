// THE NEW SCORING - same words, read properly.
//
// Every change here answers a defect that legacy.ts pins as a test, so the two can be run side
// by side on the same ticket and the difference argued about:
//
//   word boundaries      "demande" no longer contains the negative "demand", "consent" no longer
//                        contains "sent", "against" no longer contains "again"
//   one language         French text is read with the French words, not with all four at once
//   sides kept apart     the customer's words score tone, ours score resolution, and the ticket's
//                        own subject counts as the customer's - never as ours
//   the latest mails     chosen by timestamp, not by whatever order the association list came in
//   weights declared     once per term, and one occurrence counts at most twice, so a single
//                        repeated word cannot run away with the ticket
//   urgency split out    a deadline is reported as a deadline, not as an unhappy customer
//   "unknown" exists     no evidence is said out loud instead of being dressed up as "neutral"
//   negation             "not perfect" stops counting as praise
//
// Pure, like legacy.ts: the caller brings the text. The AI layer (ai.ts) is asked only where the
// confidence this returns is low, which is what keeps the hybrid cheap.

import { type Dimension, type Lang, VOCABULARY } from "./terms";

export type Bucket = "positive" | "neutral" | "negative" | "unknown";

export type Mail = {
  text?: string | null;
  /** Used when `text` is empty, which is one mail in five. See mailText(). */
  html?: string | null;
  direction?: string | null;
  from?: string | null;
  /** Epoch ms. Missing timestamps sort last, so a dated mail always wins a slot. */
  at?: number | null;
};

export type Hit = { term: string; dim: Dimension; occurrences: number; points: number };

export type Side = {
  /** What the dimensions scored, after weighting and capping. */
  points: Record<Dimension, number>;
  hits: Hit[];
  chars: number;
};

export type Detection = {
  lang: Lang;
  langConfident: boolean;
  tone: Bucket;
  toneConfidence: number;
  resolution: Bucket;
  resolutionConfidence: number;
  /** How loudly the customer asked for speed. Reported, never folded into tone. */
  urgency: number;
  customer: Side;
  agent: Side;
};

/* ───────────────────────── text ───────────────────────── */

/** Folded the same way as the workflow, so the vocabulary matches either scorer. */
export function fold(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ").trim();
}

const QUOTED =
  /(\nfrom:\s+[^\n]*@|\ngesendet:\s|\nenvoy[eé]:\s|\nsent:\s|\non\s.{0,80}\swrote:|\nle\s.{0,40}\sa ecrit|\nil\s.{0,40}\sha scritto|\n-{3,}\s*(?:original\s+message|forwarded|weitergeleitet|original|forward)|\nplease note this email|\nthis e[- ]?mail (?:and any|may contain)|\ndiese e[- ]?mail (?:enthalt|ist vertraulich))/i;

export function stripQuoted(text: string | null | undefined): string {
  if (!text) return "";
  const m = QUOTED.exec(text);
  return m ? text.slice(0, m.index) : text;
}

/**
 * Banners and padding that the mail system injected, not the writer.
 *
 * Found by reading real threads: most customer mails now open with Microsoft's
 * "You don't often get email from someone@x. Learn why this is important<https://aka.ms/...>",
 * and newsletters pad themselves with zero-width spaces and soft hyphens ("&#8202;", "­")
 * to defeat preview text. All of it lands in the body, so it is scored as if the customer had
 * typed it and it is sent to the model as part of their words. None of it is theirs.
 */
const BANNERS: RegExp[] = [
  /you don'?t often get email from[^\n]*/gi,
  /learn why this is important[^\n]*/gi,
  /caution:?\s*this (?:e-?mail|message) (?:originated|came)[^\n]*/gi,
  /this (?:e-?mail|message) (?:was sent from|comes from|originated) outside[^\n]*/gi,
  /diese e-?mail (?:stammt|kommt) von (?:einem|einer) externen[^\n]*/gi,
  /ce (?:courriel|message) provient de l'?ext[eé]rieur[^\n]*/gi,
];

export function stripBanners(text: string): string {
  let out = text.replace(/[­​‌‍﻿]/g, "");
  for (const re of BANNERS) out = out.replace(re, " ");
  return out.replace(/[ \t]{2,}/g, " ");
}

/**
 * A mail's words, from whichever field actually holds them.
 *
 * One in five mails on a Back-Office ticket arrives with `hs_email_text` EMPTY and only
 * `hs_email_html` filled (25 of 128 in a live sample). The workflow reads the text field alone,
 * so for those mails it scores nothing at all and the ticket falls to "neutral" for want of
 * input - a large part of the 64% neutral in the live data is simply mail the scorer never read.
 * Tags become spaces rather than vanishing, so "</p><p>Thanks" cannot weld into one word.
 */
export function mailText(m: { text?: string | null; html?: string | null }): string {
  const plain = String(m.text ?? "").trim();
  if (plain) return stripBanners(plain);
  const html = String(m.html ?? "");
  if (!html.trim()) return "";
  return stripBanners(html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim());
}

/* ───────────────────────── language ───────────────────────── */

const STOPWORDS: Record<Lang, string[]> = {
  en: ["the", "and", "you", "we", "please", "with", "for", "is", "are", "have", "would", "could", "our", "your", "this", "that"],
  de: ["und", "der", "die", "das", "ich", "wir", "bitte", "nicht", "ist", "fur", "mit", "haben", "sie", "wurde", "eine", "auch"],
  fr: ["les", "des", "vous", "nous", "pour", "avec", "est", "pas", "bonjour", "merci", "une", "dans", "votre", "notre", "cette", "bien"],
  it: ["per", "non", "che", "della", "sono", "grazie", "buongiorno", "con", "una", "nostro", "vostro", "questo", "siamo", "anche", "come", "alla"],
};

/**
 * Which language this is, by counting function words.
 *
 * Content words are no use here - an industrial mail is full of part numbers and shared
 * loanwords. Function words are what differ. When the answer is not clear the caller is told so
 * and every language's vocabulary is used, which is what the workflow always did.
 */
export function detectLang(folded: string): { lang: Lang; confident: boolean } {
  const words = new Set(folded.split(" "));
  const score = (l: Lang) => STOPWORDS[l].reduce((n, w) => n + (words.has(w) ? 1 : 0), 0);
  const all: [Lang, number][] = (["en", "de", "fr", "it"] as Lang[]).map((l) => [l, score(l)]);
  all.sort((a, b) => b[1] - a[1]);
  const [best, second] = all;
  const confident = best[1] >= 3 && best[1] >= second[1] * 1.5;
  return { lang: best[1] > 0 ? best[0] : "en", confident };
}

/* ───────────────────────── matching ───────────────────────── */

const NEGATORS = ["not", "no", "never", "nicht", "kein", "keine", "pas", "ne", "non", "nessun", "senza", "ohne", "sans"];

/**
 * One matcher per term, built once.
 *
 * A boundary is only required where the term's own edge is a word character, so "tip top" and
 * "c'est bon pour moi" still match while "sent" no longer fires inside "consent".
 */
const cache = new Map<string, RegExp>();
function matcher(term: string): RegExp {
  let re = cache.get(term);
  if (!re) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, (c) => "\\" + c);
    const left = /^[a-z0-9]/.test(term) ? "\\b" : "";
    const right = /[a-z0-9]$/.test(term) ? "\\b" : "";
    re = new RegExp(left + esc + right, "g");
    cache.set(term, re);
  }
  re.lastIndex = 0;
  return re;
}

/** Is this match the object of a negation a few words earlier? */
function negated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 22), index).trim().split(" ");
  return before.slice(-3).some((w) => NEGATORS.includes(w));
}

/** At most twice: a word shouted five times is still one opinion. */
const MAX_OCCURRENCES = 2;

function scoreSide(folded: string, lang: Lang, useAll: boolean): Side {
  const points: Record<Dimension, number> = {
    tone_pos: 0, tone_neg: 0, chasing: 0, urgency: 0, resol_pos: 0, resol_neg: 0,
  };
  const hits: Hit[] = [];
  if (!folded) return { points, hits, chars: 0 };
  for (const t of VOCABULARY) {
    if (!useAll && t.lang !== lang) continue;
    const re = matcher(t.term);
    let m: RegExpExecArray | null, n = 0;
    while ((m = re.exec(folded)) !== null) {
      // praise inside a negation is not praise; a complaint inside one is still a complaint
      if (t.dim === "tone_pos" && negated(folded, m.index)) continue;
      n++;
      if (n >= MAX_OCCURRENCES) break;
    }
    if (!n) continue;
    const counted = Math.min(n, MAX_OCCURRENCES);
    const pts = t.weight * counted;
    points[t.dim] += pts;
    hits.push({ term: t.term, dim: t.dim, occurrences: counted, points: pts });
  }
  hits.sort((a, b) => b.points - a.points);
  return { points, hits, chars: folded.length };
}

/* ───────────────────────── the verdict ───────────────────────── */

/**
 * A margin of two decides, as in the workflow - but on weighted points, and with no evidence
 * called "unknown" rather than "neutral". Keeping the same margin means the comparison between
 * old and new is about the words, not about a moved goalpost.
 */
export function decide(pos: number, neg: number): { bucket: Bucket; confidence: number } {
  const total = pos + neg;
  if (total === 0) return { bucket: "unknown", confidence: 0 };
  const margin = pos - neg;
  const strength = Math.min(1, Math.abs(margin) / 4);
  if (margin >= 2) return { bucket: "positive", confidence: strength };
  if (margin <= -2) return { bucket: "negative", confidence: strength };
  // a balanced ticket with plenty of evidence is more certainly neutral than a quiet one
  return { bucket: "neutral", confidence: Math.min(1, total / 6) };
}

/** Our own senders, so a mail from us is never counted as the customer's voice. */
const OUR_DOMAINS = ["apsoparts.com", "angst-pfister.com", "apsoparts.de", "anyseals.com"];
const NO_REPLY = /\b(?:no[-.]?reply|donotreply|noreply|mailer-daemon|postmaster)\b/;

export function isCustomerMail(m: Mail): boolean {
  if ((m.direction || "") !== "INCOMING_EMAIL") return false;
  const from = (m.from || "").toLowerCase();
  if (from && NO_REPLY.test(from)) return false;
  if (from && OUR_DOMAINS.some((d) => from.includes("@" + d))) return false;
  return true;
}

/**
 * A forwarded mail belongs to nobody.
 *
 * The workflow treated every direction other than INCOMING_EMAIL as our own words, so a
 * forwarded customer mail was read with OUR vocabulary: most of the customer's tone simply
 * vanished (their angry words are not in the resolution lists at all), and the part that
 * overlaps - "wrong delivery", "delayed", "cannot" - counted against our own resolution.
 * The direction alone cannot say whose words a forward carries: it may be a colleague passing
 * on a customer, or us forwarding a supplier. So it is counted on neither side. Dropping
 * evidence we cannot attribute is honest; attributing it to the wrong side is not.
 */
export function isUnattributable(m: Mail): boolean {
  return (m.direction || "").toUpperCase() === "FORWARDED_EMAIL";
}

/** The newest `n` mails, by timestamp, returned oldest-first. */
export function latest(mails: Mail[], n: number): Mail[] {
  return [...mails]
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
    .slice(0, n)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}

export type DetectInput = {
  subject?: string | null;
  content?: string | null;
  close_note?: string | null;
  mails?: Mail[];
  /** How many of the newest mails to read. The workflow read ten. */
  readMails?: number;
};

export function detect(input: DetectInput): Detection {
  const mails = latest(input.mails ?? [], input.readMails ?? 10);
  const custParts: string[] = [];
  const agentParts: string[] = [];
  for (const m of mails) {
    const txt = fold(stripQuoted(mailText(m)));
    if (!txt) continue;
    if (isUnattributable(m)) continue;
    (isCustomerMail(m) ? custParts : agentParts).push(txt);
  }
  // The ticket itself is the customer's opening mail in Back Office, so its subject and body are
  // the customer's words. Our close note is ours.
  const ticketCustomer = fold([input.subject, input.content].filter(Boolean).join(" "));
  const ticketAgent = fold(input.close_note);
  const custText = [...custParts, ticketCustomer].filter(Boolean).join(" ");
  const agentText = [...agentParts, ticketAgent].filter(Boolean).join(" ");

  // the language of the person whose tone we are judging
  const { lang, confident } = detectLang(custText || agentText);
  const useAll = !confident;
  const customer = scoreSide(custText, lang, useAll);
  const agent = scoreSide(agentText, lang, useAll);

  const toneNeg = customer.points.tone_neg + customer.points.chasing;
  const tone = decide(customer.points.tone_pos, toneNeg);
  const resolution = decide(agent.points.resol_pos, agent.points.resol_neg);

  return {
    lang, langConfident: confident,
    tone: tone.bucket, toneConfidence: tone.confidence,
    resolution: resolution.bucket, resolutionConfidence: resolution.confidence,
    urgency: customer.points.urgency,
    customer, agent,
  };
}

/**
 * Should the model be asked about this ticket?
 *
 * The cheap scorer is trusted when it is sure. The model is for the cases that matter and are
 * not clear: nothing found at all, a thin margin, or a ticket leaning negative - where being
 * wrong is most expensive, because that is the figure anybody will act on.
 */
export function needsModel(d: Detection, floor = 0.5): boolean {
  if (d.tone === "unknown") return true;
  if (d.toneConfidence < floor) return true;
  if (d.tone === "negative" && d.toneConfidence < 0.75) return true;
  return false;
}
