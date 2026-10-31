// A small .xlsx writer - no dependency. An .xlsx file is a zip of a few XML
// parts; this writes the handful a report needs: several sheets, a navy header
// row with white bold text, the header frozen, an autofilter, column widths and
// number formats. Server-side (node:zlib); the parts are in ./xlsxParts.ts, which
// the browser's writer (./xlsxBrowser.ts) shares.

import { deflateRawSync } from "node:zlib";
import { xlsxFiles, zip, type Cell, type Column, type Sheet } from "./xlsxParts";

export type { Cell, Column, Group, Sheet } from "./xlsxParts";

export function xlsx(sheets: Sheet[]): Buffer {
  return Buffer.from(zip(xlsxFiles(sheets).map((f) => ({ ...f, comp: new Uint8Array(deflateRawSync(f.data)), method: 8 as const }))));
}

/** Excel-friendly CSV: UTF-8 BOM, semicolons, decimal comma - survives a double-click in a European Excel. */
export function csv(columns: Column[], rows: Cell[][]): Buffer {
  const cell = (v: Cell) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
    return String(v).replace(/;/g, ",").replace(/[\r\n]+/g, " ");
  };
  const lines = [columns.map((c) => cell(c.header)).join(";"), ...rows.map((r) => r.map(cell).join(";"))];
  return Buffer.from("﻿" + lines.join("\n"), "utf8");
}
