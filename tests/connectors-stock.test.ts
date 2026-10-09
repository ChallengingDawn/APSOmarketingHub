import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PyCsvReader } from "../src/lib/connectors/steps/filesRules";
import {
  FCT_FILE, FctReader, KeyBridge, fmt, isCrossUnit, keepNewest, normUnit, num, sameNumbers,
  stockHash, stockPayload, sumSnaps, type Snap,
} from "../src/lib/connectors/steps/stockRules";

// The real header of the ERP's stock fact, and its first data row (July delta).
const HEADER = "﻿StockValueDate;dim_date_StockValue_key;WarehouseId;dim_warehouse_key;DispoKopfId;dim_article_key;"
  + "StockQuantity;ArticleConsumption;ArticleMovement;GwstdpCHF;StockValueGWSTDPChf;StockValueGWSTDPEur;delete_date;"
  + "delete_flag;src_record_source;src_load_date;src_start_date;src_end_date;src_current_flag;src_version;src_create_time;src_update_time";
const ROW = "05.07.2026 23:59:59;20260705;1;1;35;1129983;88.0000;0.0000;0.0000;3.5765;314.7320;251.7856;;N;"
  + "STAT.apz_kpi.dk_ds_bestand_verbrauch;05.07.2026 01:34:03;05.07.2026 00:00:00;31.12.2999 00:00:00;Y;2;05.07.2026 01:34:03;05.07.2026 01:34:03";

const rows = (text: string): string[][] => { const r = new PyCsvReader(";"); const out: string[][] = []; r.push(text, out); r.end(out); return out; };
const snap = (date: number, qty: number, extra: Partial<Snap> = {}): Snap => ({ date, qty, cons: 0, mov: 0, gw: null, vchf: 0, veur: 0, ...extra });

test("numbers: the file's dots, a comma, and empty cells", () => {
  assert.equal(num("88.0000"), 88);
  assert.equal(num("3,5765"), 3.5765);
  assert.equal(num(""), null);
  assert.equal(num("  "), null);
  assert.equal(num("n/a"), null);
  assert.equal(num(undefined), null);
});

test("cross-unit: the same nine cases as the APSOAssistant gateway, so one writer per article", () => {
  const cases: [string | null, string | null, boolean][] = [
    ["Kg", "Stk", true], ["kg", "m", true], ["m2", "Stk", true],
    ["Stk", "Pcs", false], ["Pcs", "Stk", false], ["Pcs", "100 Pcs", false], ["kg", "kg", false],
    [null, "Stk", false], ["Kg", null, false],
  ];
  for (const [a, b, want] of cases) assert.equal(isCrossUnit(a, b), want, `${a} -> ${b}`);
  assert.equal(normUnit("Stück"), "pcs");
  assert.equal(normUnit("m²"), "m2");
});

test("the fact: read by header name, BOM and all", () => {
  const [h, r] = rows(`${HEADER}\r\n${ROW}\r\n`);
  const fr = new FctReader(h);
  const got = fr.row(r);
  assert.ok(got);
  assert.equal(got.key, "1129983");
  assert.equal(got.wh, "1");
  assert.deepEqual(got.snap, { date: 20260705, qty: 88, cons: 0, mov: 0, gw: 3.5765, vchf: 314.732, veur: 251.7856 });
});

test("the fact: a deleted row and a row without a key are left out and counted", () => {
  const [h] = rows(`${HEADER}\r\n`);
  const fr = new FctReader(h);
  const cells = ROW.split(";");
  const del = [...cells]; del[13] = "Y";
  const nokey = [...cells]; nokey[5] = "";
  assert.equal(fr.row(del), null);
  assert.equal(fr.row(nokey), null);
  assert.equal(fr.deleted, 1);
  assert.equal(fr.broken, 1);
});

test("the fact: a missing column stops the step instead of reading the wrong one", () => {
  assert.throws(() => new FctReader(["dim_article_key", "WarehouseId"]), new RegExp(FCT_FILE));
});

test("dim_article: only the keys asked for are kept", () => {
  const b = new KeyBridge(["﻿dim_article_key", "DispoKopfId", "ArticleNumber", "ArticleText"]);
  b.add(["1129983", "35", "0111104200", "PTFE 225; quoted"], new Set(["1129983"]));
  b.add(["999", "35", "1120030106", "o-ring"], new Set(["1129983"]));
  assert.deepEqual([...b.map], [["1129983", "0111104200"]]);
});

test("a ROLLING refresh: newer wins, an older delivery never overwrites, an absent article keeps its stock", () => {
  const held = new Map<string, Snap>([["0111104200|1", snap(20260701, 50)], ["0110250005|1", snap(20260701, 2700)]]);
  assert.equal(keepNewest(held, "0111104200|1", snap(20260707, 53.238)), true);   // refreshed today
  assert.equal(keepNewest(held, "0111104200|1", snap(20260705, 99)), false);      // a late, older file
  assert.equal(keepNewest(held, "0111104200|1", snap(20260707, 1)), false);       // the same day again
  assert.equal(held.get("0111104200|1")!.qty, 53.238);
  assert.equal(held.get("0110250005|1")!.qty, 2700);                               // not in today's file: kept, not zeroed
});

test("an article's figures: every warehouse summed, the highest unit cost", () => {
  const a = sumSnaps([snap(20260707, 68.5, { vchf: 1200, veur: 1100, gw: 17.5, cons: 1, mov: -2 }), snap(20260706, 45.913, { vchf: 800, veur: 700, gw: 17.674 })]);
  assert.equal(Number(a.qty.toFixed(3)), 114.413);           // SARCLA's Performis screen: 68.500 + 45.913
  assert.equal(a.vchf, 2000);
  assert.equal(a.gw, 17.674);
  assert.equal(a.warehouses, 2);
  assert.equal(a.latest, 20260707);
  assert.equal(sumSnaps([snap(1, 1)]).gw, null);              // no cost in the file: none invented
});

test("the plate 0111104200 (kg held, sold by the piece): kilograms into stock_quantity", () => {
  const a = sumSnaps([snap(20260707, 53.238, { vchf: 940.93, veur: 760.12, gw: 17.674 })]);
  assert.deepEqual(stockPayload(a, true), {
    stock_value_chf: "940.93", stock_value_eur: "760.12", consumption: "0", stock_movement: "0",
    unit_cost_chf: "17.674", stock_quantity: "53.238",
  });
});

test("the o-ring 1120030106 (Stk/Stk): stock_quantity is the gateway's, never written here", () => {
  const p = stockPayload(sumSnaps([snap(20260707, 2568537, { vchf: 6164.49, gw: 0.0024 })]), false);
  assert.equal("stock_quantity" in p, false);
  assert.equal(p.stock_value_chf, "6164.49");
});

test("numbers as HubSpot takes them", () => {
  assert.equal(fmt(940.9299999, 2), "940.93");
  assert.equal(fmt(-0.00001, 4), "0");
  assert.equal(fmt(2715.515, 4), "2715.515");
});

test("HubSpot already holds it? compared as numbers, a missing value is a difference", () => {
  assert.equal(sameNumbers({ consumption: "0" }, { consumption: "0.0" }), true);
  assert.equal(sameNumbers({ stock_value_chf: "940.93" }, { stock_value_chf: "1029.72" }), false);
  assert.equal(sameNumbers({ stock_quantity: "53.238" }, {}), false);
  assert.equal(sameNumbers({ stock_quantity: "53.238" }, { stock_quantity: "53.2380" }), true);
});

test("the change cache: the same payload, the same key, whatever the order", () => {
  assert.equal(stockHash({ b: "2", a: "1" }), stockHash({ a: "1", b: "2" }));
  assert.notEqual(stockHash({ a: "1" }), stockHash({ a: "2" }));
});

test("the registry: the stock step is hub-only, a chain step, and runs after the article master", () => {
  const reg = readFileSync("src/lib/connectors/steps/registry.ts", "utf8");
  const order = [...reg.matchAll(/\{ key: "([a-z_]+)", cadence: "([a-z0-9]+)"/g)].map((m) => m[1]);
  assert.ok(order.includes("stock_load"));
  assert.ok(order.indexOf("articles") < order.indexOf("stock_load"), "units in HubSpot are fresh before routing on them");
  assert.match(reg, /\{ key: "stock_load", cadence: "chain"[^\n]*hubOnly: true/);
  const run = readFileSync("src/lib/connectors/steps/run.ts", "utf8");
  assert.match(run, /hubOnly/, "the live gate knows a step the connector never had");
});
