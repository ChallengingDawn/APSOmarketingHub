// THE FILES A PAGE GIVES - what the bar's Download makes of one version's hand-over (Content v10, 10.11.2026, SARCLA point
// 8: "Download neither"). Pure: relative imports only - the studio (src/app/projects/studio/kinds/page/downloads.ts) and the
// tests. The hand-over itself is the server's `paste` read (./shop.ts pasteOf): one HTML Code element for a new page or a
// CMS page, the fields its form takes, or - a product or category page, the theme's code - the list for the developers.

import type { PasteBlock } from "./model";

/** The `paste` read's answer (./shop.ts PasteOut - kept apart here: shop.ts reads the server's modules). */
export type PasteAnswer = { ok: true; blocks: PasteBlock[]; warnings: string[]; store: string } | { ok: false; error: string };

/** One file of a version, or why there is none. `say`: what the bar says beside the file. */
export type VersionFile = { name: string; text: string; type: string; say: string | null } | { name: null; say: string };

const slug = (v: string) => v.replace(/\//g, "-").toLowerCase();

/**
 * One version's file: its HTML for Magento, paste-ready - the form's fields (title, URL key, meta, its store views) ride
 * along as a comment on top, so one file holds what goes into Magento's page. `label`: the version as people say it
 * ("English · 9 store views"); `key`: its store view ("en-INT").
 */
export function versionFile(stem: string, key: string, label: string, paste: PasteAnswer): VersionFile {
  if (!paste.ok) return { name: null, say: `${key}: ${paste.error}` };
  const content = paste.blocks.find((b) => b.key === "content");
  const fields = paste.blocks.find((b) => b.key === "fields" || b.key === "seo");
  if (content) {
    const head = fields ? `<!-- ${label}\n${fields.code.replace(/--/g, "- -")}\n-->\n` : `<!-- ${label} -->\n`;
    return {
      name: `${stem}-${slug(key)}.html`, text: head + content.code, type: "text/html;charset=utf-8",
      say: paste.warnings.length ? `${key} saved - before it goes live: ${paste.warnings[0]}` : null,
    };
  }
  const spec = paste.blocks.find((b) => b.key === "spec");
  if (spec) return { name: `${stem}-${slug(key)}-for-developers.txt`, text: spec.code, type: "text/plain;charset=utf-8", say: `${key}: a product or category page is the theme's code - saved its list of changes for the developers.` };
  if (fields) return { name: `${stem}-${slug(key)}-search-fields.txt`, text: fields.code, type: "text/plain;charset=utf-8", say: `${key}: only its search engine fields change - saved them.` };
  return { name: null, say: `${key}: nothing to hand over yet.` };
}

/** The zip of every version: named after the page. */
export const everyVersionZip = (stem: string) => `${stem}-every-language.zip`;
