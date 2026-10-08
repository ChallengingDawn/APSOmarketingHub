import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import {
  PyFloat, countryName, figureTotals, isDigits, iso, last, latestMonth, ladder, pct, planErp, pyRound, pyStr, pyStrip, pySum,
  readFigures3, readFigures4, realignTargets, shortPrio, type Cell,
} from "../src/lib/connectors/steps/erpRules";
import { WorkbookFormatError, isDateFormat, readErpWorkbook } from "../src/lib/connectors/steps/erpWorkbook";

/* ── Python's arithmetic (expected values printed by CPython 3.13) ─────── */

test("round: the exact binary value, an exact tie to the even digit - as Python", () => {
  const cases: [number, number, number][] = [
    [2.675, 2, 2.67], [0.125, 2, 0.12], [0.375, 2, 0.38], [2.5, 0, 2], [3.5, 0, 4], [-0.125, 2, -0.12],
    [99.995, 2, 100], [1.005, 2, 1], [1234.5675, 2, 1234.57], [-2.5, 0, -2], [0.045, 2, 0.04], [10.555, 2, 10.55],
    [0.25, 1, 0.2], [(100 * (5 - 3)) / 3, 1, 66.7], [1e17 + 0.5, 2, 1e17],
  ];
  for (const [x, n, want] of cases) assert.equal(pyRound(x, n), want, `round(${x}, ${n})`);
  assert.ok(Object.is(pyRound(-0.001, 2), -0));
});

test("sum: Python 3.12's compensated sum, not a running +=", () => {
  assert.equal(pySum([1e16, 1, -1e16]), 1);
  assert.equal(pySum(Array(10).fill(0.1)), 1);
  assert.equal(pySum([]), 0);
});

test("str / strip / isdigit as Python sees a cell", () => {
  assert.equal(pyStr(null), "None");
  assert.equal(pyStr(100), "100");
  assert.equal(pyStr(new PyFloat(100)), "100.0"); // "100.0" in the file: not a mandant number
  assert.equal(pyStr(1.5e-5), "1.5e-05");
  assert.equal(pyStr(true), "True");
  assert.equal(pyStrip("\x1c a\x85"), "a");
  assert.equal(pyStrip("a﻿"), "a﻿"); // a BOM is not whitespace to Python
  assert.ok(isDigits("110") && isDigits("²") && !isDigits("") && !isDigits("100.0") && !isDigits("Grand Total"));
});

test("country and priority, folded as the connector folds them", () => {
  assert.equal(iso("Switzerland"), "CH");
  assert.equal(iso(" de "), "DE");
  assert.equal(iso(""), "XX");
  assert.equal(iso(null), "XX");
  assert.equal(iso("Österreich"), "ÖS");
  assert.equal(iso("constructor"), "CO"); // never a prototype hit
  assert.equal(countryName("CH"), "Switzerland");
  assert.equal(countryName("QQ"), "QQ");
  assert.equal(shortPrio("1-Prio 1 - Pot >25000EUR"), "1 - Prio 1");
  assert.equal(shortPrio("prio 3 something"), "3 - Prio 3");
  assert.equal(shortPrio(" 2 - something"), "2 - Prio 2");
  assert.equal(shortPrio("4- No priority"), "4 - No priority");
  assert.equal(shortPrio(null), "5 - Not set");
});

/* ── FIGURES (3) / (4) from rows ───────────────────────────────────────── */

// columns: 0 name, 1 key, 2-5 Jan, 6-9 Feb (MTD, PY_MTD, YTD, PY_YTD), 10 mandant, 11-12 forecast Jan/Feb,
// 13 the OI pivot's OWN key, 14-17 Jan OI, 18-21 Feb OI
const REV = ["I_NET_REV_EUR_MTD", "I_NET_REV_EUR_PY_MTD", "I_NET_REV_EUR_YTD", "I_NET_REV_EUR_PY_YTD"];
const OI = REV.map((m) => `OI_${m.slice(2)}`);
function sheet3(): Cell[][] {
  const rows: Cell[][] = Array.from({ length: 21 }, () => []);
  rows[13] = [null, "Revenue", null, null, null, null, null, null, null, null, null, "Forecast", null, "Order intake"];
  rows[14] = [null, null, "Jan", null, null, null, "Feb", null, null, null, null, "Jan", "Feb", null, "Jan", null, null, null, "Feb"];
  rows[15] = ["CustomerName", "CustomerNumberUnique", ...REV, ...REV, "Mandant", "I_NET_REV_EUR_FC", "I_NET_REV_EUR_FC", "CustomerNumberUnique", ...OI, ...OI];
  //            key        Jan rev          Feb rev (YTD falls: a credit note)   mandant  forecast      OI key   Jan OI        Feb OI
  rows[16] = ["A", "100-1", 10, 5, 10, 5, -4, 5, 6, 10, "100", 1000, 2000, "110-2", 7, 1, 7, 1, 3, 0, 10, 1];
  rows[17] = ["B", "110-2", 1, 1, 1, 1, -1, 0, 0, 2, "Grand Total", 3000, 4000, "100-1", 2, 2, 2, 2, 1, 1, 3, 3];
  rows[18] = ["C", "110-3", 0, 0, 0, 0, 0, 0, 0, 0, 110, 500, 0, "Grand Total", 9, 9, 9, 9, 9, 9, 9, 9];
  rows[19] = ["D", "Grand Total", 11, 6, 11, 6, -5, 5, 6, 12, null, 0, 0];
  rows[20] = ["E", " 100-1 ", 1, 0, 0, 0];
  return rows;
}

test("FIGURES (3): each measure on its OWN key, zeros kept, all-zero customers out, Grand Total never summed", () => {
  const f = readFigures3(sheet3());
  assert.equal(f.pivots, 2);
  assert.deepEqual([...f.customers.keys()], ["100-1", "110-2"]);
  const a = f.customers.get("100-1")!, b = f.customers.get("110-2")!;
  // the OI pivot lists 110-2 first and 100-1 second: rule 1 reads them against column 13, not column 1
  assert.equal(a.get("Feb|OI_NET_REV_EUR_YTD"), 3);
  assert.equal(b.get("Feb|OI_NET_REV_EUR_YTD"), 10);
  // a key with spaces is the same customer; its second row adds up
  assert.equal(a.get("Jan|I_NET_REV_EUR_MTD"), 11);
  assert.equal(b.get("Feb|I_NET_REV_EUR_YTD"), 0); // a zero is a value
  // forecast: mandant rows only - the Grand Total row is skipped, not added
  assert.deepEqual([...f.forecast], [["Jan", 1500], ["Feb", 2000]]);
  assert.equal(f.forecastSkipped, 1);
});

test("YTD: the LAST month with a value, never max() - it falls on a credit note and may fall to 0", () => {
  const { customers } = readFigures3(sheet3());
  const a = customers.get("100-1")!, b = customers.get("110-2")!;
  assert.equal(latestMonth(customers), "Feb");
  assert.equal(last(a, "I_NET_REV_EUR_YTD", ["Jan", "Feb"]), 6);
  assert.equal(last(b, "I_NET_REV_EUR_YTD", ["Jan", "Feb"]), 0);
  assert.deepEqual([...ladder(a, "I_NET_REV_EUR_YTD", ["Jan", "Feb"])], [[1, 10], [2, -4]]);
  assert.deepEqual([...ladder(new Map([["Mar|X", 5]]), "X", ["Jan", "Feb", "Mar"])], [[3, 5]]);
});

test("FIGURES (3): no key column or no forecast is a layout change, said so", () => {
  const noKey = sheet3();
  noKey[15] = noKey[15].map((v) => (v === "CustomerNumberUnique" ? "Customer" : v));
  assert.throws(() => readFigures3(noKey), /no CustomerNumberUnique header/);
  const noFc = sheet3();
  noFc[15] = noFc[15].map((v) => (v === "I_NET_REV_EUR_FC" ? "FC" : v));
  assert.throws(() => readFigures3(noFc), /forecast columns not found/);
});

test("FIGURES (4): month by month from the YTD ladder; totals skipped; an empty cell reads as 0, as in the connector", () => {
  const rows: Cell[][] = Array.from({ length: 20 }, () => []);
  rows[14] = [null, "Jan", null, "Feb"];
  rows[15] = ["ProfitCenter", "I_NET_REV_EUR_YTD", "I_NET_REV_EUR_PY_YTD", "I_NET_REV_EUR_YTD", "I_NET_REV_EUR_PY_YTD"];
  rows[16] = ["DT", 100, 80, 250, 160.004];
  rows[17] = ["Grand Total", 1, 1, 1, 1];
  rows[18] = [" KT ", 50, 10, null, 20];
  rows[19] = ["  ", 1, 1, 1, 1];
  const f = readFigures4(rows);
  assert.equal(f.skipped, 1);
  const v = (pc: string, off: number, m: number) => [...f.series.values()].find((x) => x.pc === pc && x.off === off && x.m === m)?.v;
  assert.equal(v("DT", 0, 2), 150);
  assert.equal(v("DT", -1, 2), 80);
  assert.equal(v("KT", 0, 2), -50);
  assert.equal(f.series.size, 8);
});

/* ── the plan ──────────────────────────────────────────────────────────── */

test("plan: figures, ranks over matched companies (ties keep HubSpot's order), %, KPI rows, realign", () => {
  const f = readFigures3(sheet3());
  const found = new Map([
    ["110-2", { id: "20", country: "Switzerland", sales_priority: "2-Prio 2" }],
    ["100-1", { id: "10", country: null, sales_priority: null }],
  ]);
  const plan = planErp({ customers: f.customers, forecast: f.forecast, profitCentres: new Map() }, found, "2026-10-08");
  assert.equal(plan.month, "Feb");
  assert.deepEqual(plan.companies.map((c) => c.id), ["20", "10"]);
  const a = plan.companies[1].properties, b = plan.companies[0].properties;
  assert.equal(a.erp_rev_ytd_cy, 6);
  assert.equal(a.erp_rev_ytd_py, 10);
  assert.equal(a.erp_rev_ytd_delta_pct, -40);
  assert.equal(a.erp_oi_ytd_pct_of_rev, 50);
  assert.equal(b.erp_rev_ytd_cy, 0);
  assert.equal(b.erp_oi_ytd_pct_of_rev, null); // no revenue: no %
  assert.equal(b.erp_rev_rank_ytd, null); // zero revenue is not ranked
  assert.equal(a.erp_rev_rank_ytd, 1);
  assert.equal(a.erp_rev_rank_decline, 1); // -4: the biggest loss
  assert.equal(b.erp_rev_rank_decline, 2); // -2
  assert.equal(a.erp_rev_as_of, "2026-10-08");
  assert.equal(pct(5, 0), null);
  assert.deepEqual(figureTotals(plan.rows).ytd, 6);
  const cat = (c: string) => plan.series.find((s) => s.cat === c)!.rows;
  assert.deepEqual([...cat("forecast_monthly").keys()], ["forecast|2026-01", "forecast|2026-02"]);
  assert.equal(cat("oi_erp_monthly").get("oierp|2025-02")!.metric_value, 1); // (3 + 1) - (2 + 1)
  assert.equal(cat("revenue_geo_erp_monthly").get("revgeoerp|110|CH|2026-01")!.kpi_entity, "APSOparts GmbH (DE)");
  assert.equal(cat("revenue_geo_erp_monthly").get("revgeoerp|100|XX|2026-02")!.kpi_country, "Unknown");
  assert.equal(cat("revenue_prio_monthly").get("revprio|5|2026-01")!.kpi_priority, "5 - Not set");
  assert.equal(plan.forecastYearTotal, 3500);
  assert.equal(plan.forecastSuspect, false);
  // the realign: month 2 goes to the FIRST row in HubSpot's order that ends -02 and carries the year
  const existing = new Map([["revenue_monthly|2025-02", "a"], ["revenue_monthly|2026-02", "b"], ["x|2026-02", "c"], ["revenue_monthly|2026-01", "d"]]);
  assert.deepEqual(realignTargets(plan.revCy, existing, 2026), [
    { id: "d", name: "revenue_monthly|2026-01", metric_value: 11 },
    { id: "b", name: "revenue_monthly|2026-02", metric_value: -5 },
  ]);
});

test("number formats that read as dates, as openpyxl decides", () => {
  assert.ok(isDateFormat("yyyy-mm-dd"));
  assert.ok(isDateFormat("[h]:mm:ss"));
  assert.ok(!isDateFormat("#,##0.00"));
  assert.ok(!isDateFormat('"day"0'));
  assert.ok(!isDateFormat("[Red]0.00"));
  assert.ok(!isDateFormat("0.00_d"));
  assert.ok(!isDateFormat(undefined));
});

/* ── the file ──────────────────────────────────────────────────────────── */

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Buffer) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** A minimal ZIP; `deflate` stores the entry compressed as Excel does. */
function zip(files: [string, string | Buffer, boolean?][]): Buffer {
  const parts: Buffer[] = [], central: Buffer[] = [];
  let off = 0;
  for (const [name, content, deflate] of files) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const body = deflate ? deflateRawSync(data) : data;
    const nm = Buffer.from(name, "utf8");
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(deflate ? 8 : 0, 8);
    lh.writeUInt32LE(crc32(data), 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(deflate ? 8 : 0, 10);
    ch.writeUInt32LE(crc32(data), 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nm, body);
    central.push(ch, nm);
    off += 30 + nm.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const col = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
/** Rows as cells; strings inline, numbers as numbers; `raw` wins for a cell given as {xml}. */
function sheetXml(rows: Cell[][] | Record<number, (Cell | { xml: string })[]>, dim: string | null, extra: Record<number, string> = {}): string {
  const out: string[] = [];
  const entries = Array.isArray(rows) ? rows.map((r, i) => [i + 1, r] as const) : Object.entries(rows).map(([k, r]) => [Number(k), r] as const);
  for (const [n, r] of entries) {
    if (!r.length && !extra[n]) continue;
    const cells = r.map((v, i) => {
      const ref = `${col(i)}${n}`;
      if (v === null || v === undefined) return "";
      if (typeof v === "object" && "xml" in v) return v.xml.replace("@", ref);
      if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${esc(String(v))}</t></is></c>`;
    });
    out.push(`<row r="${n}">${cells.join("")}${extra[n] ?? ""}</row>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet ${NS}>${dim ? `<dimension ref="${dim}"/>` : ""}<sheetData>${out.join("")}</sheetData></worksheet>`;
}

/** An .xlsx the way openpyxl lays it out: sheets FIRST, workbook.xml and shared strings after, absolute rels targets. */
function workbook(sheets: [string, string][], sst: string | null, styles: string | null): Buffer {
  const files: [string, string, boolean?][] = [];
  sheets.forEach(([, xml], i) => files.push([`xl/worksheets/sheet${i + 1}.xml`, xml, true]));
  if (styles) files.push(["xl/styles.xml", styles]);
  files.push(["xl/workbook.xml", `<workbook ${NS}><sheets>${sheets.map(([name], i) => `<sheet name="${esc(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`]);
  files.push(["xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`]);
  if (sst) files.push(["xl/sharedStrings.xml", sst, true]);
  files.push(["[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sst ? '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' : ""}</Types>`]);
  return zip(files);
}

function withDir(fn: (dir: string) => Promise<void>) {
  return async () => {
    const dir = mkdtempSync(join(tmpdir(), "erp-test-"));
    try {
      await fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

test("reader: a workbook laid out as openpyxl writes it reads cell for cell as openpyxl reads it", withDir(async (dir) => {
  const rows: Record<number, (Cell | { xml: string })[]> = {};
  sheet3().forEach((r, i) => { if (r.length) rows[i + 1] = r; });
  // the customer key from the shared strings, rich runs joined and the phonetic run left out
  rows[17] = [...sheet3()[16]];
  rows[17][1] = { xml: '<c r="@" t="s"><v>0</v></c>' };
  // a cached "#N/A", a date-formatted number and a formula's cached number in measure cells
  rows[18] = [...sheet3()[17]];
  rows[18][2] = { xml: '<c r="@" t="e"><f>NA()</f><v>#N/A</v></c>' };
  rows[18][3] = { xml: '<c r="@" s="1"><v>46000</v></c>' };
  rows[18][14] = { xml: '<c r="@"><f>4+1</f><v>5</v></c>' };
  // a mandant written as a float: "110.0" is not a digit string to Python - that row is skipped, not counted
  rows[19] = [...sheet3()[18]];
  rows[19][10] = { xml: '<c r="@"><v>110.0</v></c>' };
  rows[19][11] = 500;
  const extra = {
    // past the last header cell (V) but inside the dimension (X): openpyxl carries the label on, so it counts
    17: '<c r="X17"><v>1000</v></c>',
    // cells without a reference take the next column
    21: "",
  };
  rows[21] = [];
  const noRef = '<row r="21"><c t="inlineStr"><is><t>F</t></is></c><c t="inlineStr"><is><t>100-9</t></is></c><c><v>5</v></c></row>';
  const s3 = sheetXml(rows, "A1:X21", extra).replace("</sheetData>", `${noRef}</sheetData>`);
  const s4 = sheetXml({ 15: [null, "Feb"], 16: ["ProfitCenter", "I_NET_REV_EUR_YTD", "I_NET_REV_EUR_PY_YTD"], 17: ["DT", 10, 5], 18: ["Grand Total", 1, 1] }, "A13:C18");
  const sst = '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><r><t>100</t></r><r><t>-1</t></r><rPh><t>X</t></rPh></si></sst>';
  const styles = `<styleSheet ${NS.split(" ")[0]}><numFmts><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>`;
  const file = join(dir, "revenue_profit_center.xlsx");
  writeFileSync(file, workbook([["Info", sheetXml([[1]], "A1")], ["FIGURES (4)", s4], ["FIGURES (3)", s3]], sst, styles));

  const wb = await readErpWorkbook(file);
  assert.deepEqual(wb.sheets, ["Info", "FIGURES (4)", "FIGURES (3)"]);
  const c = wb.customers.customers;
  assert.deepEqual([...c.keys()], ["100-1", "110-2", "100-9"]);
  assert.equal(c.get("100-1")!.get("Jan|I_NET_REV_EUR_MTD"), 10);
  assert.equal(c.get("110-2")!.get("Jan|I_NET_REV_EUR_MTD"), undefined); // "#N/A" is text
  assert.equal(c.get("110-2")!.get("Jan|I_NET_REV_EUR_PY_MTD"), undefined); // a date, not a number
  assert.equal(c.get("100-1")!.get("Jan|OI_NET_REV_EUR_MTD"), 5); // the formula's cached value
  assert.equal(c.get("110-2")!.get("Feb|OI_NET_REV_EUR_PY_YTD"), 1001); // 1 + the padded column X
  assert.equal(c.get("100-9")!.get("Jan|I_NET_REV_EUR_MTD"), 5);
  assert.deepEqual([...wb.customers.forecast], [["Jan", 1000], ["Feb", 2000]]);
  assert.equal(wb.customers.forecastSkipped, 2); // Grand Total and the "110.0" mandant
  assert.equal(wb.customers.pivots, 2);
  assert.deepEqual([...wb.profitCentres!.series.values()].map((p) => [p.pc, p.off, p.m, p.v]), [["DT", 0, 2, 10], ["DT", -1, 2, 5]]);
  assert.equal(wb.profitCentres!.skipped, 1);
}));

test("reader: no FIGURES (4) is no profit-centre rows; no FIGURES (3) is an error naming the sheets", withDir(async (dir) => {
  const rows: Cell[][] = sheet3();
  const file = join(dir, "a.xlsx");
  writeFileSync(file, workbook([["FIGURES (3)", sheetXml(rows, "A1:V21")]], null, null));
  const wb = await readErpWorkbook(file);
  assert.equal(wb.profitCentres, null);
  assert.equal(wb.customers.customers.size, 2);
  const other = join(dir, "b.xlsx");
  writeFileSync(other, workbook([["Sheet1", sheetXml([[1]], "A1")]], null, null));
  await assert.rejects(readErpWorkbook(other), /no sheet "FIGURES \(3\)".*Sheet1/);
}));

test("reader: a file that is not an .xlsx says what it is", withDir(async (dir) => {
  const put = (name: string, data: Buffer | string) => {
    const p = join(dir, name);
    writeFileSync(p, data);
    return p;
  };
  const xlsb = put("revenue_profit_center.xlsx", zip([["[Content_Types].xml", "<Types/>"], ["xl/workbook.bin", Buffer.from([1, 2, 3])], ["xl/worksheets/sheet1.bin", Buffer.from([4])]]));
  await assert.rejects(readErpWorkbook(xlsb), (e: Error) => e instanceof WorkbookFormatError && /\.xlsb/.test(e.message) && /renam/.test(e.message));
  const ole = put("old.xlsx", Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(100)]));
  await assert.rejects(readErpWorkbook(ole), /OLE2/);
  await assert.rejects(readErpWorkbook(put("csv.xlsx", "Customer;Revenue\n100-1;5\n")), /no ZIP signature; it starts "Customer"/);
  await assert.rejects(readErpWorkbook(put("empty.xlsx", "")), /empty/);
  await assert.rejects(readErpWorkbook(join(dir, "missing.xlsx")), /file not found/);
  const docx = put("docx.xlsx", zip([["[Content_Types].xml", "<Types/>"], ["word/document.xml", "<w/>"]]));
  await assert.rejects(readErpWorkbook(docx), /not an Excel workbook/);
  const full = workbook([["FIGURES (3)", sheetXml(sheet3(), "A1:V21")]], null, null);
  await assert.rejects(readErpWorkbook(put("cut.xlsx", full.subarray(0, full.length - 30))), /truncated/);
}));
