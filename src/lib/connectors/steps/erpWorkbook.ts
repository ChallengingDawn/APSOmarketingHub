// THE ERP MORNING WORKBOOK, READ FROM DISK - revenue_profit_center.xlsx, streamed
// so a 10 MB export never sits in memory as a whole, and read cell for cell the way
// the connector's openpyxl (read-only, data_only) reads it. No HubSpot here:
// ./erpRevenue.ts writes what this reads, with the rules in ./erpRules.ts.
//
// Why not exceljs' streaming WorkbookReader: exceljs 4.4.0 (unzipper 0.10) loses
// the ZIP entries that follow a worksheet it parks in a temp file - a workbook
// whose sheets come before workbook.xml and the shared strings (openpyxl writes
// them so, Excel puts the strings last) then reads as "no FIGURES (3)" or with
// its strings gone; reproduced 08.10.2026, 10 entries seen as 5. It also cannot
// name sheets behind an absolute rels target, and turns a cached "#N/A" into NaN.
// So the ZIP is read here by its central directory (random access, Node's zlib)
// and the XML with saxes - one pass per sheet, nothing parked on disk.
//
// Before anything is read, the file is checked by what it IS, not by its name: the
// connector's normalisation renames whatever the BI export delivered to
// revenue_profit_center.xlsx, and an .xlsb or an old .xls must fail with a message
// someone can act on.

import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { basename, posix } from "node:path";
import { PassThrough, pipeline, type Readable } from "node:stream";
import { createInflateRaw } from "node:zlib";
import { SaxesParser } from "saxes";
import { Figures3, Figures4, PyFloat, SHEET_CUSTOMERS, SHEET_PROFIT_CENTRES, pyRound, type Cell, type Figures3Result, type Figures4Result } from "./erpRules";

export class WorkbookFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkbookFormatError";
  }
}

/* ── the ZIP, by its central directory ─────────────────────────────────── */

export type ZipEntry = { name: string; method: number; flags: number; compSize: number; size: number; offset: number };

/** The entries of a ZIP from its central directory - Node built-ins only, nothing inflated. */
export async function zipDirectory(file: string): Promise<ZipEntry[]> {
  const name = basename(file);
  let fh;
  try {
    fh = await open(file, "r");
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    throw new WorkbookFormatError(code === "ENOENT" ? `file not found: ${file}` : `${name}: cannot be opened (${code ?? (e as Error).message})`);
  }
  try {
    const size = (await fh.stat()).size;
    if (!size) throw new WorkbookFormatError(`${name}: the file is empty - the transfer did not complete`);
    const head = Buffer.alloc(Math.min(8, size));
    await fh.read(head, 0, head.length, 0);
    if (head.length === 8 && head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) {
      throw new WorkbookFormatError(`${name}: an OLE2 file - an old .xls, or a password-protected workbook - not an .xlsx. Export the report as .xlsx without a password.`);
    }
    if (head[0] !== 0x50 || head[1] !== 0x4b) {
      const peek = head.toString("latin1").replace(/[^\x20-\x7e]/g, ".");
      throw new WorkbookFormatError(`${name}: not an .xlsx (no ZIP signature; it starts "${peek}") - a CSV, an HTML error page or a broken transfer`);
    }
    const tailLen = Math.min(size, 22 + 0xffff + 20);
    const tail = Buffer.alloc(tailLen);
    await fh.read(tail, 0, tailLen, size - tailLen);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new WorkbookFormatError(`${name}: a truncated ZIP (no central directory) - the download did not complete`);
    let cdSize = tail.readUInt32LE(eocd + 12);
    let cdOff = tail.readUInt32LE(eocd + 16);
    if (cdSize === 0xffffffff || cdOff === 0xffffffff) {
      const loc = eocd - 20;
      if (loc >= 0 && tail.readUInt32LE(loc) === 0x07064b50) {
        const z = Buffer.alloc(56);
        await fh.read(z, 0, 56, Number(tail.readBigUInt64LE(loc + 8)));
        if (z.readUInt32LE(0) === 0x06064b50) {
          cdSize = Number(z.readBigUInt64LE(40));
          cdOff = Number(z.readBigUInt64LE(48));
        }
      }
    }
    if (cdOff + cdSize > size) throw new WorkbookFormatError(`${name}: a truncated ZIP - the download did not complete`);
    const cd = Buffer.alloc(cdSize);
    await fh.read(cd, 0, cdSize, cdOff);
    const out: ZipEntry[] = [];
    for (let p = 0; p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50;) {
      const flags = cd.readUInt16LE(p + 8);
      const nl = cd.readUInt16LE(p + 28), el = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32);
      let compSize = cd.readUInt32LE(p + 20), sz = cd.readUInt32LE(p + 24), offset = cd.readUInt32LE(p + 42);
      // ZIP64: the real sizes and offset sit in extra field 0x0001, in this order, only for those maxed out
      for (let x = p + 46 + nl; x + 4 <= p + 46 + nl + el;) {
        const id = cd.readUInt16LE(x), len = cd.readUInt16LE(x + 2);
        if (id === 0x0001) {
          let q = x + 4;
          if (sz === 0xffffffff) { sz = Number(cd.readBigUInt64LE(q)); q += 8; }
          if (compSize === 0xffffffff) { compSize = Number(cd.readBigUInt64LE(q)); q += 8; }
          if (offset === 0xffffffff) offset = Number(cd.readBigUInt64LE(q));
        }
        x += 4 + len;
      }
      out.push({ name: cd.toString(flags & 0x800 ? "utf8" : "latin1", p + 46, p + 46 + nl), method: cd.readUInt16LE(p + 10), flags, compSize, size: sz, offset });
      p += 46 + nl + el + cl;
    }
    return out;
  } finally {
    await fh.close();
  }
}

export async function zipEntryNames(file: string): Promise<string[]> {
  return (await zipDirectory(file)).map((e) => e.name);
}

/** Throws a WorkbookFormatError that says what the file really is, unless it is an .xlsx. Returns its entries. */
export async function assertXlsx(file: string): Promise<ZipEntry[]> {
  const name = basename(file);
  const entries = await zipDirectory(file);
  const has = new Set(entries.map((e) => e.name));
  if (has.has("xl/workbook.bin")) {
    throw new WorkbookFormatError(`${name}: a binary workbook (.xlsb) under an .xlsx name - the file normalisation renamed it. The BI export has to be saved as .xlsx (Excel Workbook); renaming does not convert it.`);
  }
  if (!has.has("[Content_Types].xml") || !entries.some((e) => /^xl\/.+\.xml$/.test(e.name))) {
    throw new WorkbookFormatError(`${name}: a ZIP but not an Excel workbook (holds ${entries.slice(0, 4).map((e) => e.name).join(", ") || "nothing"})`);
  }
  return entries;
}

/** One entry's bytes as UTF-8 text chunks, inflated on the fly. */
async function entryText(file: string, e: ZipEntry): Promise<Readable> {
  if (e.flags & 1) throw new WorkbookFormatError(`${basename(file)}: ${e.name} is encrypted`);
  if (e.method !== 0 && e.method !== 8) throw new WorkbookFormatError(`${basename(file)}: ${e.name} uses ZIP method ${e.method} - not supported`);
  const fh = await open(file, "r");
  const h = Buffer.alloc(30);
  try {
    await fh.read(h, 0, 30, e.offset);
  } finally {
    await fh.close();
  }
  if (h.readUInt32LE(0) !== 0x04034b50) throw new WorkbookFormatError(`${basename(file)}: ${e.name} - a damaged ZIP entry`);
  const start = e.offset + 30 + h.readUInt16LE(26) + h.readUInt16LE(28);
  let s: Readable;
  if (!e.compSize) {
    s = new PassThrough();
    (s as PassThrough).end();
  } else {
    const raw = createReadStream(file, { start, end: start + e.compSize - 1, highWaterMark: 256 * 1024 });
    s = e.method === 8 ? pipeline(raw, createInflateRaw(), () => {}) : raw;
  }
  s.setEncoding("utf8");
  return s;
}

type Handlers = {
  open(name: string, attrs: Record<string, string>): void;
  text(t: string): void;
  close(name: string): void;
};

const local = (n: string) => {
  const i = n.indexOf(":");
  return i < 0 ? n : n.slice(i + 1);
};

/** Stream one XML part through saxes; `between` runs between chunks (beats). */
async function parseXml(file: string, e: ZipEntry, h: Handlers, between?: () => Promise<void>): Promise<void> {
  const p = new SaxesParser({ xmlns: false, position: false });
  p.on("opentag", (t) => h.open(local(t.name), t.attributes as Record<string, string>));
  p.on("text", (t) => h.text(t));
  p.on("cdata", (t) => h.text(t));
  p.on("closetag", (t) => h.close(local(t.name)));
  try {
    for await (const chunk of await entryText(file, e)) {
      p.write(chunk as string);
      if (between) await between();
    }
    p.close();
  } catch (err) {
    if (err instanceof WorkbookFormatError) throw err;
    throw new WorkbookFormatError(`${basename(file)}: ${e.name} could not be read (${(err as Error).message.slice(0, 200)})`);
  }
}

/* ── the workbook: sheets, shared strings, date styles ─────────────────── */

const CT_WORKBOOK = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  "application/vnd.ms-excel.sheet.macroEnabled.main+xml",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml",
  "application/vnd.ms-excel.template.macroEnabled.main+xml",
  "application/vnd.ms-excel.addin.macroEnabled.main+xml",
]);
const CT_SST = "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml";

/** openpyxl's BUILTIN_FORMATS - only the ones a date test can match matter, the rest are listed for fidelity. */
const BUILTIN_FORMATS: Record<number, string> = {
  0: "General", 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 5: '"$"#,##0_);("$"#,##0)', 6: '"$"#,##0_);[Red]("$"#,##0)',
  7: '"$"#,##0.00_);("$"#,##0.00)', 8: '"$"#,##0.00_);[Red]("$"#,##0.00)', 9: "0%", 10: "0.00%", 11: "0.00E+00",
  12: "# ?/?", 13: "# ??/??", 14: "mm-dd-yy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 18: "h:mm AM/PM",
  19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss", 22: "m/d/yy h:mm", 37: "#,##0_);(#,##0)", 38: "#,##0_);[Red](#,##0)",
  39: "#,##0.00_);(#,##0.00)", 40: "#,##0.00_);[Red](#,##0.00)", 41: '_(* #,##0_);_(* \\(#,##0\\);_(* "-"_);_(@_)',
  42: '_("$"* #,##0_);_("$"* \\(#,##0\\);_("$"* "-"_);_(@_)', 43: '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)',
  44: '_("$"* #,##0.00_)_("$"* \\(#,##0.00\\)_("$"* "-"??_)_(@_)', 45: "mm:ss", 46: "[h]:mm:ss", 47: "mmss.0", 48: "##0.0E+0", 49: "@",
};
const FMT_STRIP = /".*?"|\[(?!hh?\]|mm?\]|ss?\])[^\]]*\]/g;
/** openpyxl's is_date_format: a number shown through this format is read as a date. */
export function isDateFormat(fmt: string | null | undefined): boolean {
  if (fmt === null || fmt === undefined) return false;
  return /(?<![_\\])[dmhysDMHYS]/.test(fmt.split(";")[0].replace(FMT_STRIP, ""));
}

type Book = { sheets: { name: string; path: string | null }[]; sst: string[]; dateStyles: Set<number> };

function resolveTarget(base: string, target: string): string {
  const t = target.replace(/\\/g, "/");
  return t.startsWith("/") ? t.slice(1) : posix.normalize(posix.join(posix.dirname(base), t));
}

async function readBook(file: string, entries: ZipEntry[]): Promise<Book> {
  const byName = new Map(entries.map((e) => [e.name, e] as const));
  const lower = new Map(entries.map((e) => [e.name.toLowerCase(), e] as const));
  const entry = (n: string) => byName.get(n) ?? lower.get(n.toLowerCase());
  const elements = async (n: string, want: Set<string>): Promise<{ name: string; a: Record<string, string> }[]> => {
    const e = entry(n);
    if (!e) return [];
    const out: { name: string; a: Record<string, string> }[] = [];
    await parseXml(file, e, { open: (name, a) => { if (want.has(name)) out.push({ name, a }); }, text: () => {}, close: () => {} });
    return out;
  };

  // the parts, as openpyxl finds them: the manifest, then the workbook's own rels
  const ct = await elements("[Content_Types].xml", new Set(["Override"]));
  const wbPath = ct.find((o) => CT_WORKBOOK.has(o.a.ContentType))?.a.PartName?.replace(/^\//, "") ?? "xl/workbook.xml";
  if (!entry(wbPath)) throw new WorkbookFormatError(`${basename(file)}: no workbook part (${wbPath})`);
  const sstPath = ct.find((o) => o.a.ContentType === CT_SST)?.a.PartName?.replace(/^\//, "") ?? null;
  const relsPath = posix.join(posix.dirname(wbPath), "_rels", `${posix.basename(wbPath)}.rels`);
  const rels = new Map((await elements(relsPath, new Set(["Relationship"]))).map((r) => [r.a.Id, resolveTarget(wbPath, r.a.Target ?? "")] as const));
  const sheets = (await elements(wbPath, new Set(["sheet"]))).map(({ a }) => {
    const rid = Object.keys(a).find((k) => k !== "sheetId" && local(k) === "id" && k.includes(":"));
    const path = rid ? rels.get(a[rid]) ?? null : null;
    return { name: a.name ?? "", path };
  });

  // shared strings: the text of <t> and of each run's <t>, phonetic runs left out (openpyxl's Text.content)
  const sst: string[] = [];
  const se = sstPath ? entry(sstPath) : undefined;
  if (se) {
    let inSi = false, inR = false, inRPh = false, inT = false, t = "", plain: string | null = null;
    let runs: string[] = [];
    await parseXml(file, se, {
      open: (n) => {
        if (n === "si") { inSi = true; plain = null; runs = []; }
        else if (n === "r" && inSi) inR = true;
        else if (n === "rPh" && inSi) inRPh = true;
        else if (n === "t" && inSi && !inRPh) { inT = true; t = ""; }
      },
      text: (x) => { if (inT) t += x; },
      close: (n) => {
        if (n === "t" && inT) { inT = false; if (inR) runs.push(t); else plain = t; }
        else if (n === "r") inR = false;
        else if (n === "rPh") inRPh = false;
        else if (n === "si" && inSi) { inSi = false; sst.push(((plain ?? "") + runs.join("")).replace(/x005F_/g, "")); }
      },
    });
  }

  // date styles: the cellXfs whose number format reads as a date (styles.xml at its fixed path, as openpyxl reads it)
  const custom = new Map<number, string>();
  const xfs: number[] = [];
  const ste = entry("xl/styles.xml");
  if (ste) {
    let inXfs = false;
    await parseXml(file, ste, {
      open: (n, a) => {
        if (n === "numFmt") custom.set(Number(a.numFmtId), a.formatCode ?? "");
        else if (n === "cellXfs") inXfs = true;
        else if (n === "xf" && inXfs) xfs.push(Number(a.numFmtId ?? 0));
      },
      text: () => {},
      close: (n) => { if (n === "cellXfs") inXfs = false; },
    });
  }
  const dateStyles = new Set<number>();
  xfs.forEach((id, idx) => {
    if (isDateFormat(custom.has(id) ? custom.get(id)! : BUILTIN_FORMATS[id])) dateStyles.add(idx);
  });
  return { sheets, sst, dateStyles };
}

/* ── a worksheet, row by row ───────────────────────────────────────────── */

const ABSOLUTE_RE = /^[$]?([A-Za-z]{1,3})?[$]?(\d+)?(:[$]?([A-Za-z]{1,3})?[$]?(\d+)?)?$/;
const COORD_RE = /^[$]?([A-Za-z]{1,3})[$]?(\d+)$/;
const colIndex = (letters: string) => [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

/** <dimension ref>: the sheet's last column and row, as openpyxl pads and cuts to them. */
function dimensionOf(ref: string | undefined): { maxCol: number | null; maxRow: number | null } | null {
  if (!ref) return null;
  const m = ABSOLUTE_RE.exec(ref);
  if (!m) throw new WorkbookFormatError(`a sheet dimension "${ref}" openpyxl would refuse`);
  const [, c1, r1, , c2, r2] = m;
  return { maxCol: c2 ? colIndex(c2) : c1 ? colIndex(c1) : null, maxRow: r2 ? Number(r2) : r1 ? Number(r1) : null };
}

/** openpyxl _cast_number: "." or an exponent makes a float, else an int. */
function castNumber(s: string): number | PyFloat {
  const t = s.trim();
  if (/[.eE]/.test(s)) {
    if (!/^[+-]?(?:\d+(?:_\d+)*)?(?:\.(?:\d+(?:_\d+)*)?)?(?:[eE][+-]?\d+(?:_\d+)*)?$/.test(t) || !/\d/.test(t)) {
      throw new WorkbookFormatError(`a numeric cell holds "${s.slice(0, 40)}"`);
    }
    const x = Number(t.replace(/_/g, ""));
    return Number.isInteger(x) ? new PyFloat(x) : x;
  }
  if (!/^[+-]?\d+(?:_\d+)*$/.test(t)) throw new WorkbookFormatError(`a numeric cell holds "${s.slice(0, 40)}"`);
  return Number(t.replace(/_/g, ""));
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
/** from_excel, near enough: a date-formatted number becomes a date - what matters is that it is no longer a number. */
function excelDate(x: number): Cell {
  if (!(x > -693594 && x < 2958466)) return "#VALUE!";
  return new Date(EXCEL_EPOCH + Math.round((x < 60 && x >= 1 ? x + 1 : x) * 86_400_000));
}

type Sink = (n: number, cells: Cell[]) => void;

/** One sheet as openpyxl's read-only iter_rows gives it: rows in order, padded to the dimension, data rows cut at it. */
async function readSheet(file: string, e: ZipEntry, book: Book, sink: Sink, beat?: () => Promise<void>): Promise<number> {
  let dims: { maxCol: number | null; maxRow: number | null } | null = null;
  let seenData = false, inData = false, inRow = false, inCell = false, stopped = false;
  let rowNo = 0, colCounter = 0, last = 0, rows = 0, beatAt = 0;
  let pairs: number[] = [];
  let vals: Cell[] = [];
  let cT = "n", cS = 0, cCol = 0, vText: string | null = null, sawV = false, inV = false;
  let inIs = false, isNode = false, inR = false, inRPh = false, inT = false, tText = "", plain: string | null = null;
  let runs: string[] = [];

  const value = (): Cell => {
    if (cT === "inlineStr") return isNode ? (plain ?? "") + runs.join("") : null;
    const v = vText === null || vText === "" ? null : vText;
    if (v === null) return null;
    switch (cT) {
      case "n": {
        const x = castNumber(v);
        return book.dateStyles.has(cS) ? excelDate(x instanceof PyFloat ? x.v : x) : x;
      }
      case "s": {
        const s = book.sst[Number(v)];
        if (s === undefined) throw new WorkbookFormatError(`a cell points at shared string ${v}, which does not exist`);
        return s;
      }
      case "b": {
        const k = castNumber(v);
        return (k instanceof PyFloat ? k.v : k) !== 0;
      }
      case "d": {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) throw new WorkbookFormatError(`a date cell holds "${v.slice(0, 40)}"`);
        return d;
      }
      default:
        return v; // "str", "e" ("#N/A"), anything else: the text as it is
    }
  };

  await parseXml(file, e, {
    open: (n, a) => {
      if (stopped) return;
      switch (n) {
        case "dimension":
          if (!seenData && !dims) dims = dimensionOf(a.ref);
          break;
        case "sheetData":
          seenData = inData = true;
          break;
        case "row": {
          if (!inData) break;
          if (a.r !== undefined) {
            const r = Number(a.r);
            if (!Number.isInteger(r)) throw new WorkbookFormatError(`"${a.r}" is not a valid row number`);
            rowNo = r;
          } else rowNo += 1;
          colCounter = 0;
          pairs = [];
          vals = [];
          inRow = true;
          break;
        }
        case "c":
          if (!inRow) break;
          inCell = true;
          cT = a.t ?? "n";
          cS = a.s ? Number(a.s) || 0 : 0;
          if (a.r) {
            const m = COORD_RE.exec(a.r);
            if (!m) throw new WorkbookFormatError(`"${a.r}" is not a valid cell reference`);
            cCol = colCounter = colIndex(m[1]);
          } else cCol = colCounter += 1;
          vText = null;
          sawV = false;
          isNode = false;
          plain = null;
          runs = [];
          break;
        case "v":
          if (inCell && !sawV && !inIs) { inV = true; vText = ""; }
          break;
        case "is":
          if (inCell) { inIs = true; isNode = true; }
          break;
        case "r":
          if (inIs) inR = true;
          break;
        case "rPh":
          if (inIs) inRPh = true;
          break;
        case "t":
          if (inIs && !inRPh) { inT = true; tText = ""; }
          break;
      }
    },
    text: (t) => {
      if (inV) vText += t;
      else if (inT) tText += t;
    },
    close: (n) => {
      if (stopped) return;
      switch (n) {
        case "v":
          if (inV) { inV = false; sawV = true; }
          break;
        case "t":
          if (inT) { inT = false; if (inR) runs.push(tText); else plain = tText; }
          break;
        case "r":
          inR = false;
          break;
        case "rPh":
          inRPh = false;
          break;
        case "is":
          inIs = false;
          break;
        case "c":
          if (inCell) {
            pairs.push(cCol);
            vals.push(value());
            inCell = false;
          }
          break;
        case "row": {
          if (!inRow) break;
          inRow = false;
          if (rowNo <= last) break; // openpyxl skips a row it has passed
          const d = dims as { maxCol: number | null; maxRow: number | null } | null;
          if (rowNo >= 17 && d?.maxRow != null && rowNo > d.maxRow) { stopped = true; break; }
          last = rowNo;
          const width = d?.maxCol ?? (pairs.length ? pairs[pairs.length - 1] : 0);
          const cells: Cell[] = new Array(width).fill(null);
          for (let i = 0; i < pairs.length; i++) if (pairs[i] >= 1 && pairs[i] <= width) cells[pairs[i] - 1] = vals[i];
          sink(rowNo, cells);
          rows += 1;
          break;
        }
        case "sheetData":
          inData = false;
          break;
      }
    },
  }, beat ? async () => {
    if (rows - beatAt >= 5000) {
      beatAt = rows;
      await beat();
    }
  } : undefined);
  return rows;
}

/* ── the morning workbook ──────────────────────────────────────────────── */

export type ErpWorkbook = {
  file: string;
  mb: number;
  /** the sheets in the workbook, as workbook.xml names them */
  sheets: string[];
  customers: Figures3Result;
  /** null when the workbook has no FIGURES (4) - the connector then writes no profit-centre rows */
  profitCentres: Figures4Result | null;
  rows: number;
  seconds: number;
};

/** Read revenue_profit_center.xlsx: FIGURES (3) and FIGURES (4), one streaming pass each. */
export async function readErpWorkbook(file: string, beat?: () => Promise<void>): Promise<ErpWorkbook> {
  const t0 = Date.now();
  const entries = await assertXlsx(file);
  const { size } = await stat(file);
  const book = await readBook(file, entries);
  const names = book.sheets.map((s) => s.name);
  const part = (title: string) => {
    const s = book.sheets.find((x) => x.name === title);
    if (!s) return null;
    const e = s.path ? entries.find((x) => x.name === s.path) ?? entries.find((x) => x.name.toLowerCase() === s.path!.toLowerCase()) : undefined;
    if (!e) throw new WorkbookFormatError(`${basename(file)}: sheet "${title}" is listed but its part (${s.path ?? "no target"}) is missing`);
    return e;
  };
  const e3 = part(SHEET_CUSTOMERS);
  if (!e3) throw new WorkbookFormatError(`${basename(file)}: no sheet "${SHEET_CUSTOMERS}" - the export changed (sheets: ${names.join(", ") || "none"})`);
  const e4 = part(SHEET_PROFIT_CENTRES);
  const f3 = new Figures3();
  let rows = await readSheet(file, e3, book, (n, cells) => f3.feed(n, cells), beat);
  const customers = f3.finish();
  let profitCentres: Figures4Result | null = null;
  if (e4) {
    const f4 = new Figures4();
    rows += await readSheet(file, e4, book, (n, cells) => f4.feed(n, cells), beat);
    profitCentres = f4.finish();
  }
  return { file: basename(file), mb: pyRound(size / 1048576, 1), sheets: names, customers, profitCentres, rows, seconds: Math.round((Date.now() - t0) / 100) / 10 };
}
