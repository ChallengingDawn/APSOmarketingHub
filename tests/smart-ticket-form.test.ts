import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILT_IN, autoSource, changedPieces, problems, sourceOf, type Catalog, type SmartForm } from "../src/lib/smartTickets/formDesign";

// a HubSpot that has exactly what the built-in design uses
const props = new Set<string>();
for (const forms of [BUILT_IN.gqsForms, BUILT_IN.pmForms]) for (const fields of Object.values(forms)) for (const x of fields) props.add(x.f);
for (const c of BUILT_IN.categories) { if (c.subField) props.add(c.subField); if (c.textboxField) props.add(c.textboxField); }
const catalog: Catalog = {
  properties: [...props].map((name) => ({ name, label: name, type: "string", fieldType: "text", options: [] })),
  pipelines: BUILT_IN.pipelines.map((p) => ({ id: p.value, label: p.label, stages: [{ id: p.stage, label: "first" }] })),
  owners: BUILT_IN.sprLineManagers.map((m) => ({ id: m.value, name: m.label })),
};
const copy = (): SmartForm => structuredClone(BUILT_IN);

test("the built-in design is valid, and unchanged against itself", () => {
  assert.deepEqual(problems(BUILT_IN, catalog), []);
  assert.deepEqual(changedPieces(copy(), BUILT_IN), []);
});

test("Margin % and Target price stay in every GQS form, required", () => {
  const f = copy();
  f.gqsForms["Running Business"] = f.gqsForms["Running Business"].filter((x) => x.f !== "margin__");
  f.gqsForms.__SHARED__ = f.gqsForms.__SHARED__.map((x) => (x.f === "target_price" ? { ...x, req: false } : x));
  const p = problems(f, catalog);
  assert.ok(p.some((x) => x.includes('"Running Business"') && x.includes("Margin %")), p.join("\n"));
  assert.ok(p.some((x) => x.includes('"__SHARED__"') && x.includes("Target price")), p.join("\n"));
});

test("a field must be a real ticket property, once per form; a list needs its choices", () => {
  const f = copy();
  f.pmForms.MOQ = [...f.pmForms.MOQ, { f: "no_such_property", l: "X", t: "text" }, { f: "requested_quantity", l: "Again", t: "select" }];
  const p = problems(f, catalog);
  assert.ok(p.some((x) => x.includes("no_such_property") && x.includes("not a ticket property")));
  assert.ok(p.some((x) => x.includes("requested_quantity") && x.includes("twice")));
  assert.ok(p.some((x) => x.includes("needs its choices")));
});

test("quick actions, GQS types, pipelines and line managers point at things that exist", () => {
  const f = copy();
  f.quickActions[0] = { ...f.quickActions[0], sub: "Not a sub-category" };
  f.gqsTypes.push({ label: "New", value: "New", form: "missing form" });
  f.pipelines[0] = { ...f.pipelines[0], stage: "999" };
  f.sprLineManagers.push({ label: "Nobody", value: "1" });
  const p = problems(f, catalog);
  assert.ok(p.some((x) => x.includes("is not a sub-category")));
  assert.ok(p.some((x) => x.includes('form "missing form" does not exist')));
  assert.ok(p.some((x) => x.includes("first stage 999")));
  assert.ok(p.some((x) => x.includes("not a HubSpot owner")));
});

test("the changes are named per piece - a section, or one form", () => {
  const f = copy();
  f.gqsForms["Running Business"][0] = { ...f.gqsForms["Running Business"][0], l: "Customer" };
  f.quickActions.pop();
  assert.deepEqual(changedPieces(f, BUILT_IN).sort(), ["gqsForms:Running Business", "quickActions"]);
});

test("auto fills the obvious fields from the ticket - articles, company, mandant, order, date - and never a yes/no", () => {
  const src = (f: string) => {
    for (const forms of [BUILT_IN.gqsForms, BUILT_IN.pmForms]) for (const fields of Object.values(forms)) { const x = fields.find((y) => y.f === f); if (x) return sourceOf(x); }
    throw new Error(f);
  };
  assert.equal(src("customer_number_customer_name"), "customer");
  assert.equal(src("article"), "articles");
  assert.equal(src("sarcla_article_pm_moq"), "article");
  assert.equal(src("sarcla_article_number_pm_other"), "article");
  assert.equal(src("a_p_item_number_if_existing_part_"), "article");
  assert.equal(src("sarcla_pm_witch_mandant__"), "mandant");
  assert.equal(src("sarcla_order_n_with_minus_margin_pm"), "order");
  assert.equal(src("delivery_date"), "delivery_date");
  assert.equal(src("liquidation_article"), null);
  assert.equal(src("order_potential_"), null);
  assert.equal(src("quantity_lot_size"), null);
  assert.equal(sourceOf({ f: "article", l: "A", t: "textarea", autofill: "none" }), null);
  assert.equal(sourceOf({ f: "material", l: "M", t: "text", autofill: "order" }), "order");
  assert.equal(autoSource({ f: "delivery_date", t: "text" }), null);
});

test("a field can be filled from any property of the parent ticket, its company or its contact - one HubSpot has", () => {
  const f = copy();
  f.pmForms.MOQ = f.pmForms.MOQ.map((x, i) => (i === 0 ? { ...x, autofill: "company:mandant" } : i === 1 ? { ...x, autofill: "contact:no_such_contact_prop" } : { ...x, autofill: "ticket:requested_quantity" }));
  const withObjects: Catalog = { ...catalog, companyProps: [{ name: "mandant", label: "Mandant" }], contactProps: [{ name: "email", label: "Email" }] };
  const p = problems(f, withObjects);
  assert.equal(p.length, 1, p.join("\n"));
  assert.ok(p[0].includes('contact\'s "no_such_contact_prop"'), p[0]);
  assert.equal(sourceOf(f.pmForms.MOQ[0]), "company:mandant");
});
