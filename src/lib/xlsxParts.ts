// The .xlsx writer's parts that run anywhere - the spreadsheet XML and the zip around it - so the server (./xlsx.ts,
// node:zlib) and the browser (./xlsxBrowser.ts, CompressionStream) write the same file. Moved out of xlsx.ts on
// 31.10.2026: the Datatracker sent its whole table to the server to be written, and a big one (best selling products)
// is far over the 8 KB request body the firewall lets through - a bare 403, "Export failed (HTTP 403)".

export type Cell = string | number | null | undefined;
export type Column = { header: string; width?: number; format?: "int" | "money" | "pct1" };
/** A band over several columns - "In the shop", "Bought this year" - so the source of each column reads at a glance. */
export type Group = { label: string; span: number; tone?: "navy" | "blue" | "green" | "slate" };
export type Sheet = {
  name: string;
  columns: Column[];
  rows: Cell[][];
  /** Lines written above the header (titles, notes) - the header then follows them. */
  preamble?: string[];
  /** Frozen header and autofilter (default true). */
  table?: boolean;
  /** Bands over the header, left to right; their spans should add up to the columns. */
  groups?: Group[];
};

/** 1-based row of the header: after the preamble and the band row, if any. */
const headerRow = (s: Sheet) => (s.preamble?.length ?? 0) + (s.groups?.length ? 1 : 0) + 1;

/* ── zip ──────────────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A file inside the zip: its bytes, and those bytes as stored - deflated (method 8) or as they are (method 0). */
export type ZipEntry = { name: string; data: Uint8Array; comp: Uint8Array; method: 0 | 8 };

export function zip(files: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new Uint8Array(30);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true); // utf-8 names
    l.setUint16(8, f.method, true);
    l.setUint32(10, 0, true); // time/date
    l.setUint32(14, crc, true);
    l.setUint32(18, f.comp.length, true);
    l.setUint32(22, f.data.length, true);
    l.setUint16(26, name.length, true);
    l.setUint16(28, 0, true);
    parts.push(local, name, f.comp);
    const cen = new Uint8Array(46);
    const c = new DataView(cen.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, f.method, true);
    c.setUint32(12, 0, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, f.comp.length, true);
    c.setUint32(24, f.data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(cen, name);
    offset += local.length + name.length + f.comp.length;
  }
  const cenLen = central.reduce((n, b) => n + b.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, cenLen, true);
  e.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const b of all) { out.set(b, at); at += b.length; }
  return out;
}

/* ── spreadsheet XML ──────────────────────────────────────────────────── */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    // characters XML 1.0 forbids
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

function colName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// style ids in styles.xml below: 0 plain, 1 header, 2 int, 3 money, 4 pct1, 5 title, 6 note,
// 7-10 group bands (navy, blue, green, slate)
const STYLE: Record<NonNullable<Column["format"]>, number> = { int: 2, money: 3, pct1: 4 };

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="#,##0.00"/><numFmt numFmtId="166" formatCode="0.0"/></numFmts>
<fonts count="8"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF15223A"/><name val="Calibri"/></font><font><sz val="9"/><color rgb="FF8B97AC"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF15223A"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF1B4A80"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF1F6B3A"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF4A5568"/><name val="Calibri"/></font></fonts>
<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF274E64"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3E8EF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF2FB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF6EE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F4F8"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="5" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="7" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function cellXml(ref: string, v: Cell, style: number): string {
  if (v === null || v === undefined || v === "") return style ? `<c r="${ref}" s="${style}"/>` : "";
  if (typeof v === "number") return Number.isFinite(v) ? `<c r="${ref}" s="${style}"><v>${v}</v></c>` : "";
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function sheetXml(s: Sheet): string {
  const pre = s.preamble ?? [];
  const table = s.table !== false;
  // a plain sheet (a summary) has no header row; a table's sits right under the preamble
  const bands = s.groups?.length ? s.groups : null;
  const head = pre.length + (bands ? 1 : 0) + (table ? 1 : 0); // 1-based row of the header
  const last = colName(s.columns.length - 1);
  const rows: string[] = [];
  pre.forEach((line, i) => rows.push(`<row r="${i + 1}">${cellXml(`A${i + 1}`, line, i === 0 ? 5 : 6)}</row>`));
  const merges: string[] = [];
  if (bands) {
    const r = pre.length + 1;
    const TONE = { navy: 7, blue: 8, green: 9, slate: 10 } as const;
    let at = 0;
    const cells: string[] = [];
    for (const g of bands) {
      const span = Math.max(1, Math.floor(g.span));
      const style = TONE[g.tone ?? "navy"];
      // every cell of the band carries the fill, so it reads as one block even unmerged
      for (let k = 0; k < span; k++) cells.push(cellXml(`${colName(at + k)}${r}`, k === 0 ? g.label : null, style));
      if (span > 1) merges.push(`<mergeCell ref="${colName(at)}${r}:${colName(at + span - 1)}${r}"/>`);
      at += span;
    }
    rows.push(`<row r="${r}">${cells.join("")}</row>`);
  }
  if (table) rows.push(`<row r="${head}">${s.columns.map((c, j) => cellXml(`${colName(j)}${head}`, c.header, 1)).join("")}</row>`);
  s.rows.forEach((r, i) => {
    const n = head + 1 + i;
    rows.push(`<row r="${n}">${r.map((v, j) => cellXml(`${colName(j)}${n}`, v, s.columns[j]?.format ? STYLE[s.columns[j].format!] : 0)).join("")}</row>`);
  });
  const pane = table
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${head}" topLeftCell="A${head + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : `<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>`;
  const cols = `<cols>${s.columns.map((c, j) => `<col min="${j + 1}" max="${j + 1}" width="${c.width ?? 12}" customWidth="1"/>`).join("")}</cols>`;
  const filter = table && s.rows.length ? `<autoFilter ref="A${head}:${last}${head + s.rows.length}"/>` : "";
  // schema order: autoFilter comes before mergeCells
  const merged = merges.length ? `<mergeCells count="${merges.length}">${merges.join("")}</mergeCells>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pane}${cols}<sheetData>${rows.join("")}</sheetData>${filter}${merged}</worksheet>`;
}

/** Sheet names: max 31 characters, none of []:*?/\ */
const sheetName = (s: string) => s.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Sheet";

/** The parts of the .xlsx, each as UTF-8 bytes - zipped by the caller with its own deflate. */
export function xlsxFiles(sheets: Sheet[]): { name: string; data: Uint8Array }[] {
  const te = new TextEncoder();
  const enc = (s: string) => te.encode(s);
  return [
    { name: "[Content_Types].xml", data: enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`) },
    { name: "_rels/.rels", data: enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(sheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${sheets.some((s) => s.table !== false && s.rows.length) ? `<definedNames>${sheets.map((s, i) => s.table !== false && s.rows.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(sheetName(s.name))}'!$A$${headerRow(s)}:$${colName(s.columns.length - 1)}$${headerRow(s) + s.rows.length}</definedName>` : "").join("")}</definedNames>` : ""}</workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "xl/styles.xml", data: enc(STYLES) },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc(sheetXml(s)) })),
  ];
}
