import assert from "node:assert/strict";
import { test } from "node:test";
import { FOCUS_A3, countryName } from "../src/lib/marketingKpis/countries";
import { countryTable, mergeCountryMonths, r09Series, type CountryMonths } from "../src/lib/marketingKpis/countryMonths";
import { assistantWindows, type AeoRun } from "../src/lib/aeo/model";

test("country names in full, from Search Console's codes and from two letters", () => {
  assert.equal(countryName("ita"), "Italy");
  assert.equal(countryName("CHE"), "Switzerland");
  assert.equal(countryName("deu"), "Germany");
  assert.equal(countryName("lie"), "Liechtenstein");
  assert.equal(countryName("gbr"), "United Kingdom");
  assert.equal(countryName("PL"), "Poland");
  assert.equal(countryName("zzz"), "Unknown region");
  assert.equal(countryName("xyz"), "xyz");
  assert.equal(FOCUS_A3.length, 8);
});

const month = (rows: Record<string, [number, number]>) => rows;

test("the months kept: a whole month read again wins, the running and the partial ones are shown but not kept", () => {
  const kept: CountryMonths = { "2025-05": month({ che: [10, 100] }), "2025-06": month({ che: [20, 200] }) };
  const fresh: CountryMonths = {
    "2025-06": month({ che: [5, 50] }),                 // Google has only part of June now
    "2026-09": month({ che: [30, 300] }),
    "2026-10": month({ che: [3, 30] }),                 // running
    "2025-04": {},                                      // gone at Google
  };
  const complete = (m: string) => m < "2026-10" && m >= "2025-07";
  const { months, keep } = mergeCountryMonths(kept, fresh, complete);
  assert.deepEqual(months["2025-06"], { che: [20, 200] });  // the keep's whole month, not Google's part
  assert.deepEqual(months["2026-10"], { che: [3, 30] });
  assert.equal(keep["2026-10"], undefined);
  assert.deepEqual(keep["2026-09"], { che: [30, 300] });
  assert.deepEqual(keep["2025-05"], { che: [10, 100] });
});

test("R09: clicks from the focus markets per month; the table with the change on the same months", () => {
  const months: CountryMonths = {
    "2025-08": month({ che: [100, 1000], deu: [50, 500], usa: [40, 900] }),
    "2025-09": month({ che: [100, 1000], usa: [10, 100] }),
    "2026-08": month({ che: [150, 1200], deu: [50, 400], usa: [10, 300] }),
    "2026-09": month({ che: [110, 1000], usa: [5, 100] }),
    "2026-10": month({ che: [20, 200] }),
  };
  const s = r09Series(months, 2026);
  assert.equal(s.months[7], 200);          // che + deu, not usa
  assert.equal(s.py[7], 150);
  assert.equal(s.months[9], 20);
  assert.equal(s.months[0], null);
  const t = countryTable(months, 2026, 9);
  assert.deepEqual(t.same, [7, 8]);
  const che = t.rows.find((r) => r.label === "che")!;
  assert.equal(che.clicks, 280);           // the running month included in "so far"
  assert.equal(che.sameClicks, 260);       // not in the comparison
  assert.equal(che.pyClicks, 200);
  assert.ok(t.rows.find((r) => r.label === "lie")?.focus);  // every focus market listed, even without clicks
  assert.equal(t.rows[0].label, "che");
});

test("each assistant, last 30 days and the 30 before", () => {
  const now = new Date("2026-10-18T00:00:00Z");
  const r = (id: string, model: string, daysAgo: number, owned: number): AeoRun => ({ id, promptId: "p", model, at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), owned, competitor: 1, citations: 0, ownCited: null });
  const w = assistantWindows([r("a", "CHATGPT", 2, 1), r("b", "CHATGPT", 40, 0), r("c", "PERPLEXITY", 5, 0)], now);
  assert.equal(w.cur.CHATGPT.answers, 1);
  assert.equal(w.prev.CHATGPT.answers, 1);
  assert.equal(w.prev.PERPLEXITY, undefined);
  assert.deepEqual(w.models, ["CHATGPT", "PERPLEXITY"]);
  assert.equal(w.since, new Date(now.getTime() - 40 * 86_400_000).toISOString());
});

import { chfToEur, parseEcbCsv, rateFor } from "../src/lib/marketingKpis/fxRates";
import { fmtValue } from "../src/lib/marketingKpis/measures";

test("francs to euros at the month's ECB rate - the nearest earlier month when one is missing", () => {
  const csv = "KEY,FREQ,TIME_PERIOD,OBS_VALUE\nEXR.M.CHF.EUR.SP00.A,M,2026-08,0.9361857\nEXR.M.CHF.EUR.SP00.A,M,2026-09,0.94298636\nEXR.M.CHF.EUR.SP00.A,M,2026-10,";
  const r = parseEcbCsv(csv);
  assert.deepEqual(Object.keys(r), ["2026-08", "2026-09"]);
  assert.equal(rateFor(r, "2026-09"), 0.94298636);
  assert.equal(rateFor(r, "2026-10"), 0.94298636);        // not published yet: September's
  assert.equal(rateFor(r, "2026-01"), 0.9361857);          // before the first: the first
  assert.equal(Math.round(chfToEur(943, "2026-09", r)!), 1000);
  assert.equal(chfToEur(100, "2026-09", {}), null);
  assert.deepEqual(parseEcbCsv("nonsense"), {});
});

test("euros in full; francs only while no rate is known", () => {
  assert.equal(fmtValue("eur", 4136195), "€4,136,195");
  assert.equal(fmtValue("eur", -1200.4), "−€1,200");
  assert.equal(fmtValue("chf", 182669), "CHF 182,669");
});

import { seriesForCountries } from "../src/lib/marketingKpis/countryMonths";

test("Reach's country filter: Search Console's impressions, clicks and click rate for the chosen countries", () => {
  const months: CountryMonths = {
    "2025-09": { ita: [90, 900], che: [10, 100] },
    "2026-09": { ita: [100, 1000], che: [20, 400], usa: [5, 500] },
  };
  const s = seriesForCountries(months, ["ITA", "che"], 2026);
  assert.equal(s.R05.months[8], 120);
  assert.equal(s.R04.months[8], 1400);
  assert.equal(s.R06.months[8], 120 / 1400);
  assert.equal(s.R09.py[8], 100);
  assert.equal(s.R05.months[7], null);       // no month read
  const only = seriesForCountries(months, ["usa"], 2026);
  assert.equal(only.R05.months[8], 5);
  assert.equal(only.R05.py[8], 0);           // read, and none from there
});

test("the country table over the months chosen", () => {
  const months: CountryMonths = {
    "2025-07": { ita: [50, 500] }, "2025-08": { ita: [60, 600] },
    "2026-07": { ita: [70, 700] }, "2026-08": { ita: [80, 800] }, "2026-09": { ita: [90, 900] },
  };
  const t = countryTable(months, 2026, 9, 15, { start: 7, end: 8 });
  const ita = t.rows.find((r) => r.label === "ita")!;
  assert.equal(ita.clicks, 170);             // Aug + Sep
  assert.deepEqual(t.same, [7]);             // Sep has no last year
  assert.equal(ita.pyClicks, 60);
  assert.equal(ita.sameClicks, 80);
});
