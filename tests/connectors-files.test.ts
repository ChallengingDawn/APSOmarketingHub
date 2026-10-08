import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BestArticles, DEFAULT_PIN, PPK_MESSAGE, PyCsvReader, agentColumns, agentDecision, agentIndex, agentOption, agentRow,
  articleKeys, domainProves, fingerprintOf, hostKeyOk, keyInfo, keyText, matchArticle, nameTokens, normalizeName,
  parseMagentoExport, payloadFor, payloadHash, pinOf, planPull, pyCsvRows, pyJsonSorted, stampName, toMs,
  withKnownOptions, zfill,
} from "../src/lib/connectors/steps/filesRules";

const ch = (...cps: number[]) => String.fromCodePoint(...cps);
const BS = ch(92);

/* ── SFTP ───────────────────────────────────────────────────────────────── */

test("file names: the loaders' canonical names, and a workbook keeps its extension", () => {
  assert.equal(normalizeName("sales_order_grid_20261008.XML"), "export.xml");
  assert.equal(normalizeName("Revenue with profit center 2026-10-08.csv"), "revenue_oi_rollup.csv");
  assert.equal(normalizeName("Revenue with Profit Center.xlsx"), "revenue_profit_center.xlsx");
  // the connector named these .xlsx, which then could not be opened as one
  assert.equal(normalizeName("Revenue with Profit Center.xlsb"), "revenue_profit_center.xlsb");
  assert.equal(normalizeName("revenue with profit center.XLS"), "revenue_profit_center.xls");
  assert.equal(normalizeName("revenue_OI_2026.csv"), "revenue_oi_rollup.csv");
  assert.equal(normalizeName("dim_article.csv"), "dim_article.csv");
});

test("pull plan: unchanged files skipped by [size, mtime], folders never entered, names normalised", () => {
  const p = planPull([
    { name: "dim_article.csv", size: 10, mtime: 100, type: "-" },
    { name: "dim_order.csv", size: 20, mtime: 200, type: "-" },
    { name: "archive", size: 4096, mtime: 1, type: "d" },
    { name: "Orders.xml", size: 5, mtime: 9, type: "-" },
  ], { "dim_article.csv": [10, 100], "dim_order.csv": [20, 199] });
  assert.equal(p.skipped, 1);
  assert.equal(p.folders, 1);
  assert.deepEqual(p.todo.map((t) => [t.remote, t.as]), [["dim_order.csv", "dim_order.csv"], ["Orders.xml", "export.xml"]]);
});

const BODY = ["b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW", "QyNTUxOQAAACBmYWtlZmFrZWZha2VmYWtlZmFrZWZha2VmYWtlZmFrZQAAAJhmYWtl"];
const HEAD = "-----BEGIN OPENSSH PRIVATE KEY-----", FOOT = "-----END OPENSSH PRIVATE KEY-----";
const KEY = `${HEAD}\n${BODY[0]}\n${BODY[1]}\n${FOOT}`;

test("key text: literal \\n expanded, a one-line paste rebuilt, a .ppk refused", () => {
  assert.deepEqual(keyText(`${HEAD}${BS}n${BODY[0]}${BS}n${BODY[1]}${BS}n${FOOT}${BS}n`), { ok: true, text: KEY });
  assert.deepEqual(keyText(`  ${HEAD} ${BODY[0]} ${BODY[1]} ${FOOT}  `), { ok: true, text: KEY });
  assert.deepEqual(keyText(`${KEY}\r\n`), { ok: true, text: KEY });
  assert.deepEqual(keyText("PuTTY-User-Key-File-3: ssh-ed25519\nEncryption: none"), { ok: false, error: PPK_MESSAGE });
  assert.equal(keyText("   ").ok, false);
});

test("key info: the format, never a character of the key body", () => {
  const i = keyInfo(`${HEAD} ${BODY[0]} ${BODY[1]} ${FOOT}`, true);
  assert.equal(i.kind, "openssh");
  assert.equal(i.first_line, HEAD);
  assert.ok(!JSON.stringify(i).includes(BODY[0].slice(0, 6)));
  assert.deepEqual(keyInfo("", false), { set: false });
});

test("host key: SHA256 fingerprint, pin with or without prefix and padding, mismatch refused", () => {
  const blob = Buffer.from(Array.from({ length: 40 }, (_, i) => i));
  assert.equal(fingerprintOf(blob), "X6pO7DYRVWgSwtdLQ3yMSa3T+RDxAGPYAUQffXXNXjs"); // Python: b64(sha256).rstrip("=")
  assert.ok(hostKeyOk(blob, pinOf("SHA256:X6pO7DYRVWgSwtdLQ3yMSa3T+RDxAGPYAUQffXXNXjs=")));
  assert.ok(hostKeyOk(blob, pinOf(" X6pO7DYRVWgSwtdLQ3yMSa3T+RDxAGPYAUQffXXNXjs ")));
  assert.ok(!hostKeyOk(blob, pinOf(undefined)));
  assert.equal(pinOf(""), DEFAULT_PIN);
  assert.ok(!hostKeyOk(blob, ""));
});

/* ── the Magento export ─────────────────────────────────────────────────── */

const xml = (rows: string[][]) => `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Sheet1"><Table>
${rows.map((r) => `  <Row>${r.join("")}</Row>`).join("\n")}
 </Table></Worksheet>
</Workbook>`;
const c = (v: string, idx?: number) => `<Cell${idx ? ` ss:Index="${idx}"` : ""}><Data ss:Type="String">${v}</Data></Cell>`;

test("Magento export: columns found by header name, whatever the grid's order", () => {
  const e = parseMagentoExport(xml([
    [c("ID"), c("Status"), c("Customer Email"), c("A+P order number"), c("A+P customer number"), c("Company")],
    [c("2000001"), c("transferred"), c(" a@acme.ch "), c("A26.1.000"), c("815906"), c("ACME AG")],
    [c("2000002"), c("Pending"), c("b@x.ch"), c("A26.2.000"), c("1"), c("X")],
    [c("2000003"), c("Transferred"), c("c@x.ch"), c(""), c("1"), c("X")],
  ]));
  assert.deepEqual([...e.orders], [["2000001", { apo: "A26.1.000", apc: "815906", email: "a@acme.ch", comp: "ACME AG" }]]);
  assert.deepEqual([...e.columns].sort(), ["apc", "apo", "comp", "email", "inc", "status"]);
});

test("Magento export: ss:Index gaps, a missing email column, entities, CDATA and rich text", () => {
  const e = parseMagentoExport(xml([
    [c("ID"), c("Status", 3), c("A+P order number", 5)],
    [c("7"), c("Transferred", 3), c("A26.7.000", 5)],
    [c("8"), `<Cell/>`, c("Transferred"), `<Cell><Data ss:Type="String"><![CDATA[A26.8]]>&amp;x</Data></Cell>`, c("A26.8.000")],
    [c("9"), c(""), c("Transferred"), c(""), `<Cell><Data ss:Type="String"><B>bold</B>A26.9</Data></Cell>`],
  ]));
  assert.deepEqual([...e.orders.keys()], ["7", "8"]);
  assert.equal(e.orders.get("7")!.apo, "A26.7.000");
  assert.equal(e.orders.get("8")!.apo, "A26.8.000");
  assert.ok(!e.columns.has("email")); // the step warns: no contact can be linked
});

test("stamp name and the email-domain rule", () => {
  assert.equal(stampName("A26.1.000", "ACME AG", "ignored"), "A26.1.000 | ACME AG");
  assert.equal(stampName("A26.1.000", "", "  Muster GmbH "), "A26.1.000 | Muster GmbH");
  assert.equal(stampName("A26.1.000", "", null), "A26.1.000");
  assert.ok(domainProves("hans@acme-group.ch", "ACME Group AG"));
  assert.ok(domainProves("x@sbb.ch", "SBB CFF FFS"));
  assert.ok(!domainProves("hans@gmail.com", "ACME AG"));
  assert.ok(!domainProves("no-at-sign", "ACME AG"));
});

/* ── CSV as Python reads it ─────────────────────────────────────────────── */

test("CSV: Python's csv.reader quirks, newline translation, chunks split anywhere", () => {
  const text = `a;b;c\r\n1;O-Ring 1/2" x 3/32";x\r\n"q;1";"say ""hi""";"multi\r\nline"\r\n\r\n"ab"cd;e\n;\nlast;"open`;
  const want = [["a", "b", "c"], ["1", 'O-Ring 1/2" x 3/32"', "x"], ["q;1", 'say "hi"', "multi\nline"], [], ["abcd", "e"], ["", ""], ["last", "open"]];
  assert.deepEqual(pyCsvRows(text), want);
  for (let cut = 1; cut < text.length; cut++) {
    const r = new PyCsvReader(";");
    const out: string[][] = [];
    r.push(text.slice(0, cut), out);
    r.push("", out);
    r.push(text.slice(cut), out);
    r.end(out);
    assert.deepEqual(out, want, `split at ${cut}`);
  }
});

/* ── sales agents ───────────────────────────────────────────────────────── */

test("agent names: the same words in any order find the existing option, never an invented one", () => {
  const idx = agentIndex(["Claudia Cagnoni", "Jean-Marc Muster", "Peter Ott"]);
  assert.equal(nameTokens("Cagnoni  Claudia"), nameTokens("claudia cagnoni"));
  assert.equal(agentOption("Cagnoni Claudia", idx), "Claudia Cagnoni");
  assert.equal(agentOption("Muster Jean Marc", idx), "Jean-Marc Muster");
  assert.equal(agentOption("Hans Neu", idx), null);
  // two options with the same words: the one spelled like the value, else the first
  const twin = agentIndex(["Ott Peter", "Peter Ott"]);
  assert.equal(agentOption("peter ott", twin), "Peter Ott");
  assert.equal(agentOption("Ott  Peter", twin), "Ott Peter");
});

test("agent decision: write the canonical option, skip junk, never clear, SAE only when it differs", () => {
  const idx = agentIndex(["Claudia Cagnoni", "Peter Ott"]);
  assert.deepEqual(agentDecision({ sa: "Cagnoni Claudia", sae: "X1" }, { sa: "Peter Ott", sae: "X1" }, idx).props, { sa__sales_agent: "Claudia Cagnoni" });
  assert.deepEqual(agentDecision({ sa: "Cagnoni Claudia", sae: "X2" }, { sa: "claudia cagnoni", sae: " X1 " }, idx).props, { sae_performis: "X2" });
  const junk = agentDecision({ sa: "Sales-Support", sae: "" }, { sa: "Peter Ott" }, idx);
  assert.deepEqual([junk.props, junk.junk], [{}, true]);
  assert.deepEqual(agentDecision({ sa: "", sae: null }, { sa: "Peter Ott", sae: "Z" }, idx).props, {});
  assert.equal(agentDecision({ sa: "Hans Neu", sae: "" }, {}, idx).unknown, "Hans Neu");
});

test("dim_customer columns: by header; without SAE the SAE is not read from the SA column", () => {
  const cols = agentColumns(["CustomerNumberUnique", "Name", "SA"])!;
  assert.equal(cols.sae, null);
  assert.deepEqual(agentRow([" 110-1 ", "x", " Peter Ott "], cols), ["110-1", { sa: "Peter Ott", sae: null }]);
  assert.equal(agentRow(["110-1", "x"], cols), null);
  assert.equal(agentColumns(["Name", "SA"]), null);
});

/* ── article master ─────────────────────────────────────────────────────── */

const HDR = ["ArticleNumber", "ArticleText", "ArticleIsInactive", "dss_update_time", "SalesUnit", "ProfitCenterNew", "ArticleType"];

test("dss_update_time: strptime's dd.mm.yyyy HH:MM:SS, anything else none", () => {
  assert.equal(toMs("01.02.2026 03:04:05"), Date.UTC(2026, 1, 1, 3, 4, 5));
  assert.equal(toMs(" 1.2.2026  3:4:5 "), Date.UTC(2026, 1, 1, 3, 4, 5));
  assert.equal(toMs("29.02.2025 00:00:00"), null);
  assert.equal(toMs("01.02.2026 03:04:60"), null);
  assert.equal(toMs("01.02.2026 03:04:059"), null);
  assert.equal(toMs("2026-02-01 03:04:05"), null);
  assert.equal(toMs(""), null);
});

test("best row: the active row wins, then the newest, the first on a tie; a short row is skipped", () => {
  const b = new BestArticles(HDR, "update");
  b.add(["0001", "old active", "", "01.01.2026 00:00:00", "Stk", "", ""]);
  b.add(["0001", "new inactive", "J", "01.06.2026 00:00:00", "Stk", "", ""]);
  b.add(["0001", "newer active", "", "01.03.2026 00:00:00", "Stk", "", ""]);
  b.add(["0001", "same time", "", "01.03.2026 00:00:00", "Stk", "", ""]);
  b.add(["0002", "x", "", "bad date", "m", "Unknown", "Standard"]);
  b.add(["0003", "too short", ""]);
  assert.equal(b.get("0001")!.ArticleText, "newer active");
  assert.equal(b.get("0002")!.ArticleText, "x");
  assert.equal(b.get("0003"), undefined);
  assert.equal(b.seen.size, 2);
  assert.deepEqual(payloadFor(b.get("0002")!), {
    article_description: "x", compass_article_type: "Standard", compass_profit_center: "Unknown",
    sales_unit: "m", profit_center: "UNKNOWN", article_type: "Standard", compass_article_inactive: "active",
  });
});

test("best row for creation: shop-standard only (ten digits, Standard, active, a text), the newest wins", () => {
  const b = new BestArticles(HDR, "create");
  b.add(["8001234567", "A", "", "01.01.2026 00:00:00", "Stk", "", "Standard"]);
  b.add(["8001234567", "B", "", "01.02.2026 00:00:00", "Stk", "", "Standard"]);
  b.add(["8001234568", "C", "J", "01.02.2026 00:00:00", "Stk", "", "Standard"]);
  b.add(["800123456", "D", "", "01.02.2026 00:00:00", "Stk", "", "Standard"]);
  b.add(["8001234569", "", "", "01.02.2026 00:00:00", "Stk", "", "Standard"]);
  b.add(["8001234570", "E", "", "01.02.2026 00:00:00", "Stk", "", "Special"]);
  assert.deepEqual([...b.best.keys()], ["8001234567"]);
  assert.equal(b.get("8001234567")!.ArticleText, "B");
});

test("article match: as is, without leading zeros, padded to ten", () => {
  const has = (k: string) => ["12345", "0000067890", "555"].includes(k);
  assert.equal(matchArticle("12345", has), "12345");
  assert.equal(matchArticle("0012345", has), "12345");
  assert.equal(matchArticle("67890", has), "0000067890");
  assert.equal(matchArticle("999", has), null);
  assert.deepEqual(articleKeys("007"), ["007", "7", "0000000007"]);
  assert.equal(zfill("-12", 5), "-0012");
});

test("payload hash: json.dumps(sort_keys=True) byte for byte, so the connector's cache key", () => {
  const p = { sales_unit: "Stk", article_description: `O-Ring 10x2 "NBR" ${ch(0xe4)} ${BS} ${ch(0x1f600)}`, compass_article_inactive: "active" };
  assert.equal(pyJsonSorted(p), `{"article_description": "O-Ring 10x2 ${BS}"NBR${BS}" ${BS}u00e4 ${BS}${BS} ${BS}ud83d${BS}ude00", "compass_article_inactive": "active", "sales_unit": "Stk"}`);
  assert.equal(payloadHash(p), "ebe881eaf486e69491958e5ac451a194"); // Python hashlib.md5(json.dumps(p, sort_keys=True))
});

test("enum values HubSpot does not offer are left out, not sent to fail the batch", () => {
  const r = withKnownOptions({ sales_unit: "Stk", material: "NBR", profit_center: "P9" }, new Map([["sales_unit", new Set(["Stk"])], ["profit_center", new Set(["P1"])]]));
  assert.deepEqual(r.payload, { sales_unit: "Stk", material: "NBR" });
  assert.deepEqual(r.dropped, [["profit_center", "P9"]]);
});
