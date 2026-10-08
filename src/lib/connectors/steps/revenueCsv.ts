// READING revenue_oi_rollup.csv - the ERP's revenue rollup, ";"-separated, with a
// UTF-8 BOM, read the way the connector's csv.DictReader reads it: the first line
// names the columns, a short line leaves the rest empty, a long one drops the extra,
// blank lines are skipped, a stray quote inside a field is kept as text. Streamed,
// so the file never sits in memory whole - only the per-customer sums do.
// Relative imports only (the tests and the parity check run it as it is).

import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import { addRollupRow, newRollup, type Rollup, type RollupRow } from "./revenueRules";

export const ROLLUP_CSV_OPTIONS = {
  delimiter: ";",
  bom: true,
  columns: true,
  relax_quotes: true,
  relax_column_count: true,
  skip_empty_lines: true,
} as const;

/** The whole file summed per customer, year, month and profit centre; `tick` every 50,000 records; `oi` keeps order intake too. */
export async function readRollup(file: string, tick?: () => Promise<void>, oi = true): Promise<Rollup & { lines: number }> {
  const acc = newRollup(oi);
  let lines = 0;
  const parser = createReadStream(file).pipe(parse(ROLLUP_CSV_OPTIONS));
  for await (const r of parser as AsyncIterable<RollupRow>) {
    lines += 1;
    addRollupRow(acc, r, lines);
    if (tick && lines % 50_000 === 0) await tick();
  }
  return { ...acc, lines };
}
