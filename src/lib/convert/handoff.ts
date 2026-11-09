// APSOconvert > CONTENT - the texts of a page are written in Content Studio, not here (SARCLA 07.11.2026: "we should
// not cannibalise content creation; we should be able to previsualise the pages and then send as a project to
// content"). APSOconvert finds the problem, keeps the ideas a person approved and shows the page live with its
// version; "Send to Content" makes a Content Studio project of it - the same way AI answers sends a recommendation
// (src/lib/aeo/model.ts projectFor): a title, a brief well under the hub's 8 KB request body, the content type, and a
// marker line by which the preview finds the project again.
//
// Pure (no "@/" imports), so it is tested.

import { classify, type Env } from "./model";

/** Which Content Studio type a page's texts are written as: product copy for a product page, else edits to the page. */
export function contentTypeForPage(path: string): "product-page" | "page-refresh" {
  return classify(path).kind === "product" ? "product-page" : "page-refresh";
}

const LANGUAGE: Record<string, string> = { de: "German", fr: "French", it: "Italian", en: "English", nl: "Dutch", pl: "Polish", es: "Spanish" };
export function languageOf(path: string): string | null {
  const store = classify(path).store;
  return store ? LANGUAGE[store.slice(0, 2)] ?? null : null;
}

/** The line a project made from a page carries, so the preview finds it again - with the test, for a test's winner
 *  handed to Content to be published there (SARCLA 08.11.2026: "ship should not come from here, content publish should
 *  go to Content"); Content's page studio then lays exactly the tested change list over the page. */
export const pageMarker = (env: Env, path: string, testId?: string | null, versionId?: string | null) =>
  `[APSOconvert page ${env}:${path}${testId ? ` test:${testId}` : ""}${!testId && versionId ? ` v:${versionId}` : ""}]`;
const MARKER = /\[APSOconvert page (prod|acc):([^\]\s]+)(?: test:(\d+))?(?: v:(\d+))?\]/;
/** The page a project was made from, and - when the marker says - the test (a winner) or the version it was sent with. */
export function markerOf(brief: string | null): { env: Env; path: string; testId?: string; versionId?: string } | null {
  const m = MARKER.exec(brief ?? "");
  if (!m) return null;
  if (m[3]) return { env: m[1] as Env, path: m[2], testId: m[3] };
  return m[4] ? { env: m[1] as Env, path: m[2], versionId: m[4] } : { env: m[1] as Env, path: m[2] };
}

export type HandoffIdea = { title: string; why: string; change: string; expect: string };
export type HandoffInput = {
  env: Env; path: string; url: string; h1: string; title: string;
  numbers: { views?: number | null; rate?: number | null; typical?: number | null; companies?: number | null; lost?: number | null; topLoss?: string | null; reasons?: string[]; from?: string; to?: string } | null;
  ideas: HandoffIdea[];
  version: { rev: number; summary: string } | null;
  /** An optimization sent to a project with its versions (A, B...) - the first one is the marker's version. */
  versions?: { id: string; letter: string; rev: number; summary: string }[];
  previewPath: string;
  /** a test's winner, handed to Content to be published there */
  test?: { id: string; rateA: number | null; rateB: number | null; uplift: number | null; pB: number | null; visitors: number | null; days: number | null; decidedBy: string | null; decidedAt: string | null } | null;
};

const pct = (r: number | null | undefined) => (r === null || r === undefined ? "-" : `${(r * 100).toFixed(1)}%`);

export function projectForPage(x: HandoffInput): { title: string; brief: string; contentType: string } {
  const lang = languageOf(x.path);
  const name = (x.h1 || x.title || x.path).replace(/\s+/g, " ").trim();
  const n = x.numbers;
  const t = x.test ?? null;
  const signed = (v: number | null) => (v === null ? "-" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
  const lines = [
    t
      ? `A tested winner from APSOconvert (Website > AI testing & personalization), to publish from here: page test #${t.id} showed the version sells better than the page as it is. Look at it laid over the page, adjust it with the AI if needed - a change after the test is marked as not tested - and publish it once approved.`
      : `A shop page to improve, from APSOconvert (Website > AI testing & personalization): its numbers say visitors come and do not buy. The texts are written here; the page's layout and the test are done in APSOconvert.`,
    `Page: ${name}\n${x.url}${lang ? `\nWrite in ${lang} - the page's store view is ${classify(x.path).store}.` : ""}`,
    n ? `Numbers${n.from ? ` (${n.from} to ${n.to})` : ""}: ${n.views ?? "-"} views, cart rate ${pct(n.rate)} where similar pages make ${pct(n.typical)}${n.companies ? `; ${n.lost ?? 0} of ${n.companies} signed-in customers who opened it did not order${n.topLoss ? `, most stopped at "${n.topLoss}"` : ""}` : ""}.${n.reasons?.length ? `\n${n.reasons.map((r) => `- ${r}`).join("\n")}` : ""}` : null,
    x.ideas.length ? `Approved ideas - what the texts must do:\n${x.ideas.map((i, k) => `${k + 1}. ${i.title}\n   Change: ${i.change}${i.why ? `\n   Why: ${i.why}` : ""}${i.expect ? `\n   Should move: ${i.expect}` : ""}`).join("\n")}` : `No idea approved yet - start from the numbers and the page as it is.`,
    t ? `Winner of page test #${t.id}: ${pct(t.rateB)} of the visitors who got the version put something in the cart, against ${pct(t.rateA)} for the page as it is (uplift ${signed(t.uplift)}${t.pB !== null ? `, ${Math.round(t.pB * 100)}% sure it is better` : ""})${t.visitors ? `, over ${t.visitors} visitors` : ""}${t.days ? ` and ${t.days} days` : ""}${t.decidedBy ? `; decided by ${t.decidedBy}${t.decidedAt ? ` on ${t.decidedAt.slice(0, 10)}` : ""}` : ""}.` : null,
    x.versions?.length
      ? `${x.versions.length > 1 ? `Its ${x.versions.length} versions, to test against the page as it is` : "Its version"} (laid over the page in the studio):\n${x.versions.map((v) => `- Version ${v.letter} (revision ${v.rev}): ${v.summary}`).join("\n")}`
      : x.version ? `The page's new layout (version, revision ${x.version.rev}): ${x.version.summary}` : null,
    `See the page live, with its version beside the original: ${x.previewPath}`,
    `Use only what the page and the product data say: no invented price, stock, delivery time, certificate or approval.`,
    pageMarker(x.env, x.path),
  ].filter(Boolean) as string[];
  const marker = pageMarker(x.env, x.path, t?.id ?? null, x.versions?.[0]?.id ?? null);
  lines[lines.length - 1] = marker;
  let brief = lines.join("\n\n");
  if (brief.length > 6000) brief = `${brief.slice(0, 5900 - marker.length)}…\n\n${marker}`;
  return { title: `${t ? "Winner" : "Shop page"}: ${name}`.slice(0, 200), brief, contentType: contentTypeForPage(x.path) };
}
