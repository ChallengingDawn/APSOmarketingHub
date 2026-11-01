import assert from "node:assert/strict";
import { test } from "node:test";
import { canBeNew, erpOnlyItems, erpOnlyProps, infoColumns, infoRow, mergeInfo, revenueBefore, type ErpInfo } from "../src/lib/connectors/steps/erpOnlyRules";
import { addRollupRow, newRollup } from "../src/lib/connectors/steps/revenueRules";

const HEADER = ["CustomerNumberUnique", "CustomerNumber", "CustomerName", "CountryST", "SA", "SAE", "Channel", "FirstOrderYear"];
const row = (un: string, name: string, cc: string, sae: string, first: string) => [un, un.slice(4), name, cc, "Some Agent", sae, "Online", first];

test("erp-only: the rollup's customers no company carries keep their revenue as their company would", () => {
  const roll = newRollup(false);
  const line = (un: string, y: string, mo: string, pc: string, v: string) => addRollupRow(roll, { CompanyNumber: un.slice(0, 3), CustomerNumberUnique: un, InvoiceYear: y, InvoiceMonth: mo, ProfitCenter: pc, NetRevenueEUR: v });
  line("100-845617", "2026", "10", "DT", "51");
  line("100-845617", "2026", "10", "KT", "9.5");
  line("110-864774", "2026", "10", "DT", "122");
  line("100-700158", "2026", "3", "DT", "498.4");
  const items = erpOnlyItems(roll.agg, ["100-845617", "110-864774", "100-999999"]);
  assert.deepEqual(items.map((i) => i.un), ["100-845617", "110-864774"], "a key the rollup does not have is left out");
  assert.deepEqual(JSON.parse(items[0].months["2026"]), { oct: { dt: 51, kt: 9.5 } });
});

test("erp-only: the customer file's row - SAE, name, country by its code, first order year; empty and Unknown are nothing", () => {
  const c = infoColumns(HEADER)!;
  assert.ok(c);
  assert.equal(infoColumns(["SA", "SAE"]), null, "no key column, nothing kept");
  const [un, i] = infoRow(row("110-864774", "Killinger&Steinbauer GmbH", "de", "Frech Marc", "2026"), c, "2026-11-01")!;
  assert.equal(un, "110-864774");
  assert.deepEqual(i, { name: "Killinger&Steinbauer GmbH", country: "Germany", sae: "Frech Marc", channel: "Online", firstOrderYear: 2026, seen: "2026-11-01" });
  const [, j] = infoRow(row("100-794250", "", "CH", "Unknown", ""), c, "2026-11-01")!;
  assert.equal(j.name, "100-794250", "no name: the key");
  assert.equal(j.sae, null);
  assert.equal(j.firstOrderYear, null);
  assert.equal(infoRow(["", "1", "x"], c, "2026-11-01"), null, "no key, no row");
});

test("erp-only: kept rows - the new ones added, a field left empty keeps what was known, a key a company carries goes", () => {
  const e = (name: string, sae: string | null, seen: string): ErpInfo => ({ name, country: "Switzerland", sae, channel: null, firstOrderYear: null, seen });
  const prev = { "100-1": e("Old name", "Kalt Jan", "2026-10-01"), "100-2": e("Two", "TSA Team", "2026-10-02"), "100-3": e("Three", null, "2026-10-03") };
  const rows = new Map([["100-1", e("100-1", null, "2026-11-01")], ["100-3", e("Three AG", "Borey Jeremy", "2026-11-01")], ["100-4", e("Four", null, "2026-11-01")]]);
  const out = mergeInfo(prev, rows, new Set(["100-2"]));
  assert.deepEqual(Object.keys(out).sort(), ["100-1", "100-3", "100-4"]);
  assert.equal(out["100-1"].name, "Old name");
  assert.equal(out["100-1"].sae, "Kalt Jan");
  assert.equal(out["100-1"].seen, "2026-11-01");
  assert.equal(out["100-3"].sae, "Borey Jeremy");
  const capped = mergeInfo(prev, new Map(), new Set(), 2);
  assert.deepEqual(Object.keys(capped).sort(), ["100-2", "100-3"], "beyond the cap the longest unseen goes first");
});

test("erp-only: read as its company would carry it, and new only without a first order or revenue before the three years", () => {
  const item = { un: "110-864774", months: { "2025": "{}", "2026": JSON.stringify({ oct: { dt: 122 } }) } };
  const info: ErpInfo = { name: "Killinger&Steinbauer GmbH", country: "Germany", sae: "Frech Marc", channel: "Online", firstOrderYear: 2026, seen: "2026-11-01" };
  assert.deepEqual(erpOnlyProps(item, info), {
    name: "Killinger&Steinbauer GmbH", mandant: "M110", country_custom: "Germany", sae_performis: "Frech Marc",
    rev_2025_pc_monthly: "{}", rev_2026_pc_monthly: JSON.stringify({ oct: { dt: 122 } }),
  });
  assert.equal(erpOnlyProps({ un: "100-1", months: {} }, undefined).name, "100-1", "nothing known: the key, no SAE");
  assert.equal(canBeNew(item, info, 2024), true);
  assert.equal(canBeNew(item, { ...info, firstOrderYear: 2019 }, 2024), false, "a first order from 2015 to before the three years");
  assert.equal(canBeNew(item, { ...info, firstOrderYear: 2009 }, 2024), true, "a carried-over first order decides nothing alone");
  const old = { un: "100-2", months: { "2023": JSON.stringify({ may: { kt: 10 } }), "2026": JSON.stringify({ oct: { kt: 5 } }) } };
  assert.equal(revenueBefore(old, 2024), true);
  assert.equal(canBeNew(old, undefined, 2024), false, "revenue before the three years");
  assert.equal(canBeNew(old, undefined, 2023), true);
});
