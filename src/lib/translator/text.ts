// APSO TRANSLATOR - the pure rules (no I/O): what a message says once its HTML, signature and quoted chain are gone, which
// note is a command, and the words of every comment the hub posts. Ported from the Railway translator
// (ChallengingDawn/hubspot-translator, backend/server.js + services/hubspot-api.js) so the Back Office sees the same
// comments as before - SARCLA 08.11.2026: "migrate to the hub ... kill Railway and bring all to the hub".

/** The languages an agent can ask for with "!XX", as DeepL names its targets. */
export const LANGS: Record<string, string> = {
  EN: "EN-US", "EN-US": "EN-US", "EN-GB": "EN-GB",
  PT: "PT-PT", "PT-PT": "PT-PT", "PT-BR": "PT-BR",
  FR: "FR", DE: "DE", ES: "ES", IT: "IT", PL: "PL", NL: "NL", RU: "RU", JA: "JA", ZH: "ZH", KO: "KO",
};
export const LANG_NAMES: Record<string, string> = {
  EN: "English", DE: "German", FR: "French", IT: "Italian", ES: "Spanish", PT: "Portuguese", NL: "Dutch", PL: "Polish", RU: "Russian",
  JA: "Japanese", ZH: "Chinese", KO: "Korean", CS: "Czech", DA: "Danish", FI: "Finnish", SV: "Swedish", HU: "Hungarian", RO: "Romanian",
  SK: "Slovak", SL: "Slovenian", TR: "Turkish", UK: "Ukrainian", EL: "Greek", BG: "Bulgarian", LT: "Lithuanian", LV: "Latvian", ET: "Estonian", NB: "Norwegian", ID: "Indonesian",
};
/** "PT-BR" -> "PT", "en-us" -> "EN" */
export const base = (lang: string | null | undefined) => String(lang ?? "").toUpperCase().split("-")[0];
/** DeepL's target for a customer's language: English needs its variant, Portuguese too. */
export const targetOf = (lang: string) => LANGS[lang.toUpperCase()] ?? LANGS[base(lang)] ?? base(lang);

/** Addresses the hub never sends to: our own people and HubSpot's own inboxes (05.11.2026: a loop made 120 tickets). */
const INTERNAL = /@(apsoparts|angst-pfister|angstpfister)\.|@[a-z0-9-]+\.hubspot(-inbox)?\.com$|@hs-inbox\./i;
export const isInternal = (email: string | null | undefined) => !!email && INTERNAL.test(email.trim());
export const isEmail = (v: unknown): v is string => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** HTML to text: line breaks kept, tags gone, entities read (&amp; last, so "&amp;lt;" stays "&lt;"). */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n").replace(/<\/li>/gi, "\n").replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

const CLOSINGS = [
  "Best regards", "Kind regards", "Warm regards", "Regards", "Sincerely", "Thanks", "Thank you", "Cheers", "Best", "All the best",
  "Mit freundlichen Grüßen", "Viele Grüße", "Liebe Grüße", "Freundliche Grüße", "MfG", "LG",
  "Cordialement", "Bien cordialement", "Bien à vous", "Merci", "Salutations",
  "Atenciosamente", "Abraços", "Obrigado", "Obrigada", "Cumprimentos", "Saudações",
  "Saludos", "Atentamente", "Gracias", "Un saludo", "Cordialmente",
  "Cordiali saluti", "Distinti saluti", "Grazie", "Saluti",
  "Met vriendelijke groet", "Groeten", "Bedankt", "Mvg",
].join("|").replace(/\s+/g, "\\s+");

/** An e-mail's signature off (the "-- " line, "Sent from my iPhone", a closing and a name). */
export function stripEmailSignature(text: string): string {
  if (!text) return text;
  const dash = text.indexOf("\n-- ");
  if (dash !== -1) return text.slice(0, dash).trim();
  const lines = text.split("\n");
  const bare = lines.findIndex((l) => l.trim() === "--");
  if (bare !== -1) return lines.slice(0, bare).join("\n").trim();
  for (const p of [/\nSent from my (iPhone|iPad|Android|Samsung|Galaxy|Pixel|Huawei|Xiaomi)/i, /\nGet Outlook for (iOS|Android)/i, /\nEnviado desde mi (iPhone|iPad|Android)/i,
    /\nEnvoyé de mon (iPhone|iPad|Android)/i, /\nGesendet von meinem (iPhone|iPad|Android)/i, /\nInviato da (iPhone|iPad|Android)/i, /\nEnviado do meu (iPhone|iPad|Android)/i]) {
    const m = p.exec(text);
    if (m) return text.slice(0, m.index).trim();
  }
  const named = new RegExp(`\\n(${CLOSINGS}),?\\s*\\n+\\s*[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+)*`, "i").exec(text);
  if (named) return text.slice(0, named.index).trim();
  const alone = new RegExp(`\\n(${CLOSINGS}),?\\s*\\n`, "i").exec(text);
  if (alone && alone.index >= Math.floor(text.length * (text.length < 500 ? 0.5 : 0.7))) return text.slice(0, alone.index).trim();
  return text;
}

export type RawMessage = {
  id: string; type?: string; direction?: string; createdAt?: string; text?: string | null; richText?: string | null; truncationStatus?: string;
  channelId?: string | number | null; channelAccountId?: string | number | null;
  senders?: { actorId?: string; name?: string; deliveryIdentifier?: { value?: string }; deliveryIdentifiers?: { value?: string }[] }[];
  recipients?: { recipientField?: string; deliveryIdentifier?: { value?: string }; deliveryIdentifiers?: { value?: string }[] }[];
};

/** What a message says: the fullest field, the forwarded header off, a long one's signature off; "" when nothing is left. */
export function messageText(m: Pick<RawMessage, "text" | "richText">): string {
  const rich = stripHtml(m.richText);
  const plain = stripHtml(m.text);
  let t = rich.length > 10 ? rich : plain.length > rich.length ? plain : rich;
  if (t.length < 3) return "";
  t = t.replace(/[-]{3,}\s*(Forwarded message|Original Message|Mensagem encaminhada|Message transféré|Weitergeleitete Nachricht|Mensaje reenviado|Messaggio inoltrato)\s*[-]{3,}\s*\n((?:(?:From|De|Von|Da|Från|Date|Datum|Data|Fecha|Subject|Sujet|Betreff|Oggetto|Asunto|Assunto|To|À|An|Para|Aan|Cc|Cci|Bcc):\s*[^\n]*\n)*)/gi, "\n")
    .replace(/\n{3,}/g, "\n\n").trim();
  if (t.length > 200) {
    const s = stripEmailSignature(t);
    if (s.length >= t.length * 0.3) t = s;
  }
  return t.length >= 3 ? t : "";
}

/** The part of a customer's e-mail worth translating: links, the reply chain, signatures, legal footers and templates cut. */
export function cleanForTranslation(text: string): string {
  if (!text) return "";
  let c = text
    .replace(/https?:\/\/eur\d+\.safelinks\.protection\.outlook\.com\/\?url=[^\s>)]+/gi, "").replace(/<https?:\/\/[^>]+>/gi, "")
    .replace(/https?:\/\/[^\s>)]+/gi, "").replace(/www\.[^\s>)]+/gi, "").replace(/\[mailto:[^\]]+\]/g, "").replace(/<mailto:[^>]+>/g, "");
  const cuts = [
    /\n-{3,}\s*(Forwarded|Original|Weitergeleitete|Messaggio inoltrato)/i, /\n-{5,}/, /\n_{5,}/, /\n(From|Von|Da|De|Van):\s*.+@/im, /\nSent:\s/im, /\nDate:\s/im, /\n>+ /,
    /\n\s*(Best regards|Kind regards|Regards)\s*[/|,\n]/i, /\n\s*Cordialement\s*[/|,\n]/i, /\n\s*Cordiali saluti\s*[/|,\n]/i, /\n\s*Cordialmente\s*[/|,\n]/i,
    /\n\s*Freundliche Gr[üu]ss?e\s*[/|,\n]/i, /\n\s*Mit freundlichen Gr[üu]ss?en\s*[/|,\n]/i, /\n\s*Met vriendelijke groet\s*[/|,\n]/i, /\n\s*Distinti saluti\s*[/|,\n]/i,
    /\nAPSOparts\s*(AG|GmbH)/i, /\nAngst\+Pfister/i, /\nSales Agent\s/i, /\nRegulatory Affairs/i, /\nManagement:\s/i, /\nTax ID:/i, /\nUST ID/i, /\nHRB \d/i,
    /\nPlease note:\s*This email is confidential/i, /\nConfidentiality Notice/i, /\nThis document is intended solely/i, /\nThis e-mail message including any attachments/i,
    /\nContact us here/i, /\nVisit our Online-Shop/i, /\nFor further information visit/i, /\nS[äa]gereistrasse/i, /\nSiemens Street/i,
    /\nOrder number\n/i, /\nPurchase order number\n/i, /\nOrder date\n/i, /\nDelivery date\n/i, /\nSAP Business Network/i, /\nAriba Network/i,
    /\nThis is an automatically generated/i, /\nThis is a system generated/i, /\nDo not reply to this email/i, /\nPlease do not reply/i, /\nThis message was sent from/i,
    /\nIf you have questions.*contact/i, /\n©\s*\d{4}/, /\nAll rights reserved/i, /\nPrivacy Policy/i, /\nTerms of Use/i, /\nUnsubscribe/i,
  ];
  for (const m of cuts) {
    const hit = m.exec(c);
    if (hit) c = c.slice(0, hit.index);
  }
  c = c.replace(/\n{3,}/g, "\n\n").trim();
  if (c.length > 1500) {
    const bp = c.lastIndexOf("\n\n", 1500);
    c = (bp > 200 ? c.slice(0, bp) : c.slice(0, 1500)).trim();
  }
  return c;
}

// The common words of the languages customers write in - what guessLanguage counts. A word shared by two languages
// ("la", "de", "is") is left out: it would only blur the count.
const STOP: Record<string, string> = {
  EN: "the and you for with have this that please are our your will would can thank thanks regards we not from could should what when which there been was were",
  DE: "der die das und ist nicht mit für ich wir sie ein eine bitte danke haben wird auf auch von zu den dem des sehr gerne freundlichen grüssen grüßen guten können möchten uns ihre bei noch oder hallo vielen dank",
  FR: "les est pour avec vous nous une des du pas merci bonjour cordialement sur dans qui cette mais sont avons pouvez votre vos aux je suis bien commande",
  IT: "il gli che per non sono della grazie buongiorno saluti cordiali vostro vostra nostro nostra abbiamo può potete anche alla delle dei salve questo questa",
  ES: "el los las para por del gracias hola saludos nuestro nuestra está pero como muy también necesito usted pedido",
  NL: "het een van voor niet wij ons uw graag bedankt groet groeten zijn kunnen hebben ook bij alvast vriendelijke",
  PT: "os não uma obrigado obrigada bom dia cumprimentos nosso você pelo pela encomenda",
  PL: "nie jest się że dla oraz dzień dobry dziękuję pozdrawiam proszę czy",
};
const STOP_SETS = Object.entries(STOP).map(([lang, words]) => [lang, new Set(words.split(" "))] as const);
/**
 * The language a text is written in, from its common words - free, for counting (the history of 09.11.2026), never for
 * a translation: DeepL reads the language when it translates. Null when the text is too short or the count is not clear.
 */
export function guessLanguage(text: string): string | null {
  const words = cleanForTranslation(text).toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 4) return null;
  const score: Record<string, number> = {};
  for (const w of words) for (const [lang, set] of STOP_SETS) if (set.has(w)) score[lang] = (score[lang] ?? 0) + 1;
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < 2) return null;
  if (ranked[1] && ranked[0][1] < ranked[1][1] * 1.5) return null;
  return ranked[0][0];
}

export type Command = { kind: "help" } | { kind: "lang"; code: string; target: string | null } | { kind: "reply"; text: string } | null;
/** A note an agent wrote: "!help", "!FR" (the customer's last message in French), "!<text>" (the text sent in the customer's language). */
export function parseCommand(raw: string): Command {
  const t = raw.trim();
  if (!t.startsWith("!")) return null;
  const rest = t.slice(1).trim();
  // "!!! urgent" is an agent shouting at a colleague, not a reply for the customer
  if (rest.length < 2 || rest.startsWith("!") || !/\p{L}{2}/u.test(rest)) return null;
  if (rest.toLowerCase() === "help") return { kind: "help" };
  const lang = /^([A-Za-z]{2}(?:-[A-Za-z]{2})?)$/.exec(rest);
  if (lang) return { kind: "lang", code: lang[1].toUpperCase(), target: LANGS[lang[1].toUpperCase()] ?? null };
  return { kind: "reply", text: rest };
}

/** The words of every comment, as the Back Office knows them from the Railway translator. */
export const COMMENT = {
  incoming: (from: string, text: string) => `🌐 Auto-translation (${base(from)} → EN):\n\n${text}`,
  lang: (from: string, to: string, text: string) => `🌐 Translation (${base(from)} → ${to}):\n\n${text}`,
  unsupported: (code: string) => `⚠️ Unsupported language: ${code}. Supported: EN, PT, FR, DE, ES, IT, PL, NL, RU, JA, ZH, KO`,
  noCustomerMessage: "⚠️ No customer message found to translate.",
  noLanguage: "⚠️ Could not detect the customer's language. Please try again.",
  sameLanguage: (lang: string) => `ℹ️ Text is already in ${base(lang)} - no translation needed. Message not sent.`,
  failed: (why: string) => `❌ Translation failed: ${why}. Message NOT sent to the customer.`,
  notSent: (why: string) => `❌ Not sent: ${why}`,
  sent: (lang: string) => `✅ Sent to the customer in ${LANG_NAMES[base(lang)] ?? base(lang)}.`,
  help: [
    "📚 APSO Translator",
    "",
    "✅ Every customer message is translated into English here, within a minute.",
    "",
    "🌐 The customer's last message in another language:",
    "!DE German · !EN English · !ES Spanish · !FR French · !IT Italian · !NL Dutch · !PL Polish · !PT Portuguese · !RU Russian",
    "",
    "✉️ Reply in the customer's language: write your message after ! and it is translated and sent.",
    "Example: !Hello, how can I help you today?",
    "",
    "The customer's language is read from their messages. A comment can take up to a minute.",
  ].join("\n"),
};

/** Text to HubSpot's richText: paragraphs, line breaks, nothing a customer could inject. */
export function toRichText(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return text.split(/\n\n+/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/** Two texts the same once case and spaces are set aside (a reply already in the customer's language). */
export const sameText = (a: string, b: string) => a.toLowerCase().replace(/\s+/g, " ").trim() === b.toLowerCase().replace(/\s+/g, " ").trim();

/** The customer of a thread: the newest incoming message's sender, with its address when it is one. */
export function customerOf(messages: RawMessage[]): { actorId: string | null; email: string | null; channelId: string | null; channelAccountId: string | null } {
  const inc = [...messages].filter((m) => m.type === "MESSAGE" && /INCOMING|FORWARD/.test(m.direction ?? "")).sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
  const pick = (v?: string) => (isEmail(v) ? v.trim() : null);
  let email: string | null = null;
  for (const m of inc) { const s = m.senders?.[0]; email = pick(s?.deliveryIdentifier?.value) ?? pick(s?.deliveryIdentifiers?.[0]?.value); if (email) break; }
  if (!email) {
    for (const m of messages) {
      if (m.direction !== "OUTGOING") continue;
      const r = m.recipients?.[0];
      email = pick(r?.deliveryIdentifier?.value) ?? pick(r?.deliveryIdentifiers?.[0]?.value);
      if (email) break;
    }
  }
  const last = inc[0];
  return {
    actorId: last?.senders?.[0]?.actorId ?? null, email,
    channelId: last?.channelId != null ? String(last.channelId) : null, channelAccountId: last?.channelAccountId != null ? String(last.channelAccountId) : null,
  };
}
