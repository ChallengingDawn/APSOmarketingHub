// THE CHAT'S SUMMARY BY E-MAIL - its words and its look, pure (no imports: the tests load it as is). The job that
// writes and sends it is summaryMail.ts. Six shop languages; the shop's red line and plain type.

export type Line = { who: "customer" | "ai" | "agent"; name: string | null; text: string };
export type Written = { points: string[]; next: string };

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── the words around the summary, in the six shop languages ── */
export const LANGS = ["en", "de", "fr", "it", "nl", "pl"] as const;
export type Lang = (typeof LANGS)[number];
export const LANGUAGE: Record<Lang, string> = { en: "English", de: "German", fr: "French", it: "Italian", nl: "Dutch", pl: "Polish" };
const W: Record<Lang, { subject: string; hi: string; intro: string; points: string; next: string; links: string; reply: string; why: string; bye: string }> = {
  en: { subject: "Your chat with APSOparts - summary", hi: "Hello,", intro: "As requested, here is the summary of your chat on apsoparts.com.", points: "What we discussed", next: "What happens next", links: "Links from the chat", reply: "Questions? Just reply to this e-mail - our team will get back to you.", why: "You are receiving this e-mail because you asked for the summary of your chat on apsoparts.com.", bye: "Your APSOparts team" },
  de: { subject: "Ihr Chat mit APSOparts - Zusammenfassung", hi: "Guten Tag,", intro: "wie gewünscht, hier die Zusammenfassung Ihres Chats auf apsoparts.com.", points: "Worum es ging", next: "Wie es weitergeht", links: "Links aus dem Chat", reply: "Fragen? Antworten Sie einfach auf diese E-Mail - unser Team meldet sich bei Ihnen.", why: "Sie erhalten diese E-Mail, weil Sie im Chat auf apsoparts.com die Zusammenfassung angefordert haben.", bye: "Ihr APSOparts-Team" },
  fr: { subject: "Votre chat avec APSOparts - résumé", hi: "Bonjour,", intro: "Comme demandé, voici le résumé de votre chat sur apsoparts.com.", points: "Ce dont nous avons parlé", next: "La suite", links: "Liens du chat", reply: "Des questions ? Répondez simplement à cet e-mail - notre équipe reviendra vers vous.", why: "Vous recevez cet e-mail parce que vous avez demandé le résumé de votre chat sur apsoparts.com.", bye: "Votre équipe APSOparts" },
  it: { subject: "La sua chat con APSOparts - riepilogo", hi: "Buongiorno,", intro: "Come richiesto, ecco il riepilogo della sua chat su apsoparts.com.", points: "Di cosa abbiamo parlato", next: "I prossimi passi", links: "Link dalla chat", reply: "Domande? Risponda semplicemente a questa e-mail - il nostro team la ricontatterà.", why: "Riceve questa e-mail perché ha richiesto il riepilogo della sua chat su apsoparts.com.", bye: "Il suo team APSOparts" },
  nl: { subject: "Uw chat met APSOparts - samenvatting", hi: "Goedendag,", intro: "Zoals gevraagd, hier is de samenvatting van uw chat op apsoparts.com.", points: "Waar het over ging", next: "Hoe het verder gaat", links: "Links uit de chat", reply: "Vragen? Beantwoord gewoon deze e-mail - ons team neemt contact met u op.", why: "U ontvangt deze e-mail omdat u in de chat op apsoparts.com om de samenvatting hebt gevraagd.", bye: "Uw APSOparts-team" },
  pl: { subject: "Państwa czat z APSOparts - podsumowanie", hi: "Dzień dobry,", intro: "zgodnie z prośbą przesyłamy podsumowanie czatu na apsoparts.com.", points: "O czym rozmawialiśmy", next: "Dalsze kroki", links: "Linki z czatu", reply: "Pytania? Wystarczy odpowiedzieć na tę wiadomość - nasz zespół się odezwie.", why: "Otrzymują Państwo tę wiadomość, ponieważ poprosili Państwo o podsumowanie czatu na apsoparts.com.", bye: "Zespół APSOparts" },
};
export const langOf = (x: string | null | undefined): Lang => ((LANGS as readonly string[]).includes(String(x)) ? (x as Lang) : "en");

/** Shop links said in the chat (the AI's and the team's), each once, in order - only apsoparts.com addresses. */
export function shopLinks(lines: Line[]): { url: string; label: string }[] {
  const out: { url: string; label: string }[] = [];
  for (const l of lines) {
    if (l.who === "customer") continue;
    for (const m of l.text.matchAll(/https?:\/\/[^\s<>"'()\]]+/gi)) {
      const url = m[0].replace(/[.,;:!?]+$/, "");
      let u: URL;
      try { u = new URL(url); } catch { continue; }
      if (!/(^|\.)apsoparts\.com$/i.test(u.hostname) || out.some((x) => x.url === url)) continue;
      const slug = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "").replace(/\.html?$/i, "").replace(/[-_]+/g, " ").trim();
      out.push({ url, label: /cart\/share/.test(u.pathname) ? "apsoparts.com - cart" : slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : u.hostname });
      if (out.length >= 8) return out;
    }
  }
  return out;
}

/** The mail: the shop's look (red line, plain type), the summary's points, what happens next, the chat's links. */
export function summaryMail(lang: string | null, w: Written, links: { url: string; label: string }[]): { subject: string; html: string; text: string } {
  const t = W[langOf(lang)];
  const li = (s: string) => `<li style="margin:0 0 8px">${esc(s)}</li>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f4">
  <div style="max-width:620px;margin:0 auto;padding:28px 20px;font-family:Arial,Helvetica,sans-serif;color:#222">
    <div style="font-size:22px;font-weight:700;letter-spacing:-.01em;margin-bottom:18px">APSO<span style="color:#d80901">parts</span><span style="font-size:13px;vertical-align:super">®</span></div>
    <div style="background:#fff;border-top:4px solid #d80901;border-radius:8px;padding:24px">
      <p style="margin:0 0 6px;font-size:15px">${esc(t.hi)}</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.5">${esc(t.intro)}</p>
      <h2 style="margin:0 0 10px;font-size:16px">${esc(t.points)}</h2>
      <ul style="margin:0 0 18px;padding-left:20px;font-size:14.5px;line-height:1.5">${w.points.map(li).join("")}</ul>
      ${w.next ? `<h2 style="margin:0 0 8px;font-size:16px">${esc(t.next)}</h2><p style="margin:0 0 18px;font-size:14.5px;line-height:1.5">${esc(w.next)}</p>` : ""}
      ${links.length ? `<h2 style="margin:0 0 8px;font-size:16px">${esc(t.links)}</h2><ul style="margin:0 0 18px;padding-left:20px;font-size:14.5px;line-height:1.6">${links.map((l) => `<li><a href="${esc(l.url)}" style="color:#d80901">${esc(l.label)}</a></li>`).join("")}</ul>` : ""}
      <p style="margin:0 0 4px;font-size:14.5px;line-height:1.5">${esc(t.reply)}</p>
      <p style="margin:14px 0 0;font-size:14.5px">${esc(t.bye)}</p>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#6f6f6f;line-height:1.5">${esc(t.why)}<br>APSOparts® · Angst+Pfister AG</p>
  </div></body></html>`;
  const text = [t.hi, "", t.intro, "", `${t.points}:`, ...w.points.map((p) => `- ${p}`), "",
    ...(w.next ? [`${t.next}:`, w.next, ""] : []), ...(links.length ? [`${t.links}:`, ...links.map((l) => `- ${l.label}: ${l.url}`), ""] : []),
    t.reply, "", t.bye, "", "--", t.why].join("\n");
  return { subject: t.subject, html, text };
}
