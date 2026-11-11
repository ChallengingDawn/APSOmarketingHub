// WHAT MAGENTO ANSWERED, IN A FEW WORDS (Content v14b, 11.11.2026). Pure: the CMS writers (./cmsPage.ts, ./cms.ts), the
// page studio's last step and the tests.
//
// SARCLA 11.11.2026, 15:35: production's "Update all" said "Magento answered 403: <!doctype html>…" for four pages - the
// first 160 characters of an HTML page, which never reach its title. Magento's API answers JSON; an HTML page is somebody
// else in front of it (a firewall, a maintenance page, a login), so the person is told that, with the page's own title.

/** The <title> of an HTML answer (its entities read, its spaces folded), or null. */
export function htmlTitleOf(text: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(text ?? ""));
  if (!m) return null;
  const t = m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 120) : null;
}

/** An answer that is an HTML page, not the API's JSON. */
export const isHtmlAnswer = (text: string) => /^\s*(<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(String(text ?? ""));

/** What a refused call's body says: an HTML page by its title, else the start of what came back. */
export function answerSaid(text: string, max = 160): string {
  const s = String(text ?? "");
  if (isHtmlAnswer(s)) {
    const title = htmlTitleOf(s);
    return `an HTML page${title ? ` titled "${title}"` : " without a title"} instead of Magento's API answer`;
  }
  return s.slice(0, max);
}
