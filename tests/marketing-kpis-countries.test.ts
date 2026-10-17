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
