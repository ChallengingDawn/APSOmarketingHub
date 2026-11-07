// CERTIFICATES - the declaration made on the ticket card: its state and when it may go out (pure - makerSend.ts sends).
// SARCLA 07.11.2026: the certificate maker - the issuer and the conformity expert sign on the card, "then sent
// automatically to the customer and EDA, in separate mails".

import { isHeld, type Facts } from "./rules";

export const MAKER_PROP = "apsohub_certificate_maker";
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
export type MakerRow = { at: string; ticketId: string; what: "sent" | "would" | "failed"; to: string; eda: string | null; error?: string };

// the customer's mail never goes to an address of ours (a HubSpot inbox opens a ticket - the 05.11.2026 loop)
const OURS = /(@apsoparts\.com|@angst-pfister\.com|hs-inbox\.com)$/i;

export function parseMaker(raw: string | null | undefined): MakerState | null {
  if (!raw) return null;
  try { const s = JSON.parse(raw) as MakerState; return s && s.v === 1 && s.status ? s : null; } catch { return null; }
}

/** Why this ticket's declaration does not go out now - null = it goes. */
export function notSending(f: Pick<Facts, "id" | "hold">, s: MakerState | null, held: Record<string, unknown>, mode: MakerSend): string | null {
  if (!s || s.status !== "signed") return "not signed by the conformity expert";
  if (s.test) return "a test (made on a ticket on hold)";
  if (isHeld(f, held)) return "on hold";
  if (!s.send?.to || OURS.test(s.send.to)) return "no customer address";
  if (!s.files?.length) return "no PDF";
  if (mode !== "live") return "sending is off on Settings";
  return null;
}
