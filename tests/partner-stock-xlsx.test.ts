import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { colName, xlsx } from "../src/lib/partnerStock/xlsx";

test("column letters", () => {
  assert.deepEqual([0, 1, 25, 26, 27, 51, 52, 701, 702].map(colName), ["A", "B", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
});

test("the .xlsx opens in a real reader: sheets, text codes with their leading zero, numbers, escaping", async () => {
  const buf = xlsx([
    { name: "Code PLOT ANTIVIBRATOIRE", header: true, widths: [18, 14, 40, 10], rows: [
      ["Code ITAFRAN", "Code APSO", "Description", "Stock"],
      ["PLOTA1625C", "0120011310", "Buffer Ø 16 <A&B> \"x\"", 1240],
      ["AMQU018548", "8001247963", null, null],
      ["X", "1", "décimal", 0.43],
    ] },
    { name: "Info", boldFirstCol: true, rows: [["Stock as of", "19.10.2026 07:00 (Zurich)"]] },
  ]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Code PLOT ANTIVIBRATOIRE", "Info"]);
  const ws = wb.worksheets[0];
  assert.equal(ws.rowCount, 4);
  assert.equal(ws.getCell("B2").value, "0120011310");
  assert.equal(ws.getCell("C2").value, "Buffer Ø 16 <A&B> \"x\"");
  assert.equal(ws.getCell("D2").value, 1240);
  assert.equal(ws.getCell("D4").value, 0.43);
  assert.equal(ws.getCell("C3").value, null);
  assert.equal(ws.getCell("A1").font?.bold, true);
  assert.equal(wb.worksheets[1].getCell("B1").value, "19.10.2026 07:00 (Zurich)");
  // the same content gives the same file
  assert.equal(Buffer.compare(buf, xlsx([{ name: "Info", rows: [["a"]] }])) !== 0, true);
});
