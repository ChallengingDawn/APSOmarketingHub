// THE FILE STEPS' RULES, with no HubSpot, no SFTP and no database in them - ported line
// for line from the Compass connector (service/sftp_pull.py, magento_ingest.py,
// customer_load.py, article_load.py, 08.10.2026) so the hub reads every file and decides
// every record the same way. tests/connectors-files.test.ts holds them to it; the I/O is
// in ./files.ts and ../sftp.ts. Where this file differs from the connector on purpose,
// the comment says FIX.

import { createHash } from "node:crypto";
import { SaxesParser, type SaxesTagNS } from "saxes";
import { pyRound } from "../../segmentation/engine";

/* ── Python's string primitives ────────────────────────────────────────── */

// str.isspace(): JavaScript's trim() also strips U+FEFF and keeps \x1c-\x1f and \x85.
const WS = "\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const STRIP = new RegExp(`^[${WS}]+|[${WS}]+$`, "g");
const WS_RUN = new RegExp(`[${WS}]+`);

/** str.strip() */
export const pyStrip = (s: string): string => s.replace(STRIP, "");
/** str.split() with no separator: runs of whitespace, no empty parts. */
export const pySplitWs = (s: string): string[] => s.split(WS_RUN).filter(Boolean);
const LINE_BREAK = "\\r\\n|[\\n\\r\\v\\f\\x1c\\x1d\\x1e\\x85\\u2028\\u2029]";
/** str.splitlines() */
export function pySplitlines(s: string): string[] {
  if (!s) return [];
  const parts = s.split(new RegExp(LINE_BREAK));
  if (new RegExp(`(?:${LINE_BREAK})$`).test(s)) parts.pop();
  return parts;
}
/** int(str) for base 10: surrounding whitespace, a sign, digits with single underscores. */
export function pyInt(s: string): number {
  if (!/^\s*[+-]?\d+(?:_\d+)*\s*$/.test(s)) throw new Error(`invalid literal for int() with base 10: '${s}'`);
  return Number(s.replace(/[\s_]/g, ""));
}
/**
 * A string kept for the whole run, copied off the chunk it was cut from: V8 keeps a
 * substring of 13+ characters as a view of its parent, and the parent is a 1 MB read chunk.
 */
export const own = (s: string): string => (s.length < 13 ? s : Buffer.from(s, "utf8").toString("utf8"));

/** str.zfill(width) */
export function zfill(s: string, width: number): string {
  if (s.length >= width) return s;
  const pad = "0".repeat(width - s.length);
  return s[0] === "+" || s[0] === "-" ? s[0] + pad + s.slice(1) : pad + s;
}

/* ── SFTP: file names, the key, the host key ───────────────────────────── */

/**
 * sftp_pull._normalize: the loaders key on exact file names, the BI names drift.
 * FIX: a workbook keeps its own extension. The connector named an .xlsb or .xls
 * "revenue_profit_center.xlsx", a file that then cannot be opened as one.
 */
export function normalizeName(name: string): string {
  const low = name.toLowerCase();
  if (low.endsWith(".xml")) return "export.xml";
  if (low.startsWith("revenue with profit cent")) {
    // BI ships TWO things under this name: the CSV rollup revenue_load reads, and the
    // Excel workbook with the four pivots - never one onto the other's name.
    for (const ext of [".xlsx", ".xlsb", ".xls"]) if (low.endsWith(ext)) return `revenue_profit_center${ext}`;
    return "revenue_oi_rollup.csv";
  }
  if (low.startsWith("revenue_oi")) return "revenue_oi_rollup.csv";
  return name;
}

export type ManifestSig = [number, number];
export type Manifest = Record<string, ManifestSig>;
export type RemoteEntry = { name: string; size: number; mtime: number; type: string };
export type PlannedFile = { remote: string; as: string; size: number; mtime: number };

/**
 * What a pull downloads: every file whose [size, mtime] differs from the manifest.
 * FIX: every folder is skipped - the connector skipped only folders listed with size 0,
 * and a folder listed as 4096 bytes would have been "downloaded" and failed the pull.
 */
export function planPull(entries: RemoteEntry[], manifest: Manifest): { todo: PlannedFile[]; skipped: number; folders: number } {
  const todo: PlannedFile[] = [];
  let skipped = 0, folders = 0;
  for (const e of entries) {
    if (e.type === "d") { folders += 1; continue; }
    const m = manifest[e.name];
    if (Array.isArray(m) && m[0] === e.size && m[1] === e.mtime) { skipped += 1; continue; }
    todo.push({ remote: e.name, as: normalizeName(e.name), size: e.size, mtime: e.mtime });
  }
  return { todo, skipped, folders };
}

/** round(size / 1048576, 1) */
export const megabytes = (size: number): number => pyRound((size || 0) / 1048576, 1);

export const PPK_MESSAGE = "SFTP_KEY is the .ppk - paste the PuTTYgen 'Conversions -> Export OpenSSH key' file instead";

/**
 * The key text from SFTP_KEY, as sftp_pull._load_key prepares it before parsing:
 * literal "\n" expanded, a key pasted on one line (Railway) rebuilt into its lines,
 * a PuTTY .ppk refused. Never returns or logs anything but the key itself.
 */
export function keyText(raw: string): { ok: true; text: string } | { ok: false; error: string } {
  let k = pyStrip(raw.replaceAll("\\n", "\n"));
  if (!k) return { ok: false, error: "SFTP_KEY not configured" };
  if (k.startsWith("PuTTY-User-Key-File")) return { ok: false, error: PPK_MESSAGE };
  if (k.includes("PRIVATE KEY") && pySplitlines(k).length <= 2) {
    const m = /^(-----BEGIN [A-Z ]+-----)([\s\S]*)(-----END [A-Z ]+-----)$/.exec(k);
    if (m) k = `${m[1]}\n${pyStrip(m[2]).replaceAll(" ", "\n")}\n${m[3]}`;
  }
  return { ok: true, text: k };
}

/** sftp_pull.key_diag: the key's FORMAT only. Unlike the connector, never a character of the key body. */
export function keyInfo(raw: string, passphraseSet: boolean): Record<string, unknown> {
  const k = pyStrip(raw.replaceAll("\\n", "\n"));
  if (!k) return { set: false };
  const lines = pySplitlines(k);
  const first = (lines[0] ?? "").slice(0, 40);
  const kind = first.startsWith("PuTTY-User-Key-File") ? "ppk (WRONG - need PuTTYgen 'Export OpenSSH key')"
    : first.includes("OPENSSH PRIVATE KEY") ? "openssh"
    : first.includes("PRIVATE KEY") ? "pem"
    : "unrecognized";
  const header = /^-----BEGIN [A-Z ]+-----/.exec(first)?.[0] ?? (first.startsWith("PuTTY-User-Key-File") ? first.split(":")[0] : "");
  return { set: true, kind, first_line: header, lines: lines.length, passphrase_set: passphraseSet };
}

/** The connector's pin of b2b.angst-pfister.com, the default when SFTP_FINGERPRINT is not set. */
export const DEFAULT_PIN = "CvOaWGwfikKQdd/lkpSkdbaWwdcqTGQOuMhsbCs+Czk";

/** OpenSSH's SHA256 fingerprint of a host key blob, without the "=" padding. */
export const fingerprintOf = (hostKey: Uint8Array): string => createHash("sha256").update(hostKey).digest("base64").replace(/=+$/, "");

/** The pin from SFTP_FINGERPRINT: "SHA256:" and "=" padding dropped; blank means the default pin, never "any key". */
export function pinOf(env: string | undefined): string {
  const v = (env ?? "").trim();
  return (v || DEFAULT_PIN).replaceAll("SHA256:", "").replace(/=+$/, "");
}

/** The host key is the pinned one. An empty pin matches nothing. */
export const hostKeyOk = (hostKey: Uint8Array, pin: string): boolean => !!pin && fingerprintOf(hostKey) === pin;

/* ── CSV exactly as Python's csv.reader reads it ───────────────────────── */

const SR = 0, SF = 1, IF = 2, IQ = 3, QQ = 4, EC = 5;

/**
 * csv.reader(open(path, encoding=..., newline=None), delimiter=";") as a stream: the
 * same state machine as CPython's _csv.c (quote char '"', doubled quotes, not strict),
 * after the universal-newline translation of the text file. A quote inside an unquoted
 * field is a character; text after a closing quote joins the field; a blank line is [].
 * csv-parse would stop the whole file at the first such line.
 */
export class PyCsvReader {
  private state = SR;
  private fields: string[] = [];
  private field = "";
  private rest = "";
  private cr = false;
  constructor(private readonly delim = ";") {}

  /** Feed decoded text; finished records are appended to `out`. */
  push(text: string, out: string[][]): void {
    // a "\r\n" split across two chunks is one newline (an empty chunk carries the "\r" on)
    if (this.cr && text) { if (text[0] === "\n") text = text.slice(1); this.cr = false; }
    if (!text) return;
    this.cr = text.endsWith("\r");
    if (text.includes("\r")) text = text.replace(/\r\n?/g, "\n");
    const buf = this.rest + text;
    let start = 0;
    for (let nl = buf.indexOf("\n"); nl >= 0; nl = buf.indexOf("\n", start)) {
      this.line(buf.slice(start, nl + 1), out);
      start = nl + 1;
    }
    this.rest = buf.slice(start);
  }

  /** End of input: the last line without its newline, and a quoted field left open. */
  end(out: string[][]): void {
    if (this.rest) { this.line(this.rest, out); this.rest = ""; }
    if (this.state === IQ || this.field) {
      this.fields.push(this.field);
      out.push(this.fields);
      this.fields = []; this.field = ""; this.state = SR;
    }
  }

  private line(l: string, out: string[][]): void {
    if (this.state === SR && !l.includes('"')) {
      const body = l.endsWith("\n") ? l.slice(0, -1) : l;
      out.push(body === "" ? [] : body.split(this.delim));
      return;
    }
    for (let i = 0; i < l.length; i++) this.ch(l[i]);
    this.ch(null);
    if (this.state === SR) { out.push(this.fields); this.fields = []; }
  }

  private save(): void { this.fields.push(this.field); this.field = ""; }

  private ch(c: string | null): void {
    const eol = c === null || c === "\n" || c === "\r";
    switch (this.state) {
      case SR:
        if (c === null) return;
        if (c === "\n" || c === "\r") { this.state = EC; return; }
        this.state = SF;
      // falls through
      case SF:
        if (eol) { this.save(); this.state = c === null ? SR : EC; }
        else if (c === '"') this.state = IQ;
        else if (c === this.delim) this.save();
        else { this.field += c; this.state = IF; }
        return;
      case IF:
        if (eol) { this.save(); this.state = c === null ? SR : EC; }
        else if (c === this.delim) { this.save(); this.state = SF; }
        else this.field += c;
        return;
      case IQ:
        if (c === null) return;
        if (c === '"') this.state = QQ;
        else this.field += c;
        return;
      case QQ:
        if (c === '"') { this.field += c; this.state = IQ; }
        else if (c === this.delim) { this.save(); this.state = SF; }
        else if (eol) { this.save(); this.state = c === null ? SR : EC; }
        else { this.field += c; this.state = IF; }
        return;
      case EC:
        if (c === null) this.state = SR;
        else if (c !== "\n" && c !== "\r") throw new Error("new-line character seen in unquoted field");
        return;
    }
  }
}

/** Every record of a CSV text, for tests and small files. */
export function pyCsvRows(text: string, delim = ";"): string[][] {
  const r = new PyCsvReader(delim);
  const out: string[][] = [];
  r.push(text, out);
  r.end(out);
  return out;
}

/* ── the Magento order-grid export (SpreadsheetML 2003) ────────────────── */

export const SS = "urn:schemas-microsoft-com:office:spreadsheet";
export type ExportHit = { apo: string; apc: string; email: string; comp: string };
export type MagentoExport = { orders: Map<string, ExportHit>; columns: Set<string>; rows: number };

/** magento_ingest.parse_export's header: by NAME - the grid's column order changes between exports. */
export function headerIndex(hdr: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  hdr.forEach((h, i) => {
    const hl = pyStrip(h ?? "").toLowerCase();
    if (hl === "id") idx.inc = i;
    else if (hl === "status") idx.status = i;
    else if (hl === "a+p order number") idx.apo = i;
    else if (hl === "a+p customer number") idx.apc = i;
    else if (hl.includes("email")) { if (!("email" in idx)) idx.email = i; }
    else if (hl === "company" || hl === "customer company") { if (!("comp" in idx)) idx.comp = i; }
  });
  return idx;
}

type CellCtx = { depth: number; value: string | null; dataSeen: boolean; data: { depth: number; text: string; on: boolean } | null };
type RowCtx = { depth: number; cells: string[]; cell: CellCtx | null };

/**
 * Streams the export with saxes the way ElementTree.iterparse reads it: every ss:Row,
 * its direct ss:Cell children, ss:Index gaps filled with "", a cell's value the text of
 * its first ss:Data before any child element. The first row is the header; a data row
 * counts when it has an ID and an A+P order number and its Status is Transferred.
 */
export class MagentoExportParser {
  private readonly sax = new SaxesParser({ xmlns: true, position: false });
  private depth = 0;
  private readonly open: RowCtx[] = [];
  private hdr: string[] | null = null;
  private idx: Record<string, number> = {};
  readonly orders = new Map<string, ExportHit>();
  rows = 0;

  constructor() {
    this.sax.on("opentag", (t) => this.onOpen(t as SaxesTagNS));
    this.sax.on("closetag", (t) => this.onClose(t as SaxesTagNS));
    this.sax.on("text", (s) => this.onText(s));
    this.sax.on("cdata", (s) => this.onText(s));
  }

  write(chunk: string): void { this.sax.write(chunk); }

  close(): MagentoExport {
    this.sax.close();
    return { orders: this.orders, columns: new Set(Object.keys(this.idx)), rows: this.rows };
  }

  private onOpen(t: SaxesTagNS): void {
    const row = this.open[this.open.length - 1];
    const data = row?.cell?.data;
    if (data?.on) data.on = false; // ElementTree's .text stops at the first child element
    const depth = ++this.depth;
    if (t.uri === SS && t.local === "Row") { this.open.push({ depth, cells: [], cell: null }); return; }
    if (!row) return;
    if (t.uri === SS && t.local === "Cell" && depth === row.depth + 1) {
      const si = Object.values(t.attributes).find((a) => a.uri === SS && a.local === "Index")?.value;
      if (si) { const n = pyInt(si); while (row.cells.length < n - 1) row.cells.push(""); }
      row.cell = { depth, value: null, dataSeen: false, data: null };
      return;
    }
    if (t.uri === SS && t.local === "Data" && row.cell && depth === row.cell.depth + 1 && !row.cell.dataSeen) {
      row.cell.dataSeen = true;
      row.cell.data = { depth, text: "", on: true };
    }
  }

  private onText(s: string): void {
    const data = this.open[this.open.length - 1]?.cell?.data;
    if (data?.on) data.text += s;
  }

  private onClose(t: SaxesTagNS): void {
    const depth = this.depth--;
    const row = this.open[this.open.length - 1];
    if (!row) return;
    const cell = row.cell;
    if (cell?.data && depth === cell.data.depth && t.uri === SS && t.local === "Data") {
      cell.value = cell.data.text;
      cell.data.on = false;
    } else if (cell && depth === cell.depth) {
      row.cells.push(cell.value ?? "");
      row.cell = null;
    } else if (depth === row.depth) {
      this.open.pop();
      this.onRow(row.cells);
    }
  }

  private onRow(cells: string[]): void {
    if (this.hdr === null) { this.hdr = cells; this.idx = headerIndex(cells); return; }
    this.rows += 1;
    const g = (k: string): string => {
      const i = this.idx[k];
      return i !== undefined && i < cells.length && cells[i] ? pyStrip(cells[i]) : "";
    };
    const inc = g("inc"), status = g("status"), apo = g("apo");
    if (inc && apo && status.toLowerCase() === "transferred") this.orders.set(own(inc), { apo: own(apo), apc: own(g("apc")), email: own(g("email")), comp: own(g("comp")) });
  }
}

/** The whole export from one string - tests and small files. */
export function parseMagentoExport(xml: string): MagentoExport {
  const p = new MagentoExportParser();
  p.write(xml);
  return p.close();
}

/** The order's new name: "A26.123456.000 | Company", the trailing " |" dropped when there is no company. */
export const stampName = (apo: string, comp: string, customerName: string | null | undefined): string =>
  `${apo} | ${comp || pyStrip(customerName ?? "")}`.replace(/[ |]+$/, "");

/** magento_ingest.norm */
export const normAlnum = (s: string | null | undefined): string => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The email domain proves the true company: its first six letters are in the company's
 * name, or the name's first six in the domain. Only then is the contact moved.
 */
export function domainProves(email: string, trueName: string | null | undefined): boolean {
  const dom = email.includes("@") ? normAlnum(email.split("@").pop()!.split(".")[0]) : "";
  const n = normAlnum(trueName);
  return !!dom && !!n && (n.includes(dom.slice(0, 6)) || dom.includes(n.slice(0, 6)));
}

/* ── sales agent from dim_customer ─────────────────────────────────────── */

/** Values in the SA column that are not a person. */
export const AGENT_JUNK = new Set([".", "unknown", "not assigned", "sales-support", "sales-supporrt", ""]);

/** customer_load._toks as a comparable key: the set of a name's words, "-" read as a space. */
export const nameTokens = (s: string | null | undefined): string =>
  [...new Set(pySplitWs((s ?? "").toLowerCase().replaceAll("-", " ")))].sort().join(" ");

/** The dropdown's options by their name tokens ("Cagnoni Claudia" finds "Claudia Cagnoni"). */
export function agentIndex(options: string[]): Map<string, string[]> {
  const by = new Map<string, string[]>();
  for (const o of options) {
    const k = nameTokens(o);
    const list = by.get(k);
    if (list) list.push(o); else by.set(k, [o]);
  }
  return by;
}

/**
 * The existing option an SA value names; null when none does - a name is never invented.
 * Two options with the same words (the connector picked one at random, by set order):
 * the one spelled like the value, else the first in the dropdown.
 */
export function agentOption(sa: string, index: Map<string, string[]>): string | null {
  const c = index.get(nameTokens(sa));
  if (!c?.length) return null;
  return c.find((o) => o.toLowerCase() === sa.toLowerCase()) ?? c[0];
}

export type AgentSource = { sa: string; sae: string | null };

/**
 * The columns of dim_customer the step reads, by header name. FIX: without an SAE
 * column the SAE is null - the connector read the SA column twice and would have
 * written the sales agent's name into sae_performis.
 */
export function agentColumns(header: string[]): { cnu: number; sa: number; sae: number | null } | null {
  const i = new Map<string, number>();
  header.forEach((h, k) => i.set(h, k));
  if (!i.has("SA") || !i.has("CustomerNumberUnique")) return null;
  return { cnu: i.get("CustomerNumberUnique")!, sa: i.get("SA")!, sae: i.has("SAE") ? i.get("SAE")! : null };
}

/** One data row -> [key, source], or null when the row is too short or has no key. */
export function agentRow(r: string[], c: { cnu: number; sa: number; sae: number | null }): [string, AgentSource] | null {
  if (r.length <= Math.max(c.sa, c.sae ?? 0, c.cnu)) return null;
  const un = pyStrip(r[c.cnu]);
  if (!un) return null;
  return [own(un), { sa: own(pyStrip(r[c.sa])), sae: c.sae === null ? null : own(pyStrip(r[c.sae])) }];
}

export type AgentDecision = { props: Record<string, string>; junk: boolean; unknown: string | null };

/** What one company gets: the canonical option when its words differ, the SAE when it differs. Never a clear. */
export function agentDecision(src: AgentSource, current: { sa?: string | null; sae?: string | null }, index: Map<string, string[]>): AgentDecision {
  const props: Record<string, string> = {};
  let junk = false, unknown: string | null = null;
  if (AGENT_JUNK.has(src.sa.toLowerCase())) junk = true;
  else {
    const canon = agentOption(src.sa, index);
    if (canon === null) unknown = src.sa;
    else if (nameTokens(current.sa) !== nameTokens(canon)) props.sa__sales_agent = canon;
  }
  if (src.sae && pyStrip(current.sae ?? "") !== src.sae) props.sae_performis = src.sae;
  return { props, junk, unknown };
}

/** The ten most frequent unknown names, ties in the order first seen. */
export function topUnknown(unknown: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...unknown].sort((a, b) => b[1] - a[1]).slice(0, 10));
}

/* ── the article master from dim_article ───────────────────────────────── */

export const PP_OBJECT = "2-200042439";

export const STR_MAP: Record<string, string> = {
  ArticleText: "article_description", Material: "material", Colour: "colour", Hardness: "hardness",
  Conformity: "conformities", MainGroupNumber: "main_group_number", MainGroupName: "main_group_description",
  ProductNr: "product_number", ProductName: "product_description", SubGroupNr: "sub_group_number",
  SubGroupName: "sub_group_description", CompoundDesignationAP: "ap_compound_designation",
  CompoundDesignationSupplier: "supplier_compound_designation", CustomTarifNumber: "tarifs_number",
  AssortmentCluster: "assortment_description",
  // assortment_number (AssortmentClusterID) left out: the column arrives empty
  ArticleType: "compass_article_type", ProfitCenterNew: "compass_profit_center",
  ReplenishmentDays: "replenishment_days",
};
export const ENUM_MAP: Record<string, string> = {
  CountryOfOrigin: "country_of_origin", SalesUnit: "sales_unit",
  ConsumptionDriven: "consumption_driven", ProfitCenterNew: "profit_center", ArticleType: "article_type",
};
const XLAT = new Map([["profit_center\u0000Unknown", "UNKNOWN"]]);
const INACT = new Map([["J", "inactive"], ["", "active"], ["U", "unknown"]]);

/** An enum value as it is written: ("profit_center", "Unknown") -> "UNKNOWN". */
export const enumValue = (prop: string, v: string): string => XLAT.get(`${prop}\u0000${v}`) ?? v;

/** The columns a best row keeps. */
export const ARTICLE_COLS = [...new Set([...Object.keys(STR_MAP), ...Object.keys(ENUM_MAP), "ArticleNumber", "ArticleIsInactive", "dss_update_time"])];

/** P&P properties the step writes. */
export const PP_PROPS = [...new Set([...Object.values(STR_MAP), ...Object.values(ENUM_MAP), "compass_article_inactive"])];

const TS_RE = /^(3[0-1]|[1-2]\d|0[1-9]|[1-9]| [1-9])\.(1[0-2]|0[1-9]|[1-9])\.(\d\d\d\d)\s+(2[0-3]|[0-1]\d|\d):([0-5]\d|\d):(6[0-1]|[0-5]\d|\d)/;

/**
 * article_load._to_ms: "dd.mm.yyyy HH:MM:SS" -> epoch ms, null when it is not one -
 * strptime's own pattern and checks. Read as UTC, as the connector does on Railway.
 */
export function toMs(s: string | null | undefined): number | null {
  const t = pyStrip(s ?? "");
  const m = TS_RE.exec(t);
  if (!m || m[0].length !== t.length) return null;
  const [d, mo, y, h, mi, se] = m.slice(1).map((x) => Number(x.trim()));
  if (y < 1 || se > 59) return null;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  if (d > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]) return null;
  const dt = new Date(0);
  dt.setUTCFullYear(y, mo - 1, d);
  dt.setUTCHours(h, mi, se, 0);
  return dt.getTime();
}

export type ArticleRecord = Record<string, string>;

/** article_load.payload_for: a best row -> the P&P properties. An empty source value is left out, never cleared. */
export function payloadFor(d: ArticleRecord): Record<string, string> {
  const p: Record<string, string> = {};
  for (const [col, prop] of Object.entries(STR_MAP)) {
    const v = pyStrip(d[col] ?? "");
    if (v) p[prop] = v;
  }
  for (const [col, prop] of Object.entries(ENUM_MAP)) {
    const v = pyStrip(d[col] ?? "");
    if (v) p[prop] = enumValue(prop, v);
  }
  p.compass_article_inactive = INACT.get(d.ArticleIsInactive ?? "") ?? "active";
  return p;
}

/** article_load._is_shop_standard: a ten-digit, active "Standard" article with a text. */
export function isShopStandard(d: ArticleRecord): boolean {
  const art = pyStrip(d.ArticleNumber ?? "");
  return /^[0-9]{10}$/.test(art) && pyStrip(d.ArticleType ?? "") === "Standard"
    && pyStrip(d.ArticleIsInactive ?? "") !== "J" && !!pyStrip(d.ArticleText ?? "");
}

const SEP = "\u0001";
const pack = (vals: string[]): string => (vals.some((v) => v.includes(SEP)) ? `\u0002${JSON.stringify(vals)}` : vals.join(SEP));
const unpack = (p: string): string[] => (p.startsWith("\u0002") ? (JSON.parse(p.slice(1)) as string[]) : p.split(SEP));

type Best = { act: boolean; upd: number; packed: string };

/**
 * The best dim_article row per article, streamed. "update" (article_load.run): the active
 * row wins, then the newest dss_update_time, the first on a tie. "create"
 * (create_missing): only shop-standard rows, the newest wins. `keep` limits what is held
 * in memory to the articles that can be used - the full file is ~300 MB.
 */
export class BestArticles {
  readonly best = new Map<string, Best>();
  readonly seen = new Set<string>();
  rows = 0;
  private readonly ix: Map<string, number>;
  private readonly iArt: number;
  private readonly iDss: number;
  private readonly iInact: number;

  constructor(header: string[], private readonly mode: "update" | "create", private readonly keep?: (art: string) => boolean) {
    this.ix = new Map();
    header.forEach((h, i) => this.ix.set(h, i));
    const need = mode === "update" ? ["ArticleNumber", "ArticleIsInactive", "dss_update_time"] : ["ArticleNumber", "dss_update_time"];
    const missing = need.filter((c) => !this.ix.has(c));
    if (missing.length) throw new Error(`dim_article without the ${missing.join(", ")} column${missing.length > 1 ? "s" : ""}`);
    this.iArt = this.ix.get("ArticleNumber")!;
    this.iDss = this.ix.get("dss_update_time")!;
    this.iInact = this.ix.get("ArticleIsInactive") ?? -1;
  }

  private record(row: string[]): ArticleRecord {
    const d: ArticleRecord = {};
    for (const c of ARTICLE_COLS) {
      const i = this.ix.get(c);
      if (i !== undefined && i < row.length) d[c] = pyStrip(row[i]);
    }
    return d;
  }

  add(row: string[]): void {
    this.rows += 1;
    if (row.length <= this.iDss) return;
    const art = own(this.iArt < row.length ? pyStrip(row[this.iArt]) : "");
    if (!art) return;
    if (this.mode === "update") {
      this.seen.add(art);
      if (this.keep && !this.keep(art)) return;
      const act = this.iInact < row.length && pyStrip(row[this.iInact]) === "";
      const upd = toMs(row[this.iDss]) ?? 0;
      const prev = this.best.get(art);
      if (prev && (prev.act > act || (prev.act === act && prev.upd >= upd))) return;
      const d = this.record(row);
      this.best.set(art, { act, upd, packed: pack(ARTICLE_COLS.map((c) => d[c] ?? "")) });
      return;
    }
    const d = this.record(row);
    if (!isShopStandard(d)) return;
    this.seen.add(art);
    if (this.keep && !this.keep(art)) return;
    const upd = toMs(d.dss_update_time ?? "") ?? 0;
    const prev = this.best.get(art);
    if (prev && prev.upd >= upd) return;
    this.best.set(art, { act: true, upd, packed: pack(ARTICLE_COLS.map((c) => d[c] ?? "")) });
  }

  /** The best row of an article as {column: value} (a column the row did not reach reads ""). */
  get(art: string): ArticleRecord | undefined {
    const b = this.best.get(art);
    if (!b) return undefined;
    const vals = unpack(b.packed);
    return Object.fromEntries(ARTICLE_COLS.map((c, i) => [c, vals[i]]));
  }

  /** The best row's activity and update time, as article_load keeps them in _act / _upd. */
  rank(art: string): { act: boolean; upd: number } | undefined {
    const b = this.best.get(art);
    return b && { act: b.act, upd: b.upd };
  }
}

/** The keys a P&P article_number is looked up by: as is, without leading zeros, padded to ten. */
export const articleKeys = (an: string): [string, string, string] => [an, an.replace(/^0+/, ""), zfill(an, 10)];

/** The best row a P&P record takes - the first of its keys the file has. */
export function matchArticle(an: string, has: (k: string) => boolean): string | null {
  for (const k of articleKeys(an)) if (k && has(k)) return k;
  return null;
}

/** json.dumps(p, sort_keys=True) for a flat {str: str} - the connector's cache key, byte for byte. */
export function pyJsonSorted(p: Record<string, string>): string {
  const q = (s: string): string => {
    let o = '"';
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 0x22) o += '\\"';
      else if (c === 0x5c) o += "\\\\";
      else if (c >= 0x20 && c <= 0x7e) o += s[i];
      else if (c === 0x0a) o += "\\n";
      else if (c === 0x0d) o += "\\r";
      else if (c === 0x09) o += "\\t";
      else if (c === 0x08) o += "\\b";
      else if (c === 0x0c) o += "\\f";
      else o += `\\u${c.toString(16).padStart(4, "0")}`;
    }
    return `${o}"`;
  };
  return `{${Object.keys(p).sort().map((k) => `${q(k)}: ${q(p[k])}`).join(", ")}}`;
}

/** The payload's fingerprint - equal to the connector's md5(json.dumps(p, sort_keys=True)). */
export const payloadHash = (p: Record<string, string>): string => createHash("md5").update(pyJsonSorted(p)).digest("hex");

/**
 * The payload without enum values the property does not offer: HubSpot rejects the whole
 * batch of 100 for one unknown option, and the hub may not add options (schema write).
 */
export function withKnownOptions(p: Record<string, string>, options: Map<string, Set<string>>): { payload: Record<string, string>; dropped: [string, string][] } {
  const payload: Record<string, string> = {};
  const dropped: [string, string][] = [];
  for (const [k, v] of Object.entries(p)) {
    const opts = options.get(k);
    if (opts && !opts.has(v)) dropped.push([k, v]);
    else payload[k] = v;
  }
  return { payload, dropped };
}

/** HubSpot's current value equals what would be written (strings compared trimmed). */
export const sameAsCurrent = (p: Record<string, string>, cur: Record<string, string | null | undefined>): boolean =>
  Object.entries(p).every(([k, v]) => pyStrip(cur[k] ?? "") === v);
