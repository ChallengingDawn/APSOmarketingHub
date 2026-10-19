// DIRECTUP NAMES (SARCLA 19.10.2026: a C2S article typed into DirectUP "is not showing the customer any
// information - we should have the name of the article in here (material + dimensions)"; asked where the name
// should come from: "nightly").
//
// The shop's ERP route prices a cut or customer-special article but sends no name, and DirectUP's catalogue copy
// (from PricingHub) lists the standard range only - so 8001255779 read "C2S plastics" and nothing more. The ERP's
// dim_article has the text of every article ("PE-HD 1000 natur # 500 x 300 x 10 mm -"). This step sends DirectUP
// (the DirectUp Gateway on Railway, POST /api/admin/names with DIRECTUP_ADMIN_KEY) the text of every cut article
// (8001…, ~120,000 in August's file). Cut articles only: their text is material and size; a customer's own special
// (8000…) can carry the customer's drawing or reference, and DirectUP's name lookup is as public as the tool.
//
//   everything     while the gateway holds far fewer names than that (its first night), and on Sundays
//   otherwise      the articles the ERP created or changed in the last three days
//
// The gateway keeps the best row per article as the article step ranks them (active first, then the newest
// dss_update_time), so a re-send never puts an older text back. Read as the article step reads the file: strict
// UTF-8, Python's csv rules. Preview reads and counts; it sends nothing.

import { readCsvFile } from "./orderFiles";
import { pyStrip } from "./orderRules";
import { toMs } from "./filesRules";
import { adminKey, gateway } from "@/lib/directup/gateway";
import type { StepResult } from "./companyFacts";

type Beat = () => Promise<void>;
type NameRow = { n: string; t: string; a: boolean; u: number };

const CHUNK = 5000;
const RECENT_MS = 3 * 86_400_000;
/** Below this the gateway is missing most names: everything goes. */
const FULL_BELOW = 50_000;

export async function directupNames(live: boolean, beat: Beat, opts: { file: string; now?: number }): Promise<StepResult> {
  const now = opts.now ?? Date.now();
  if (live && !adminKey()) throw new Error("DIRECTUP_ADMIN_KEY is not set on the hub");
  let before: number | null = null;
  if (adminKey()) {
    try { before = (await gateway<{ count: number }>("/names/status", { timeoutMs: 30_000 })).count; }
    catch (e) { if (live) throw e; }
  }
  const sunday = new Date(now).getUTCDay() === 0;
  const full = before === null || before < FULL_BELOW || sunday;
  const since = now - RECENT_MS;

  let ix: Map<string, number> | null = null;
  let iArt = -1, iText = -1, iType = -1, iInact = -1, iUpd = -1, iCre = -1;
  let rows = 0, kept = 0, standard = 0, noText = 0, older = 0;
  let sent = 0, written = 0, failed = 0, requests = 0;
  const errors: string[] = [];
  const examples: { article: string; name: string }[] = [];
  let buf: NameRow[] = [];

  const send = async (part: NameRow[]) => {
    requests += 1;
    if (!live) return;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const r = await gateway<{ written: number }>("/names", { method: "POST", body: { rows: part }, timeoutMs: 60_000 });
        sent += part.length;
        written += r.written ?? 0;
        return;
      } catch (e) {
        if (attempt === 2) {
          failed += part.length;
          if (errors.length < 3) errors.push((e as Error).message.slice(0, 160));
        }
      }
    }
  };
  const flush = async (all: boolean) => {
    while (buf.length >= CHUNK || (all && buf.length)) {
      const part = buf.slice(0, CHUNK);
      buf = buf.slice(CHUNK);
      await send(part);
    }
  };

  await readCsvFile(opts.file, {
    fatal: true,
    // the reader hands rows over between 1 MB chunks; this is where they leave, 5,000 at a time
    tick: async () => { await beat(); if (buf.length >= CHUNK) await flush(false); },
  }, (row) => {
    if (!ix) {
      ix = new Map(row.map((h, i) => [pyStrip(h.replace(/^﻿/, "")), i]));
      const need = ["ArticleNumber", "ArticleText", "ArticleType"].filter((c) => !ix!.has(c));
      if (need.length) throw new Error(`dim_article without the ${need.join(", ")} column${need.length > 1 ? "s" : ""}`);
      iArt = ix.get("ArticleNumber")!; iText = ix.get("ArticleText")!; iType = ix.get("ArticleType")!;
      iInact = ix.get("ArticleIsInactive") ?? -1; iUpd = ix.get("dss_update_time") ?? -1; iCre = ix.get("dss_create_time") ?? -1;
      return;
    }
    rows += 1;
    const at = (i: number) => (i >= 0 && i < row.length ? row[i] : "");
    const art = pyStrip(at(iArt));
    if (!/^8001[0-9]{6}$/.test(art)) return;
    if (pyStrip(at(iType)) === "Standard") { standard += 1; return; }
    const text = pyStrip(at(iText));
    if (!text) { noText += 1; return; }
    const upd = toMs(at(iUpd)) ?? 0;
    if (!full && Math.max(upd, toMs(at(iCre)) ?? 0) < since) { older += 1; return; }
    kept += 1;
    buf.push({ n: art, t: text.slice(0, 300), a: pyStrip(at(iInact)) === "", u: upd });
    if (examples.length < 5) examples.push({ article: art, name: text });
  });
  await flush(true);

  return {
    mode: full ? (before === null ? "everything (the gateway's count unknown)" : sunday ? "everything (Sunday)" : "everything (the gateway holds few names)") : "changed in the last three days",
    gateway_names_before: before,
    rows_read: rows,
    standard_skipped: standard,
    without_text: noText,
    unchanged_skipped: older,
    names_to_send: kept,
    requests,
    ...(live ? { sent, written, failed } : {}),
    ...(errors.length ? { errors } : {}),
    examples,
  };
}
