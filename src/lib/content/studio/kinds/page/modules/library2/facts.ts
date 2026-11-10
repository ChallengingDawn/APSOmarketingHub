// PAGE - THE LIBRARY, PART 2: a product's facts as its own page states them (Content v7, 10.11.2026). Pure:
// tests/studio-page-library2.test.ts.
//
// The "Technical summary" module (tech-specs) and the "Downloads" module (tool-downloads) fill from a product page of the
// shop: its sub-title line, its "Technische Zusammenfassung" table (#product-attribute-specs-table: th = what, the
// .show-more-content = its value) and its "Downloads" list (<li data-asset-id><a href>). Never a price, never stock, and
// never its approvals or certificates: those rows stay on the product's own page (they hold for the exact article and
// compound only) - SARCLA's rule for the library, "never invented facts, certificates".

const ent: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", reg: "®", deg: "°", plusmn: "±", times: "×", micro: "µ", ndash: "–", mdash: "—", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", egrave: "è", agrave: "à" };
/** Text of an HTML fragment: tags out, entities decoded, spaces collapsed. */
export function plain(html: string): string {
  return String(html ?? "").replace(/<br\s*\/?>/gi, ", ").replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ent[n] ?? ent[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ").replace(/\s+,/g, ",").replace(/,\s*$/, "").trim()
    // a value never breaks from its unit ("+150 °C", "70 ±5 Shore A")
    .replace(/(\d) (?=°C|°F|mm\b|bar\b|Shore\b)/g, "$1\u00a0");
}

/** Rows a module never shows: approvals and certificates, classification codes, prices, stock. */
const NEVER = /konformit|zulassung|zertifik|conformit|approv|certif|homolog|omologaz|zgodno|UNSPSC|eCl@ss|\bpreis|\bprice|\bprix|prezzo|\bcena\b|lagerbestand|\bstock\b|verfügbarkeit|availab/i;

/** The table's column names in the store view's language. */
const HEADS: Record<string, [string, string]> = {
  de: ["Merkmal", "Wert"], fr: ["Caractéristique", "Valeur"], it: ["Caratteristica", "Valore"], en: ["Property", "Value"], nl: ["Kenmerk", "Waarde"], pl: ["Cecha", "Wartość"],
};
export const factsHead = (store: string): [string, string] => HEADS[String(store).slice(0, 2).toLowerCase()] ?? HEADS.en;

export type ProductFacts = {
  /** the page's line under its title ("Zuverlässige EPDM-Dichtung für ...") */
  summary: string;
  /** its technical summary as table rows (what, value) - the first row names the columns */
  table: string[][];
  /** its downloads: the file's name and address on the shop */
  downloads: { name: string; url: string }[];
};

/** A product page's facts (the shop's own words; `head` = the table's column names in the store view's language). */
export function parseFacts(html: string, head: [string, string] = ["Merkmal", "Wert"]): ProductFacts {
  const s = String(html ?? "");
  const summary = plain(/class="product attribute page-title__sub-title"[^>]*>\s*<div class="value"[^>]*>([\s\S]*?)<\/div>/i.exec(s)?.[1] ?? "").slice(0, 240);
  const rows: string[][] = [];
  const tbl = /<table[^>]*id="product-attribute-specs-table"[^>]*>([\s\S]*?)<\/table>/i.exec(s)?.[1] ?? "";
  for (const m of tbl.matchAll(/<tr\b[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)) {
    const what = plain(m[1]).slice(0, 80);
    const inner = /class="show-more-content"[^>]*>([\s\S]*?)<\/div>/i.exec(m[2])?.[1] ?? m[2];
    const value = plain(inner).slice(0, 200);
    if (!what || !value || NEVER.test(what)) continue;
    rows.push([what, value]);
    if (rows.length >= 14) break;
  }
  const downloads: { name: string; url: string }[] = [];
  for (const m of s.matchAll(/<li\b[^>]*data-asset-id="\d+"[^>]*>\s*<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = plain(m[1]).replace(/ /g, "%20");
    const name = plain(m[2]).slice(0, 120);
    if (!/^https:\/\/(www|acc)\.apsoparts\.com\/media\/downloads\/[^\s"'<>]+$/i.test(url) || !name || NEVER.test(name)) continue;
    if (!downloads.some((d) => d.url === url)) downloads.push({ name, url });
    if (downloads.length >= 8) break;
  }
  return { summary, table: rows.length ? [[...head], ...rows] : [], downloads };
}
