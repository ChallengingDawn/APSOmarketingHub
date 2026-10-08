// THE ORDER STEPS' FILES - fct_orderlinehist.csv (the daily delta), dim_article.csv and
// dim_order.csv (~480 MB, every order since 2014, every night) - read as a stream and
// boiled down as they go, so no file is ever held whole: what stays in memory is one
// record per order of the delta, the referenced articles, or one short value per order.
//
// The parser is CPython's _csv reader, state for state (non-strict, ';', '"', doubled
// quotes), not csv-parse: the two disagree on malformed quoting - `"abc"def` is abcdef to
// Python and "abc"def to csv-parse, an unterminated quote at the end is a field to Python
// and an error to csv-parse - and YourReference is free text typed by people. The
// connector's file modes are kept too: the fact and the article file are strict UTF-8,
// dim_order is read with errors="replace" and universal newlines.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import {
  addFctRow, addStageRow, articleOf, detailOfRow, dimOrderNumber, own, packDetail, pyStrip,
  type ArtInfo, type FctOrder, type Get,
} from "./orderRules";

export { articleOf };

const enum S { StartRecord, StartField, InField, InQuoted, QuoteInQuoted, EatCrnl }
const LF = 10, CR = 13, DELIM = 59 /* ; */, QUOTE = 34 /* " */;

export type CsvOptions = {
  /** universal newlines (Python's default open()): \r\n and \r become \n before parsing */
  translateNewlines?: boolean;
  /** csv.field_size_limit - a field beyond it fails the read, as in Python (the connector sets 10,000,000) */
  fieldLimit?: number;
};

/**
 * Python's csv.reader, fed text in pieces. onRow gets every record ([] for a blank line,
 * as Python yields it); returning false stops the reader.
 */
export class PyCsvReader {
  private state = S.StartRecord;
  private fields: string[] = [];
  private field = "";
  private pendingCR = false;
  private lineOpen = false;
  private prevCR = false;
  private stopped = false;
  private readonly limit: number;
  private readonly translate: boolean;

  constructor(private readonly onRow: (row: string[]) => boolean | void, opts: CsvOptions = {}) {
    this.limit = opts.fieldLimit ?? 10_000_000;
    this.translate = !!opts.translateNewlines;
  }

  get done(): boolean { return this.stopped; }

  private saveField() {
    this.fields.push(this.field);
    this.field = "";
  }

  private emit() {
    const row = this.fields;
    this.fields = [];
    if (this.onRow(row) === false) this.stopped = true;
  }

  /** End of a line (Python's EOL pseudo-character). */
  private eol() {
    this.lineOpen = false;
    switch (this.state) {
      case S.StartRecord: break;
      case S.StartField: case S.InField: case S.QuoteInQuoted: this.saveField(); this.state = S.StartRecord; break;
      case S.EatCrnl: this.state = S.StartRecord; break;
      case S.InQuoted: return; // the record goes on over the next line
    }
    this.emit();
  }

  feed(text: string): void {
    if (this.stopped || !text) return;
    let s = text;
    if (this.translate) {
      if (this.prevCR && s.charCodeAt(0) === LF) s = s.slice(1); // the \n of a \r\n split across pieces
      this.prevCR = false;
      if (!s) return;
      this.prevCR = s.charCodeAt(s.length - 1) === CR;
      s = s.replace(/\r\n?/g, "\n");
    }
    let seg = -1; // start of the run of characters being added to the current field
    const flush = (i: number) => {
      if (seg >= 0) {
        this.field += s.slice(seg, i);
        seg = -1;
        if (this.field.length > this.limit) throw new Error(`field larger than field limit (${this.limit})`);
      }
    };
    const n = s.length;
    for (let i = 0; i < n; i++) {
      if (this.stopped) return;
      const c = s.charCodeAt(i);
      if (this.pendingCR) {
        this.pendingCR = false;
        if (c !== LF) { flush(i); this.eol(); if (this.stopped) return; }
      }
      this.lineOpen = true;
      switch (this.state) {
        case S.StartRecord:
          if (c === LF || c === CR) { this.state = S.EatCrnl; break; }
          this.state = S.StartField;
        // falls through
        case S.StartField:
          if (c === LF || c === CR) { this.saveField(); this.state = S.EatCrnl; }
          else if (c === QUOTE) this.state = S.InQuoted;
          else if (c === DELIM) this.saveField();
          else { seg = i; this.state = S.InField; }
          break;
        case S.InField:
          if (c === LF || c === CR) { flush(i); this.saveField(); this.state = S.EatCrnl; }
          else if (c === DELIM) { flush(i); this.saveField(); this.state = S.StartField; }
          else if (seg < 0) seg = i;
          break;
        case S.InQuoted:
          if (c === QUOTE) { flush(i); this.state = S.QuoteInQuoted; }
          else if (seg < 0) seg = i;
          break;
        case S.QuoteInQuoted:
          if (c === QUOTE) { seg = i; this.state = S.InQuoted; }
          else if (c === DELIM) { this.saveField(); this.state = S.StartField; }
          else if (c === LF || c === CR) { this.saveField(); this.state = S.EatCrnl; }
          else { seg = i; this.state = S.InField; } // non-strict: `"abc"def` -> abcdef
          break;
        case S.EatCrnl:
          if (c !== LF && c !== CR) throw new Error("new-line character seen in unquoted field");
          break;
      }
      if (c === LF) { flush(i + 1); this.eol(); }
      else if (c === CR) this.pendingCR = true;
    }
    flush(n);
  }

  /** End of input: the last line, and a quoted field still open (Python keeps it, non-strict). */
  end(): void {
    if (this.stopped) return;
    if (this.pendingCR) { this.pendingCR = false; this.eol(); }
    else if (this.lineOpen) this.eol();
    if (this.stopped) return;
    if (this.field.length || this.state === S.InQuoted) {
      this.saveField();
      this.state = S.StartRecord;
      this.emit();
    }
  }
}

/** The whole text at once (tests, small files). */
export function parseCsvText(text: string, opts: CsvOptions = {}): string[][] {
  const rows: string[][] = [];
  const r = new PyCsvReader((row) => { rows.push(row); }, opts);
  r.feed(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  r.end();
  return rows;
}

export type ReadOptions = CsvOptions & {
  /** strict UTF-8 (the connector opens the fact and dim_article strictly); false = errors="replace" */
  fatal?: boolean;
  /** called between chunks - the step's heartbeat */
  tick?: () => Promise<void>;
};

/** Stream a ';' CSV file through Python's reader; a leading BOM is dropped (utf-8-sig). */
export async function readCsvFile(file: string, opts: ReadOptions, onRow: (row: string[]) => boolean | void): Promise<void> {
  const dec = new TextDecoder("utf-8", { fatal: !!opts.fatal });
  const reader = new PyCsvReader(onRow, opts);
  const stream = createReadStream(file, { highWaterMark: 1 << 20 });
  try {
    for await (const buf of stream) {
      reader.feed(dec.decode(buf as Buffer, { stream: true }));
      if (reader.done) break;
      if (opts.tick) await opts.tick();
    }
    if (!reader.done) {
      reader.feed(dec.decode());
      reader.end();
    }
  } finally {
    stream.destroy();
  }
}

/** The connector's file key: sha256 of the first MiB, 16 hex characters, "-" and the size. */
export async function fileSha(file: string): Promise<string> {
  const fh = await open(file, "r");
  try {
    const buf = Buffer.alloc(1 << 20);
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    const size = (await stat(file)).size;
    return `${createHash("sha256").update(buf.subarray(0, bytesRead)).digest("hex").slice(0, 16)}-${size}`;
  } finally {
    await fh.close();
  }
}

/* ── the three files ───────────────────────────────────────────────────── */

/** fct_orderlinehist -> one record per order (latest row per line wins). rows = data rows read. */
export async function collapseFctFile(file: string, tick?: () => Promise<void>): Promise<{ rows: number; orders: Map<string, FctOrder> }> {
  const orders = new Map<string, FctOrder>();
  let rows = 0;
  let header = true;
  await readCsvFile(file, { fatal: true, tick }, (row) => {
    if (header) { header = false; return; }
    rows += 1;
    addFctRow(orders, row);
  });
  return { rows, orders };
}

/** dim_article -> [profit centre, article number, text] for the keys asked; stops once all are found. */
export async function articleLookup(file: string | undefined, keys: ReadonlySet<string>, tick?: () => Promise<void>): Promise<Map<string, ArtInfo>> {
  const out = new Map<string, ArtInfo>();
  if (!keys.size || !file) return out;
  try { await stat(file); } catch { return out; }
  let header = true;
  await readCsvFile(file, { fatal: true, tick }, (row) => {
    if (header) { header = false; return; }
    if (row.length >= 27 && keys.has(row[0])) {
      out.set(own(row[0]), [own(pyStrip(row[6])), own(pyStrip(row[2])), own(pyStrip(row[3]))]);
      if (out.size === keys.size) return false;
    }
  });
  return out;
}

/** dim_order as csv.DictReader reads it: by column name (the last of a repeated name), blank lines skipped. */
export async function readDimOrder(file: string, onRow: (get: Get) => void, tick?: () => Promise<void>): Promise<number> {
  let cols: Map<string, number> | null = null;
  let rows = 0;
  let cur: string[] = [];
  const get: Get = (name) => {
    const i = cols!.get(name);
    return i === undefined || i >= cur.length ? "" : cur[i];
  };
  await readCsvFile(file, { fatal: false, translateNewlines: true, tick }, (row) => {
    if (!cols) {
      cols = new Map();
      row.forEach((name, i) => cols!.set(name, i));
      return;
    }
    if (!row.length) return;
    rows += 1;
    cur = row;
    onRow(get);
  });
  return rows;
}

/** stage_load's targets: order number -> stage id. `only` keeps just those orders (the second, new-orders pass). */
export async function stageTargetsFromFile(file: string, only?: ReadonlySet<string> | null, tick?: () => Promise<void>): Promise<{ targets: Map<string, string>; cancelled: number; rows: number }> {
  const targets = new Map<string, string>();
  let cancelled = 0;
  const rows = await readDimOrder(file, (get) => { cancelled += addStageRow(targets, get, only); }, tick);
  return { targets, cancelled, rows };
}

/** order_sync's targets: order number -> packed (person, shipment date, status); the last row of a number wins. */
export async function detailTargetsFromFile(file: string, only?: ReadonlySet<string> | null, tick?: () => Promise<void>): Promise<{ targets: Map<string, string>; rows: number }> {
  const targets = new Map<string, string>();
  const rows = await readDimOrder(file, (get) => {
    const on = dimOrderNumber(get);
    if (!on || (only && !only.has(on))) return;
    targets.set(own(on), packDetail(detailOfRow(get, on)));
  }, tick);
  return { targets, rows };
}
