// CERTIFICATES - the declaration made on the ticket card: its state and when it may go out (pure - makerSend.ts sends).
// SARCLA 07.11.2026: the certificate maker - the issuer and the conformity expert sign on the card, "then sent
// automatically to the customer and EDA, in separate mails".

import { isHeld, type Facts } from "./rules";

export const MAKER_PROP = "apsohub_certificate_maker";
/** A DEMO request (SARCLA 07.11.2026, the demo of the certificate process on three demo orders): "name · owner id · e-mail".
 *  The hub runs every step as for a real request, but every person it would pick (the rotation, the expert, Rose) is
 *  that user, every mail goes to him only - also the customer's and EDA's - and the PDFs say DEMO. */
export const DEMO_PROP = "apsohub_certificate_demo";
export type DemoUser = { name: string; owner: string; email: string };
export function demoOf(raw: string | null | undefined): DemoUser | null {
  const [name, owner, email] = String(raw ?? "").split("·").map((x) => x.trim());
  return name && /^\d+$/.test(owner ?? "") && /@/.test(email ?? "") ? { name, owner: owner!, email: email! } : null;
}
export const EDA = "eda.apch@angst-pfister.com";
export type MakerSend = "off" | "live";

export type MakerFile = { id: string; name: string; master: string };
export type Signer = { name: string; email: string; sig: string; at: string; title?: string };
export type MakerState = {
  v: 1;
  status: "draft" | "issuer" | "signed" | "sending" | "sent" | "failed";
  test?: boolean;
  decl: { date: string; customer: string[]; customerNo: string; order: string; job: string; issuer: { name: string; email: string; code: string }; positions: { article: string; text: string; master: string }[] };
  files: MakerFile[];
  signers: { issuer?: Signer; expert?: Signer };
  send?: { to: string; lang: string; at: string; by: string };
  sent?: { at: string; to: string; eda: string | null; edaError?: string };
  error?: string;
  log?: { at: string; what: string; by: string }[];
  at?: string; by?: string;
};
/** avor = the AVOR mail sent, avorFailed = not sent, avorAnswer = AVOR's answer merged into the request (to = who answered) */
export type MakerRow = { at: string; ticketId: string; what: "sent" | "would" | "failed" | "avor" | "avorFailed" | "avorAnswer"; to: string; eda: string | null; error?: string; from?: string };

// ---------------- the mail to AVOR (SARCLA 08.11.2026: "can we send the mail directly from here") ----------------
// EC 1935/2004 needs a new article number from AVOR first. The ticket card queues the mail as the Back Office writes it
// (apsohub_certificate_avor); the hub sends it in the user's name - replies to support@, as the mails written on the
// ticket - and logs it on the ticket. HubSpot lets no app open a conversation from the support@ inbox, so AVOR's answer
// comes in as a new support@ ticket: the way in (boDistribution/intakeRun) merges it into the request before the
// Back Office rotation sees it.
export const AVOR_PROP = "apsohub_certificate_avor";
export const AVOR_TO = "avor@angst-pfister.com";
export type AvorSent = { at: string; to: string; by: string; remind?: boolean };
export type AvorState = {
  v: 1;
  status: "queued" | "sending" | "sent" | "failed";
  kind?: "" | "demo";
  remind?: boolean;
  to: string; subject: string; body: string;
  by: { name: string; email: string; owner: string | null };
  at: string;
  sent?: AvorSent[];
  answered?: { at: string; ticket: string; from: string | null }[];
  error?: string;
};

export function parseAvor(raw: string | null | undefined): AvorState | null {
  if (!raw) return null;
  try { const s = JSON.parse(raw) as AvorState; return s && s.v === 1 && s.status && s.subject ? s : null; } catch { return null; }
}

/** Why the queued AVOR mail does not go now - null = it goes. Never: on hold (a TEST), another address than AVOR's
 *  (a DEMO: only the demo user's), no text. */
export function avorNotSending(f: Pick<Facts, "id" | "hold" | "demo">, s: AvorState | null, held: Record<string, unknown>): string | null {
  if (!s || s.status !== "queued") return "nothing queued";
  if (isHeld(f, held)) return "on hold";
  const demo = demoOf(f.demo);
  if (demo ? s.to.toLowerCase() !== demo.email.toLowerCase() : s.to.toLowerCase() !== AVOR_TO) return "not AVOR's address";
  if (!s.body.trim() || !s.subject.trim()) return "no text";
  return null;
}

/** The A-number an AVOR mail names - its subject as the Back Office writes it ("WSMB | EG1935/2004 | M100 | A26.990002 | ...",
 *  with any "AW:", "RE:", "Erinnerung:" in front). null = not an AVOR mail. */
export function avorRefOf(subject: string | null | undefined): string | null {
  const m = /EG\s?1935\s*\/\s*2004\s*\|\s*M\d{3}\s*\|\s*(A\d{2}\.\d{6})/i.exec(String(subject ?? ""));
  return m ? m[1].toUpperCase() : null;
}

/** AVOR's answer to a mail the hub sent: from one of ours (AVOR answers from avor@ or their own address), naming the
 *  A-number, after the hub's mail went out. */
export function isAvorAnswer(email: { from: string | null; subject: string | null; at: number }, ref: string, s: AvorState | null): boolean {
  if (!s || !(s.sent ?? []).length) return false;
  if (!/@angst-pfister\.com$/i.test(String(email.from ?? "").trim())) return false;
  if (avorRefOf(email.subject) !== ref) return false;
  const first = Math.min(...(s.sent ?? []).map((x) => Date.parse(x.at)));
  return !Number.isNaN(first) && email.at >= first - 60_000;
}

// the customer's mail never goes to an address of ours (a HubSpot inbox opens a ticket - the 05.11.2026 loop)
const OURS = /(@apsoparts\.com|@angst-pfister\.com|hs-inbox\.com)$/i;

export function parseMaker(raw: string | null | undefined): MakerState | null {
  if (!raw) return null;
  try { const s = JSON.parse(raw) as MakerState; return s && s.v === 1 && s.status ? s : null; } catch { return null; }
}

/** Why this ticket's declaration does not go out now - null = it goes. A DEMO goes, to the demo user only, whatever the switch. */
export function notSending(f: Pick<Facts, "id" | "hold" | "demo">, s: MakerState | null, held: Record<string, unknown>, mode: MakerSend): string | null {
  if (!s || s.status !== "signed") return "not signed by the conformity expert";
  if (s.test) return "a test (made on a ticket on hold)";
  if (isHeld(f, held)) return "on hold";
  if (demoOf(f.demo)) return s.files?.length ? null : "no PDF";
  if (!s.send?.to || OURS.test(s.send.to)) return "no customer address";
  if (!s.files?.length) return "no PDF";
  if (mode !== "live") return "sending is off on Settings";
  return null;
}
