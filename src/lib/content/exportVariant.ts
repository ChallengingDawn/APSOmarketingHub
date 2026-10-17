// EXPORT A VERSION (list E9).
//
// A version that is finished has to leave the hub: into the shop's CMS, into
// an email to an agency, into the Word document somebody's manager wants to
// read on a train. Until now it left by being selected with a mouse, which
// loses every heading and brings the page furniture with it.
//
// Four ways out, because they are four different errands:
//   - COPY is for pasting into the next tool, and it is the one people use
//   - .md is for the CMS and for anything that reads markdown
//   - .doc is for Word, and for the person who will add comments in Word
//   - .pdf is for sending to somebody who must not edit it
//
// The .doc is a Word-readable HTML document, not OOXML. Word has opened these
// since 2000 and renders the headings, the bold and the lists; it is honestly
// a .doc only in the sense that Word opens it. The alternative was a zip
// writer and a new dependency in a shared repository, for a file that in
// practice gets its text pasted into a template anyway.

export type ExportVariant = {
  label: string | null;
  title: string | null;
  body: string;
  language: string | null;
  channel: string;
  createdBy: string | null;
};

/**
 * A filename somebody can find again, on Windows, in a Downloads folder with
 * four hundred other things in it.
 */
export function slugFor(...parts: (string | null | undefined)[]): string {
  const raw = parts.filter(Boolean).join(" ");
  const slug = raw
    .toLowerCase()
    // Accents first, or "Grösse" becomes "gr-sse".
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    // A 200-character filename is a filename nobody can read in a list.
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "version";
}

/** The header that tells a file read next March which project it came from. */
function headerLines(projectTitle: string, v: ExportVariant): string[] {
  const bits = [v.label, v.language, v.channel, v.createdBy].filter(Boolean);
  return [`> ${projectTitle}`, bits.length ? `> ${bits.join(" · ")}` : null].filter(
    (l): l is string => l !== null,
  );
}

/** Markdown, with a two-line provenance header above it. */
export function markdownFor(projectTitle: string, v: ExportVariant): string {
  const out: string[] = [];
  if (v.title) out.push(`# ${v.title}`, "");
  out.push(...headerLines(projectTitle, v), "");
  out.push(v.body.trim());
  return out.join("\n") + "\n";
}

/** What Copy puts on the clipboard: the text, without the provenance header. */
export function plainTextFor(v: ExportVariant): string {
  return (v.title ? `${v.title}\n\n` : "") + v.body.trim() + "\n";
}

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/** Escape first, always. Everything below runs on already-escaped text. */
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESC[c]);
}

/**
 * The markdown the studio actually emits: headings, list items, bold, and
 * paragraphs. Anything else is left as its own text rather than guessed at -
 * a half-written markdown parser turns a stray asterisk into a tag and the
 * document opens broken, which is worse than an asterisk on the page.
 */
function inline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // A single asterisk is emphasis only when it hugs its words: *like this*.
    // "2 * 3 = 6 and a lone *" has two asterisks and no emphasis in it, and
    // the obvious pattern made one <em> out of everything between them.
    .replace(/(^|[\s(])\*(\S|\S[^*\n]*\S)\*(?=$|[\s.,;:!?)])/g, "$1<em>$2</em>");
}

export function bodyToHtml(body: string): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  for (const rawLine of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(esc(heading[2]))}</h${level}>`);
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inline(esc(bullet[1]))}</li>`);
      continue;
    }
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inline(esc(numbered[1]))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(esc(line))}</p>`);
  }
  closeList();
  return out.join("\n");
}

/**
 * A document Word opens with the structure intact.
 *
 * The styles are inline and in points, because Word's HTML import ignores
 * most of a stylesheet and all of a rem.
 */
export function wordHtmlFor(projectTitle: string, v: ExportVariant): string {
  const bits = [v.label, v.language, v.channel, v.createdBy].filter(Boolean).join(" · ");
  return [
    "<!DOCTYPE html>",
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>${esc(v.title || v.label || projectTitle)}</title>`,
    "<style>",
    "body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }",
    "h1 { font-size: 20pt; } h2 { font-size: 15pt; } h3 { font-size: 12.5pt; } h4 { font-size: 11pt; }",
    "p, li { line-height: 1.4; }",
    ".provenance { color: #666666; font-size: 9pt; border-bottom: 1pt solid #cccccc; padding-bottom: 6pt; }",
    "</style>",
    "</head>",
    "<body>",
    v.title ? `<h1>${esc(v.title)}</h1>` : "",
    `<p class="provenance">${esc(projectTitle)}${bits ? ` &middot; ${esc(bits)}` : ""}</p>`,
    bodyToHtml(v.body),
    "</body>",
    "</html>",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The plain lines a PDF writer lays out, headings marked for size. */
export type PdfLine = { text: string; size: number; bold: boolean; gapBefore: number };

/**
 * Turned into lines here rather than in the component, so what a PDF contains
 * is testable without a canvas.
 */
export function pdfLinesFor(projectTitle: string, v: ExportVariant): PdfLine[] {
  const lines: PdfLine[] = [];
  if (v.title) lines.push({ text: v.title, size: 18, bold: true, gapBefore: 0 });
  const bits = [v.label, v.language, v.channel].filter(Boolean).join(" · ");
  lines.push({ text: `${projectTitle}${bits ? ` · ${bits}` : ""}`, size: 9, bold: false, gapBefore: 4 });

  for (const rawLine of v.body.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      lines.push({ text: heading[2], size: level === 1 ? 15 : level === 2 ? 13 : 11.5, bold: true, gapBefore: 10 });
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      lines.push({ text: `•  ${bullet[1].replace(/\*\*/g, "")}`, size: 10.5, bold: false, gapBefore: 2 });
      continue;
    }
    lines.push({ text: line.replace(/\*\*/g, ""), size: 10.5, bold: false, gapBefore: 5 });
  }
  return lines;
}
