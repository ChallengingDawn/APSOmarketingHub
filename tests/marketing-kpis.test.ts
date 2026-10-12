import assert from "node:assert/strict";
import { test } from "node:test";
import { ADDITIONAL_TRACKING, JOURNEY, KPIS, PLANNED, STAGES } from "../src/lib/marketingKpis/catalogue";
import { MEASURES, TYPED, derive, fmtValue, total, type Series } from "../src/lib/marketingKpis/measures";
import { seedInputs } from "../src/lib/marketingKpis/seed";

// The series the pages build, from the seed (SARCLA's Dashboard 2026).
const inputs = seedInputs();
const typed = (id: string): Series => ({
  months: Array.from({ length: 12 }, (_, i) => inputs.months[id]?.[`2026-${String(i + 1).padStart(2, "0")}`] ?? null),
  py: Array(12).fill(null),
});
const get = (id: string): Series => (MEASURES[id]?.derived ? derive(id, get) : typed(id));
const ytd = (id: string) => total(id, get(id), "months", get, 9);

test("the seed reproduces the sheet's totals", () => {
  assert.equal(ytd("V01"), 129855);
  assert.equal(ytd("P01"), 23851);
  assert.equal(ytd("X01"), 182669);
  assert.equal(ytd("P05"), 4136195);
  assert.equal(ytd("R04"), 8503000);
  assert.equal(ytd("R05"), 112110);
  assert.equal(ytd("P07"), 1534175);
  assert.equal(Math.round(ytd("P02")! * 10000) / 10000, 0.1837);  // purchases / users
  assert.equal(Math.round(ytd("P06")! * 10) / 10, 22.6);          // SEA revenue / cost
  assert.equal(Math.round(ytd("R06")! * 10000) / 10000, 0.0132);  // SEO clicks / impressions
  assert.equal(Math.round(ytd("R07")! * 100) / 100, 12.91);       // position, impression-weighted
  assert.equal(ytd("F01"), 4136195);                              // paid revenue, against the SMEC target
  assert.equal(inputs.targets.F01["2026"], 4800000);
});

test("derived months come from their parts, and stop where a part is missing", () => {
  const p02 = derive("P02", get);
  assert.equal(Math.round(p02.months[0]! * 1000) / 1000, 0.188);  // 2751 / 14626
  assert.equal(p02.months[9], null);                              // October not typed yet
  const roas = derive("P06", get);
  assert.equal(Math.round(roas.months[0]! * 100) / 100, 14.19);
});

test("averages and empty years", () => {
  assert.equal(Math.round(ytd("E01")! * 10000) / 10000, 0.2926);  // mean of the typed months
  assert.equal(total("V01", typed("V01"), "py", get, 9), null);  // no last year in the sheet
});

test("the catalogue is SARCLA's: 74 KPIs in 10 stages, his renames, tags, notes and planned rows", () => {
  assert.equal(KPIS.length, 74);
  assert.equal(STAGES.length, 10);
  assert.equal(STAGES.find((s) => s.id === "5")?.name, "Hand-over to ESO/TSA");
  assert.ok(JOURNEY.some((j) => j.id === "L02" && j.name === "Leads to sales/quality"));
  assert.equal(ADDITIONAL_TRACKING.length, 5);
  assert.equal(PLANNED.length, 3);
  assert.equal(KPIS.filter((k) => k.audience === "Sales leader, Rose").length, 28);
  assert.equal(STAGES.find((s) => s.id === "7")?.note, "Check the split on revenue on different channels");
  assert.equal(JOURNEY.find((j) => j.id === "R01")?.note, "GEO");
  assert.ok(KPIS.find((k) => k.id === "G02")?.definition.includes("24 months"));
  assert.equal(new Set(STAGES.map((s) => s.slug)).size, 10);
  for (const k of KPIS) assert.ok(STAGES.some((s) => s.id === k.stage), k.id);
});

test("every measured KPI is in the catalogue (SEA cost is the journey's extra), and typing covers the sheet", () => {
  for (const id of Object.keys(MEASURES)) if (id !== "X01") assert.ok(KPIS.some((k) => k.id === id), id);
  assert.deepEqual([...TYPED].sort(), ["E01", "E02", "K02", "K03", "P01", "P05", "P07", "R01", "R02", "R04", "R05", "R06", "R07", "V01", "X01"]);
});

test("formats", () => {
  assert.equal(fmtValue("pct", 0.2916), "29.2%");
  assert.equal(fmtValue("chf", 4136195), "CHF 4.14M");
  assert.equal(fmtValue("chf", 182669), "CHF 183K");
  assert.equal(fmtValue("int", 129855), "129,855");
  assert.equal(fmtValue("x", 22.643), "22.6");
  assert.equal(fmtValue("int", null), "—");
});
