import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  articleLookup, collapseFctFile, detailTargetsFromFile, fileSha, parseCsvText, PyCsvReader, stageTargetsFromFile,
} from "../src/lib/connectors/steps/orderFiles";
import {
  CANCELLED, FCT, SMAP, STAGE_ENTERED, addFctRow, addStageRow, baseOf000, candidates, dedupDecision, deliveryBases, detailUpdate,
  dkey, enrichPayload, epochDay, erpStatus, fixSplitQty, fnum, hsDate, isDeliveryOf, orderPayload, own, personFromReference,
  positionsJson, pyRepr, pyRound, pySum, shipIso, stageUpdate, unpackDetail, wantedTitle, webCarry,
  type FctOrder, type FixMap, type Get, type LiveLine,
} from "../src/lib/connectors/steps/orderRules";

const FIXMAP = JSON.parse(readFileSync(join(process.cwd(), "src/lib/connectors/data/article_fixmap.json"), "utf8")) as FixMap;

/* ── Python's arithmetic ───────────────────────────────────────────────── */

test("round(): the exact binary value, ties to even", () => {
  assert.equal(pyRound(2.675, 2), 2.67); // 2.67499999... in binary
  assert.equal(pyRound(10.125, 2), 10.12); // an exact tie -> even
  assert.equal(pyRound(10.135, 2), 10.13); // not a tie: 10.1349999...
  assert.equal(pyRound(0.375, 2), 0.38);
  assert.equal(pyRound(-10.125, 2), -10.12);
  assert.equal(pyRound(2.5, 0), 2);
  assert.equal(pyRound(0.0625, 3), 0.062);
  assert.ok(Object.is(pyRound(-0.001, 2), -0));
});

test("repr(): what Python's JSON carried", () => {
  assert.equal(pyRepr(5), "5.0");
  assert.equal(pyRepr(1500.5), "1500.5");
  assert.equal(pyRepr(-0), "-0.0");
  assert.equal(pyRepr(1e16), "1e+16");
  assert.equal(pyRepr(1e15), "1000000000000000.0");
  assert.equal(pyRepr(0.0001), "0.0001");
  assert.equal(pyRepr(0.00001), "1e-05");
  assert.equal(pyRepr(0.1 + 0.2), "0.30000000000000004");
});

test("sum(): compensated like Python 3.12", () => {
  assert.equal(pySum(Array(10).fill(0.1)), 1); // naive addition gives 0.9999999999999999
  assert.equal(pySum([1e16, 1, -1e16]), 1);
  assert.equal(pySum([]), 0);
});

test("_fnum: comma decimals, junk and blanks are 0", () => {
  assert.equal(fnum("1,5"), 1.5);
  assert.equal(fnum("1_000"), 1000);
  assert.equal(fnum(" 2 "), 2);
  assert.equal(fnum(""), 0);
  assert.equal(fnum("abc"), 0);
  assert.equal(fnum("1,234,5"), 0);
});

/* ── the CSV reader is Python's ────────────────────────────────────────── */

test("csv: Python's reader, not csv-parse's, on malformed quoting", () => {
  assert.deepEqual(parseCsvText('"abc"def;x\n'), [["abcdef", "x"]]);
  assert.deepEqual(parseCsvText('"a"b"c";d\n'), [['ab"c"', "d"]]);
  assert.deepEqual(parseCsvText('a;b"c;d\n'), [["a", 'b"c', "d"]]);
  assert.deepEqual(parseCsvText('a;"bc\n'), [["a", "bc\n"]]); // unterminated at the end: kept
  assert.deepEqual(parseCsvText("a;b\n\n \nc"), [["a", "b"], [], [" "], ["c"]]);
  assert.deepEqual(parseCsvText('"x\r\ny";z\r\n'), [["x\r\ny", "z"]]);
  assert.deepEqual(parseCsvText('"x\r\ny";z\r\n', { translateNewlines: true }), [["x\ny", "z"]]);
});

test("csv: pieces of any size read the same as the whole", () => {
  const text = '"a;""b""\r\nc";d\r\ne;"f"\rg;h\n"unterminated';
  const whole = parseCsvText(text);
  for (const size of [1, 2, 3, 5, 7]) {
    const rows: string[][] = [];
    const r = new PyCsvReader((row) => { rows.push(row); });
    for (let i = 0; i < text.length; i += size) r.feed(text.slice(i, i + size));
    r.end();
    assert.deepEqual(rows, whole, `pieces of ${size}`);
  }
});

test("own(): a copy, equal in value", () => {
  const big = "x".repeat(100) + "A26.659972.000" + "y".repeat(100);
  const cut = big.slice(100, 114);
  assert.equal(own(cut), "A26.659972.000");
  assert.equal(own("short"), "short");
});

/* ── the delta fact, collapsed ─────────────────────────────────────────── */

function fctRow(on: string, line: string, o: Partial<Record<keyof typeof FCT, string>> = {}): string[] {
  const r = Array<string>(58).fill("");
  r[FCT.TRANS] = o.TRANS ?? "07.10.2026"; r[FCT.CN] = o.CN ?? "100"; r[FCT.CUSTUNIQ] = o.CUSTUNIQ ?? "100-500001";
  r[FCT.ON] = on; r[FCT.LINE] = line; r[FCT.ARTKEY] = o.ARTKEY ?? "K1"; r[FCT.ARTNO] = o.ARTNO ?? "111";
  r[FCT.OQ] = o.OQ ?? "1"; r[FCT.SQ] = o.SQ ?? "0"; r[FCT.NRLC] = o.NRLC ?? "10"; r[FCT.COGSLC] = o.COGSLC ?? "4";
  r[FCT.NRTC] = o.NRTC ?? ""; r[FCT.MEUR] = o.MEUR ?? "6"; r[FCT.OCREATE] = o.OCREATE ?? "06.10.2026 10:00:00"; r[FCT.DEL] = o.DEL ?? "";
  return r;
}
const collapse = (rows: string[][]) => { const m = new Map<string, FctOrder>(); for (const r of rows) addFctRow(m, r); return m; };
const line = (o: FctOrder, ln: string) => o.lines.get(ln) as LiveLine;

test("collapse: the latest row per line wins, a same-day later row too, an older one never", () => {
  const m = collapse([
    fctRow("A26.1.000", "10", { TRANS: "05.10.2026", NRLC: "50" }),
    fctRow("A26.1.000", "10", { TRANS: "2026-10-07", NRLC: "150" }),
    fctRow("A26.1.000", "10", { TRANS: "06.10.2026", NRLC: "999" }),
    fctRow("A26.1.000", "20", { NRLC: "10" }),
    fctRow("A26.1.000", "20", { NRLC: "20" }),
  ]);
  assert.equal(line(m.get("A26.1.000")!, "10").rlc, 150);
  assert.equal(line(m.get("A26.1.000")!, "20").rlc, 20);
  assert.equal(dkey("07.10.2026 12:00"), "20261007");
  assert.equal(dkey("2026-10-07"), "20261007");
});

test("collapse: delete_flag=Y removes the line; mandant 100/110 only; the first row keeps the customer", () => {
  const m = collapse([
    fctRow("A26.2.000", "10", { TRANS: "06.10.2026" }),
    fctRow("A26.2.000", "10", { TRANS: "07.10.2026", DEL: "Y" }),
    fctRow("A26.2.000", "20", { TRANS: "05.10.2026", DEL: "Y" }),
    fctRow("A26.2.000", "20", { TRANS: "06.10.2026", CUSTUNIQ: "100-999" }),
    fctRow("A26.3.000", "10", { CN: "120" }),
    fctRow("A26.4.000", "10", { CN: " 100" }),
    fctRow("  ", "10"),
  ]);
  assert.deepEqual([...m.keys()], ["A26.2.000"]);
  const o = m.get("A26.2.000")!;
  assert.equal(o.lines.get("10")!.gone, true);
  assert.equal(o.lines.get("20")!.gone, false);
  assert.equal(o.custuniq, "100-500001");
});

test("candidates: value beyond 0.005; a .000 created over 7 days before the newest is stale", () => {
  const m = collapse([
    fctRow("A26.5.000", "10", { NRLC: "0.005" }),
    fctRow("A26.6.000", "10", { NRLC: "0.006" }),
    fctRow("A26.7.000", "10", { OCREATE: "29.09.2026" }),
    fctRow("A26.8.000", "10", { OCREATE: "30.09.2026" }),
    fctRow("A26.9.001", "10", { OCREATE: "01.01.2026" }), // deliveries are complete by construction
    fctRow("A26.10.000", "10", { OCREATE: "07.10.2026" }),
  ]);
  const { cand, staleBase } = candidates(m);
  assert.deepEqual([...cand.keys()].sort(), ["A26.10.000", "A26.6.000", "A26.8.000", "A26.9.001"]);
  assert.equal(staleBase, 1);
  assert.equal(epochDay("06.10.2026 10:00:00"), Date.UTC(2026, 9, 6));
  assert.equal(epochDay("31.04.2026"), null);
});

/* ── the payload ───────────────────────────────────────────────────────── */

const ART = new Map<string, readonly [string, string, string]>([["K1", ["KT", "8000000001", "O-Ring"]], ["K2", ["XX", "8000000002", "Odd"]]]);

test("split delivery: shipped quantities when any shipped, else the ordered quantity once", () => {
  const m = collapse([
    fctRow("A26.20.000", "20.000", { OQ: "1500", SQ: "1000" }),
    fctRow("A26.20.000", "20.010", { OQ: "1500", SQ: "500" }),
    fctRow("A26.20.000", "30.000", { OQ: "200", SQ: "0" }),
    fctRow("A26.20.000", "30.010", { OQ: "200", SQ: "" }),
    fctRow("A26.20.000", "40", { OQ: "7", SQ: "7" }),
  ]);
  const lines = [...m.get("A26.20.000")!.lines.entries()].sort() as [string, LiveLine][];
  assert.deepEqual(fixSplitQty(lines), [1000, 500, 200, 0, 7]);
  const p = orderPayload("A26.20.000", m.get("A26.20.000")!, { art: ART, fixmap: FIXMAP, companyName: "" });
  assert.equal(p.order_total_qty, "1707.0");
});

test("payload: every property orders_daily writes, as Python's JSON carried it", () => {
  const m = collapse([
    fctRow("A26.30.000", "10", { NRLC: "100.5", COGSLC: "60.25", NRTC: "120.6", MEUR: "33.1", OQ: "5" }),
    fctRow("A26.30.000", "20", { ARTKEY: "NOKEY", ARTNO: "22407406", NRLC: "10.125", COGSLC: "4", OQ: "2,5" }), // fixmap -> AT
  ]);
  const p = orderPayload("A26.30.000", m.get("A26.30.000")!, { art: ART, fixmap: FIXMAP, companyName: "Caran d'Ache SA" });
  assert.equal(p.hs_order_name, "A26.30.000 | Caran d'Ache SA");
  assert.equal(p.hs_pipeline, "3687945443");
  assert.equal(p.hs_pipeline_stage, STAGE_ENTERED);
  assert.equal(p.order_order_type, "Order");
  assert.equal(p.order_customer_number, "500001");
  assert.equal(p.order_mandant, "100");
  assert.equal(p.order_total_net_revenue, "110.62"); // 110.625 is a tie -> even
  assert.equal(p.hs_total_price, "120.6");
  assert.equal(p.order_line_count, "2");
  assert.equal(p.order_order_date, String(Date.UTC(2026, 9, 6)));
  assert.equal(p.order_line_01_article, "8000000001");
  assert.equal(p.order_line_01_pc, "KT");
  assert.equal(p.order_line_01_gm, "40.0");
  assert.equal(p.order_line_02_article, "8001219968");
  assert.equal(p.order_line_02_pc, "AT");
  assert.equal(p.order_line_02_qty, "2.5");
  assert.equal(p.order_profit_center, "KT"); // dominant by revenue
  assert.ok(p.order_positions_json.startsWith('[{"a": "8000000001", "q": 5.0, "r": 100.5, "gm": 40.0, "pc": "KT", "t": "O-Ring"}, {"a": "8001219968", "q": 2.5, "r": 10.12'));
  const e = enrichPayload(p);
  for (const k of ["hs_order_name", "hs_pipeline", "hs_pipeline_stage", "order_order_number"]) assert.ok(!(k in e));
  assert.equal(e.order_total_net_revenue, "110.62");
});

test("payload: credit notes, the profit-centre guard, absent Nones, 80 line properties", () => {
  const g = collapse([fctRow("G26.1.000", "10", { NRLC: "25" }), fctRow("A26.2.000", "10", { NRLC: "-5", COGSLC: "-1" })]);
  assert.equal(orderPayload("G26.1.000", g.get("G26.1.000")!, { art: ART, fixmap: FIXMAP, companyName: "" }).order_order_type, "Credit note");
  const neg = orderPayload("A26.2.000", g.get("A26.2.000")!, { art: ART, fixmap: FIXMAP, companyName: "" });
  assert.equal(neg.order_order_type, "Credit note");
  assert.equal(neg.hs_order_name, "A26.2.000");
  const odd = collapse([fctRow("A26.3.000", "10", { ARTKEY: "K2", NRLC: "-500" }), fctRow("A26.3.000", "20", { NRLC: "300", CUSTUNIQ: "" })]);
  const po = orderPayload("A26.3.000", odd.get("A26.3.000")!, { art: ART, fixmap: FIXMAP, companyName: "" });
  assert.equal(po.order_profit_center, "Unknown");
  const zero = collapse([fctRow("A26.4.000", "10", { NRLC: "0", CUSTUNIQ: "" })]);
  const pz = orderPayload("A26.4.000", zero.get("A26.4.000")!, { art: new Map(), fixmap: FIXMAP, companyName: "" });
  assert.ok(!("order_avg_gm_pct" in pz) && !("order_customer_number" in pz) && !("order_line_01_gm" in pz) && !("order_profit_center" in pz));
  assert.equal(pz.order_line_01_article, "111"); // nothing known: the raw number
  const many = collapse(Array.from({ length: 86 }, (_, i) => fctRow("A26.5.000", String(i + 1))));
  const pm = orderPayload("A26.5.000", many.get("A26.5.000")!, { art: ART, fixmap: FIXMAP, companyName: "" });
  assert.equal(pm.order_line_count, "86");
  assert.ok("order_line_80_article" in pm && !("order_line_81_article" in pm));
  assert.equal(JSON.parse(pm.order_positions_json).length, 86);
  assert.equal(pm.order_line_01_article, "8000000001");
  assert.equal(positionsJson([]), "[]");
});

/* ── the .000 guard ────────────────────────────────────────────────────── */

test(".000: archived when the deliveries cover it within max(0.5, 0.5%), reduced to the remainder, else kept", () => {
  assert.equal(dedupDecision(150, [100, 50]).action, "archive");
  assert.equal(dedupDecision(100.3, [40, 60]).action, "archive");
  assert.equal(dedupDecision(1004.9, [1000]).action, "archive");
  assert.deepEqual(dedupDecision(1005.1, [1000]), { action: "reduce", sfx: 1000, remainder: 5.1 });
  assert.deepEqual(dedupDecision(100, [40]), { action: "reduce", sfx: 40, remainder: 60 });
  assert.equal(dedupDecision(100, [300]).action, "keep");
  assert.equal(dedupDecision(100, []).action, "keep");
  assert.equal(dedupDecision(0, [0.2]).action, "archive");
  assert.deepEqual(deliveryBases(["A26.1.001", "A26.1.002", "A26.2.000", "A26.3", "B.4.010"]), ["A26.1", "B.4"]);
  assert.ok(isDeliveryOf("A26.1.002", "A26.1") && !isDeliveryOf("A26.1.000", "A26.1") && !isDeliveryOf("A26.10.001", "A26.1"));
  assert.equal(baseOf000("A26.1.000"), "A26.1");
  assert.deepEqual(webCarry({ order_web_order_number: "3000123", order_doc_request: "yes", order_doc_status: "", other: "x" }), { order_web_order_number: "3000123", order_doc_request: "yes" });
});

/* ── stages and order details from dim_order ───────────────────────────── */

const getter = (o: Record<string, string>): Get => (k) => o[k] ?? "";
const dimRow = (on: string, status: string, extra: Record<string, string> = {}) =>
  getter({ CompanyNumber: "100", src_current_flag: "Y", OrderNumber: on, OrderStatus: status, ...extra });

test("stages: SMAP, Cancelled for Inactive=J / DeletedOrder=Y, an unknown status keeps an earlier target", () => {
  const t = new Map<string, string>();
  let c = 0;
  c += addStageRow(t, dimRow("A1", " Invoiced "));
  c += addStageRow(t, dimRow("A2", "completed")); // Invoiced here - order_sync leaves it blank
  c += addStageRow(t, dimRow("A3", "ready for tour"));
  c += addStageRow(t, dimRow("A4", "pending", { Inactive: "J" }));
  c += addStageRow(t, dimRow("A5", "entered", { DeletedOrder: "Y" }));
  c += addStageRow(t, dimRow("A1", "weird"));
  c += addStageRow(t, dimRow("A6", "invoiced", { CompanyNumber: "120" }));
  c += addStageRow(t, dimRow("A7", "invoiced", { src_current_flag: "N" }));
  c += addStageRow(t, dimRow("A8", "invoiced", { src_current_flag: "" }));
  assert.deepEqual(Object.fromEntries(t), { A1: SMAP.invoiced, A2: SMAP.invoiced, A3: "5093092549", A4: CANCELLED, A5: CANCELLED, A8: SMAP.invoiced });
  assert.equal(c, 2);
  assert.equal(stageUpdate(SMAP.invoiced, SMAP.invoiced), null);
  assert.equal(stageUpdate("", SMAP.entered), SMAP.entered);
  assert.equal(stageUpdate(SMAP.entered, undefined), null);
});

test("status: the enum, its aliases, G is a credit note, completed stays blank", () => {
  assert.equal(erpStatus("being delivered", "A1"), "being_delivered");
  assert.equal(erpStatus("ready for tour", "A1"), "ready_for_delivery");
  assert.equal(erpStatus("credited", "A1"), "credit_note");
  assert.equal(erpStatus("partially called off", "A1"), "partial_called_off");
  assert.equal(erpStatus("invoiced", " g26.1.000"), "credit_note");
  assert.equal(erpStatus("completed", "R24.1.000"), "");
  assert.equal(erpStatus("weird", "A1"), "");
  assert.equal(erpStatus("", "A1"), "");
});

test("person: two or three name words, no role/company/department words", () => {
  assert.equal(personFromReference("Thorsten Schneider / 4500123"), "Thorsten Schneider");
  assert.equal(personFromReference("THORSTEN SCHNEIDER"), "Thorsten Schneider");
  assert.equal(personFromReference("Sébastien MAGRO / PO 77"), "Sébastien Magro");
  assert.equal(personFromReference("anna maria rossi"), "Anna Maria Rossi");
  assert.equal(personFromReference("J.-P. Dupont"), "J.-p. Dupont"); // Python lowercases after the first letter of an all-caps word
  assert.equal(personFromReference("Peter Müller"), "Peter Müller");
  for (const no of ["Einkauf SABA / 45006812", "LEVO AG / 703330", "Restlieferung / A26.585051", "Hans", "Hans Peter Muster Meier", "A. B.",
    "Bauamt Thun", "Hans Steueramt", "Ospedale Civico", "Max Mustermann 2", "Иван Петров", "Peter Ordering", "Purchasing Dept", ""]) {
    assert.equal(personFromReference(no), "", no);
  }
});

test("title: 'A# | Person | Company', the company from the current title, stubs without an A-number untouched", () => {
  assert.equal(wantedTitle("A26.1.000", "A26.1.000 | Caran d'Ache", "Thorsten Schneider"), "A26.1.000 | Thorsten Schneider | Caran d'Ache");
  assert.equal(wantedTitle("A26.1.000", "A26.1.000 | Old Person | Firma AG", "New Person"), "A26.1.000 | New Person | Firma AG");
  assert.equal(wantedTitle("A26.1.000", "A26.1.000 | Firma AG", ""), "A26.1.000 | Firma AG");
  assert.equal(wantedTitle("A26.1.000", "Magento order (3000123) - to be overwritten", "Hans Muster"), "A26.1.000 | Hans Muster");
  // the connector's own quirk, kept for parity: a title without a company reads its person as the company next time
  assert.equal(wantedTitle("A26.1.000", "A26.1.000 | Hans Muster", "Hans Muster"), "A26.1.000 | Hans Muster"); // fixed 08.10.2026 - the connector doubled the person
  const row = { num: "A26.1.000", title: "A26.1.000 | Firma", ship: "2026-01-01", status: "entered" };
  assert.deepEqual(detailUpdate(row, { person: "Hans Muster", ship: "2026-02-01", status: "invoiced" }),
    { hs_order_name: "A26.1.000 | Hans Muster | Firma", order_shipment_date: "2026-02-01", order_order_status: "invoiced" });
  assert.equal(detailUpdate({ ...row, title: "A26.1.000 | Hans Muster | Firma" }, { person: "Hans Muster", ship: null, status: "" }), null);
  assert.equal(detailUpdate({ ...row, num: "" }, undefined), null); // a web stub has no A-number, so no target
  assert.equal(shipIso("01.02.2026 00:00:00"), "2026-02-01");
  assert.equal(shipIso("31.12.1989"), null);
  assert.equal(shipIso("1.2.2026"), null);
  assert.equal(hsDate("1769904000000"), "2026-02-01");
  assert.equal(hsDate("2026-02-01T00:00:00Z"), "2026-02-01");
});

/* ── the files ─────────────────────────────────────────────────────────── */

test("files: fact, articles and dim_order read as the connector reads them", async () => {
  const dir = mkdtempSync(join(tmpdir(), "orders-test-"));
  try {
    const fct = join(dir, "fct.csv");
    const rows = [fctRow("A26.1.000", "10", { NRLC: "12" }), fctRow("A26.1.000", "20", { ARTKEY: "K2", NRLC: "8" }), ["short", "row"]];
    rows[0][FCT.SHORT] = '"quoted; with\r\nnewline"';
    writeFileSync(fct, "﻿" + Array(58).fill("h").join(";") + "\r\n" + rows.map((r) => r.join(";")).join("\r\n") + "\r\n");
    const { rows: n, orders } = await collapseFctFile(fct);
    assert.equal(n, 3);
    assert.equal(orders.get("A26.1.000")!.lines.size, 2);
    assert.match(await fileSha(fct), /^[0-9a-f]{16}-\d+$/);

    const art = join(dir, "dim_article.csv");
    const a = (k: string, no: string, t: string, pc: string) => { const r = Array(30).fill(""); r[0] = k; r[2] = no; r[3] = t; r[6] = pc; return r.join(";"); };
    writeFileSync(art, "﻿hdr\n" + [a("K1", " 800 ", "first", "KT"), a("K1", "801", "second", "KT"), a("K2", "802", "x", " FT "), a("K3", "803", "never read", "DT")].join("\n"));
    const got = await articleLookup(art, new Set(["K1", "K2"]));
    assert.deepEqual(Object.fromEntries(got), { K1: ["KT", "801", "second"], K2: ["FT", "802", "x"] });
    assert.equal((await articleLookup(join(dir, "missing.csv"), new Set(["K1"]))).size, 0);

    const dim = join(dir, "dim_order.csv");
    const hdr = ["CompanyNumber", "OrderNumber", "OrderStatus", "YourReference", "ShipmentDate", "src_current_flag", "Inactive", "OrderStatus"];
    const lines = [
      ["100", "A26.1.000", "x", "Hans Muster / 1", "01.02.2026 00:00:00", "Y", "", "invoiced"], // the LAST OrderStatus column counts
      ["110", "A26.2.000", "", '"Anna\r\nMeier"', "", "", "J", "entered"],
      ["120", "A26.3.000", "", "", "", "Y", "", "invoiced"],
    ];
    writeFileSync(dim, Buffer.concat([Buffer.from("﻿" + hdr.join(";") + "\r\n" + lines.map((l) => l.join(";")).join("\r\n") + "\r\n\r\n", "utf8"), Buffer.from([0xff, 0x0a])]));
    const st = await stageTargetsFromFile(dim);
    assert.deepEqual(Object.fromEntries(st.targets), { "A26.1.000": SMAP.invoiced, "A26.2.000": CANCELLED });
    assert.equal(st.cancelled, 1);
    const only = await stageTargetsFromFile(dim, new Set(["A26.2.000"]));
    assert.deepEqual([...only.targets.keys()], ["A26.2.000"]);
    const dt = await detailTargetsFromFile(dim);
    assert.deepEqual(unpackDetail(dt.targets.get("A26.1.000")), { person: "Hans Muster", ship: "2026-02-01", status: "invoiced" });
    assert.deepEqual(unpackDetail(dt.targets.get("A26.2.000")), { person: "Anna Meier", ship: null, status: "entered" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("titles: the person is never read back as the company, and doubled titles are repaired (fix 08.10.2026)", () => {
  // the connector's bug: "A# | Person" became "A# | Person | Person"
  assert.equal(wantedTitle("A26.1", "A26.1 | Hans Muster", "Hans Muster"), "A26.1 | Hans Muster");
  // already damaged -> repaired
  assert.equal(wantedTitle("A26.1", "A26.1 | Hans Muster | Hans Muster", "Hans Muster"), "A26.1 | Hans Muster");
  // a real company stays, with or without a person
  assert.equal(wantedTitle("A26.1", "A26.1 | Metallbau AG", "Hans Muster"), "A26.1 | Hans Muster | Metallbau AG");
  assert.equal(wantedTitle("A26.1", "A26.1 | Hans Muster | Metallbau AG", "Hans Muster"), "A26.1 | Hans Muster | Metallbau AG");
  assert.equal(wantedTitle("A26.1", "A26.1 | Metallbau AG", ""), "A26.1 | Metallbau AG");
  // a new person on an order whose old title held another person: the old one was the company slot
  assert.equal(wantedTitle("A26.1", "A26.1 | Anna Keller | Metallbau AG", "Hans Muster"), "A26.1 | Hans Muster | Metallbau AG");
  // titles not starting with the order number give no company, as before
  assert.equal(wantedTitle("A26.1", "Magento order (123) - to be overwritten", "Hans Muster"), "A26.1 | Hans Muster");
});
