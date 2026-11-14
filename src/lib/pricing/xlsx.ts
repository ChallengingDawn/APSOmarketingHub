// PRICING'S EXCEL FILES, IN THE BROWSER - written and read without SheetJS.
//
// The PricingHub dashboard used SheetJS ("xlsx" 0.18.5 from npm), which the hub does not take in: that version is the
// last on npm and carries known flaws in reading files (prototype pollution, a ReDoS), and the Repricing studio and the
// competitor imports read files people choose. Here:
//   - writing goes through the hub's own .xlsx writer (src/lib/xlsxBrowser.ts), the Datatracker's;
//   - reading is a small reader of what the pages need - the sheet names, and a sheet's cells as rows of raw values
//     (SheetJS's sheet_to_json with header: 1, raw: true, defval: null). Text, numbers, booleans; no formulas are
//     evaluated (a formula cell gives the value Excel saved with it), no dates are converted.

import { xlsxBlob } from "@/lib/xlsxBrowser";
import type { Cell, Column, Group, Sheet } from "@/lib/xlsxParts";

export type { Cell, Column, Group, Sheet };

/** Write the workbook and hand it to the browser as a download. */
export async function downloadXlsx(filename: string, sheets: Sheet[]): Promise<void> {
  const url = URL.createObjectURL(await xlsxBlob(sheets));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** A sheet from rows, the first of them the header - the shape SheetJS's aoa_to_sheet took. */
export function aoaSheet(
  name: string,
  aoa: Cell[][],
  opts: { widths?: (number | undefined)[]; formats?: (Column["format"] | undefined)[]; table?: boolean } = {},
): Sheet {
  const [head = [], ...rows] = aoa;
  return {
    name: sheetName(name),
    columns: head.map((h, i) => ({ header: String(h ?? ""), width: opts.widths?.[i], format: opts.formats?.[i] })),
    rows,
    table: opts.table,
  };
}

/** Excel's rule for a sheet's name: at most 31 characters, none of : \ / ? * [ ]. */
export function sheetName(s: string): string {
  return (s.replace(/[:\\/?*[\]]/g, " ").trim() || "Sheet").slice(0, 31);
}

/* ── reading ─────────────────────────────────────────────────────────── */

export type Workbook = {
  sheetNames: string[];
  /** A sheet's cells as rows (every row as wide as the widest), blank cells null. */
  rows: (name: string) => Promise<unknown[][]>;
};

type Entry = { method: number; size: number; offset: number };

const u16 = (b: DataView, o: number) => b.getUint16(o, true);
const u32 = (b: DataView, o: number) => b.getUint32(o, true);

/** The zip's directory: each file's name, how it is packed and where its data starts. */
function directory(buf: ArrayBuffer): Map<string, Entry> {
  const v = new DataView(buf);
  let end = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 0xffff); i--) {
    if (u32(v, i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("This is not an Excel file (.xlsx).");
  const count = u16(v, end + 10);
  let p = u32(v, end + 16);
  const dec = new TextDecoder();
  const out = new Map<string, Entry>();
  for (let n = 0; n < count; n++) {
    if (u32(v, p) !== 0x02014b50) throw new Error("The Excel file is damaged.");
    const method = u16(v, p + 10), size = u32(v, p + 20);
    const nameLen = u16(v, p + 28), extra = u16(v, p + 30), comment = u16(v, p + 32);
    const local = u32(v, p + 42);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    const data = local + 30 + u16(v, local + 26) + u16(v, local + 28);
    out.set(name, { method, size, offset: data });
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

async function text(buf: ArrayBuffer, dir: Map<string, Entry>, name: string): Promise<string | null> {
  const e = dir.get(name);
  if (!e) return null;
  const raw = new Uint8Array(buf, e.offset, e.size);
  if (e.method === 0) return new TextDecoder().decode(raw);
  if (e.method !== 8) throw new Error("The Excel file is packed in a way this page cannot read.");
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");

/** "BC12" -> column 54 (0-based), or -1. */
function colOf(ref: string): number {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return -1;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Every <t> under an element, joined - a rich-text string is several runs. */
const runs = (el: Element) => Array.from(el.getElementsByTagName("t")).map((t) => t.textContent ?? "").join("");

/**
 * A file the person chose - an .xlsx, or a .csv (one sheet, named after the file; comma or semicolon, quotes, numbers
 * read as numbers). An old binary .xls is refused with a sentence: Excel saves it as .xlsx.
 */
export async function readTable(file: File): Promise<Workbook> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xls")) throw new Error("This is an old Excel file (.xls) - open it in Excel and save it as .xlsx.");
  if (!lower.endsWith(".csv")) return readXlsx(await file.arrayBuffer());
  const rows = parseCsv(await file.text());
  return { sheetNames: [file.name], rows: async () => rows };
}

function parseCsv(src: string): unknown[][] {
  const text = src.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const out: unknown[][] = [];
  let row: unknown[] = [], cell = "", quoted = false, wasQuoted = false;
  const push = () => {
    const s = cell.trim();
    const n = !wasQuoted && s !== "" && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s === "" ? null : cell;
    row.push(n); cell = ""; wasQuoted = false;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') { quoted = true; wasQuoted = true; }
    else if (ch === sep) push();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      push(); out.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { push(); out.push(row); }
  return out;
}

/** Open an .xlsx the person chose: its sheet names at once, a sheet's rows when asked for. */
export async function readXlsx(buf: ArrayBuffer): Promise<Workbook> {
  const dir = directory(buf);
  const wbXml = await text(buf, dir, "xl/workbook.xml");
  if (!wbXml) throw new Error("This is not an Excel file (.xlsx).");
  const relsXml = (await text(buf, dir, "xl/_rels/workbook.xml.rels")) ?? "";
  const targets = new Map<string, string>();
  for (const r of Array.from(xml(relsXml).getElementsByTagName("Relationship"))) {
    const t = r.getAttribute("Target") ?? "";
    targets.set(r.getAttribute("Id") ?? "", t.startsWith("/") ? t.slice(1) : `xl/${t}`);
  }
  const sheets = Array.from(xml(wbXml).getElementsByTagName("sheet")).map((s) => ({
    name: s.getAttribute("name") ?? "",
    path: targets.get(s.getAttribute("r:id") ?? "") ?? "",
  }));

  let shared: string[] | null = null;
  const sharedStrings = async () => {
    if (shared) return shared;
    const s = await text(buf, dir, "xl/sharedStrings.xml");
    shared = s ? Array.from(xml(s).getElementsByTagName("si")).map(runs) : [];
    return shared;
  };

  return {
    sheetNames: sheets.map((s) => s.name),
    rows: async (name) => {
      const sheet = sheets.find((s) => s.name === name);
      const body = sheet ? await text(buf, dir, sheet.path) : null;
      if (!body) return [];
      const strings = await sharedStrings();
      const out: unknown[][] = [];
      let width = 0;
      let next = 0;
      for (const row of Array.from(xml(body).getElementsByTagName("row"))) {
        const r = Number(row.getAttribute("r") ?? next + 1) - 1;
        next = r + 1;
        const cells: unknown[] = [];
        let c = 0;
        for (const cell of Array.from(row.getElementsByTagName("c"))) {
          const at = colOf(cell.getAttribute("r") ?? "");
          c = at >= 0 ? at : c;
          const type = cell.getAttribute("t");
          const v = cell.getElementsByTagName("v")[0]?.textContent ?? null;
          let value: unknown = null;
          if (type === "s") value = v == null ? null : strings[Number(v)] ?? null;
          else if (type === "inlineStr") value = runs(cell);
          else if (type === "b") value = v == null ? null : v === "1";
          else if (type === "str" || type === "e") value = v;
          else if (v != null && v !== "") value = Number(v);
          cells[c] = value;
          c++;
        }
        out[r] = cells;
        width = Math.max(width, cells.length);
      }
      // dense, as SheetJS gave it: blank rows and cells are null
      return Array.from({ length: out.length }, (_, i) => Array.from({ length: width }, (_, j) => out[i]?.[j] ?? null));
    },
  };
}
