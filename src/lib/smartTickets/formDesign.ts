// SMART SUB-TICKET - THE CREATE FORM'S DESIGN, the pure part (types, BUILT_IN, checks) - IO in form.ts.
// SMART SUB-TICKET - THE CREATE FORM'S DESIGN (SARCLA 18.10.2026: "another tab, Create form, put the design here so
// we can tweak the properties"). The Smart Sub-Ticket card (HubSpot, the hub's app) had its design written into its
// code; it now reads the PUBLISHED design (a private File Manager file) when it opens and falls back to BUILT_IN - the same
// design, copied here from SmartTicketCard.jsx - when none is published or the file cannot be read.
// The hub keeps a DRAFT (kv) that the page changes one piece at a time (the hub refuses request bodies over 8 KB);
// Publish validates it against HubSpot - ticket properties, pipelines and stages, owners - and uploads it (form.ts).


export type FieldType = "text" | "textarea" | "number" | "date" | "yesno" | "select";
/** One field of a form: HubSpot property, label, type, options (select), required, where its value comes from. */
export type Field = { f: string; l: string; t: FieldType; opts?: string[]; req?: boolean; autofill?: Autofill };

/** Where a field is pre-filled from when the card opens (SARCLA 18.10.2026: "article should also be filled with the
 *  ticket detection ... try to get the maximum"). No value = "auto". Whatever the source, an empty result falls back
 *  to the parent ticket's same property, then to what the ticket's text says (quantity, target price, material...);
 *  "none" leaves the field to be typed. The card has the same rules (SmartTicketCard.jsx, autoSource / prefill). */
export type Autofill = "auto" | "customer" | "mandant" | "contact" | "article" | "articles" | "order" | "delivery_date" | "none";
export const AUTOFILL: { v: Autofill; l: string }[] = [
  { v: "auto", l: "Auto" },
  { v: "customer", l: "The ticket's company (# / name)" },
  { v: "mandant", l: "The company's mandant" },
  { v: "contact", l: "The ticket's contact" },
  { v: "article", l: "Detected article (the first)" },
  { v: "articles", l: "Detected articles (all)" },
  { v: "order", l: "Detected order number" },
  { v: "delivery_date", l: "Detected delivery date" },
  { v: "none", l: "Nothing - always typed" },
];
type Source = Exclude<Autofill, "auto" | "none">;
const TEXTISH: FieldType[] = ["text", "textarea"];
/** What "auto" means for a field: a source picked from its property and type, or null (the parent ticket / its text only). */
export function autoSource(x: Pick<Field, "f" | "t">): Source | null {
  const f = x.f.toLowerCase(), text = TEXTISH.includes(x.t);
  if (f === "customer_number_customer_name") return "customer";
  if (f.includes("mandant") && (text || x.t === "select")) return "mandant";
  if ((f.includes("article") || f.includes("item_number")) && text) return x.t === "textarea" ? "articles" : "article";
  if ((f.includes("order_n") || f === "order_id") && text) return "order";
  if (f.includes("delivery_date") && x.t === "date") return "delivery_date";
  if (f.includes("contact") && text) return "contact";
  return null;
}
/** The source the card uses for a field: its own, or what "auto" picks. */
export const sourceOf = (x: Field): Source | null => (x.autofill === "none" ? null : x.autofill && x.autofill !== "auto" ? x.autofill : autoSource(x));
export type SmartForm = {
  pipelines: { label: string; value: string; stage: string }[];
  categories: { value: string; subField: string; textboxField: string; subOptions: string[] }[];
  quickActions: { label: string; pipelines: string[]; cat: string; sub: string; prefix: string }[];
  gqsTypes: { label: string; value: string; form: string }[];
  gqsForms: Record<string, Field[]>;
  pmSubjects: { label: string; value: string }[];
  pmForms: Record<string, Field[]>;
  sprLineManagers: { label: string; value: string }[];
};
export type Section = keyof SmartForm;
export const SECTIONS: Section[] = ["pipelines", "categories", "quickActions", "gqsTypes", "gqsForms", "pmSubjects", "pmForms", "sprLineManagers"];

export const BO = "1726786777", GQS = "1726786775", SPR = "1553929403", PM = "1737150687";
/** Required on every GQS form, locked (SARCLA 18.10.2026: "should really be mandatory"). */
export const GQS_LOCKED = ["margin__", "target_price"];

const F = (f: string, l: string, t: FieldType, extra: Partial<Field> = {}): Field => ({ f, l, t, ...extra });
const DT_FIELDS: Field[] = [
  F("customer_number_customer_name", "Customer # / Name", "text", { autofill: "customer" }),
  F("type_of_product", "Type of product", "text"),
  F("a_p_item_number_if_existing_part_", "A+P item # (if existing part)", "text"),
  F("quantity_lot_size", "Quantity / Lot size", "text"),
  F("call_off", "Call off", "select", { opts: ["1 call off", "Annual quantity and call offs"] }),
  F("delivery_date", "Delivery Date", "date"),
  F("material", "Material", "text"),
  F("hardness", "Hardness", "text"),
  F("colour", "Colour", "text"),
  F("dimensions", "Dimensions", "text"),
  F("temperature_range", "Temperature range", "text"),
  F("tolerances", "Tolerances", "textarea"),
  F("molded_parts___extruded_profiles", "Molded Parts / Extruded Profiles", "yesno"),
  F("if_linear_rotataion_bonded_seals___denomination__type__", "Linear/Rotation/Bonded Seals — type", "text"),
  F("target_price", "Target price", "number", { req: true }),
  F("margin__", "Margin %", "number", { req: true }),
  F("application__e_g__automotive_etc___", "Application (e.g. Automotive)", "text"),
  F("working_temperature", "Working temperature", "text"),
  F("special_surface__coating__treatment___marking", "Special surface / coating / marking", "text"),
  F("special_packaging", "Special packaging", "text"),
];

/** The design as SmartTicketCard.jsx has it built in (18.10.2026). Keep the two the same. */
export const BUILT_IN: SmartForm = {
  pipelines: [
    { label: "Back Office", value: BO, stage: "2338266325" },
    { label: "Back Office - Special Tasks GQS", value: GQS, stage: "3153750219" },
    { label: "Special Prices Requests", value: SPR, stage: "2124458186" },
    { label: "Product Management", value: PM, stage: "2356663542" },
  ],
  categories: [
    { value: "Product Price", subField: "enquiry_sub_category___price_1", textboxField: "enquiry_textbox___price", subOptions: ["Price is not visible", "Request for quotation", "Wrong price on my order"] },
    { value: "Product Information", subField: "enquiry_sub_category___product_information___1", textboxField: "enquiry_textbox___product_information", subOptions: ["Technical question on a product", "I need an alternative on a existing product", "Product cannot be found in the shop/Alternative products", "Technical Data Sheet request", "3D Model request", "Minimum order quantity for a product", "Conformities / Certificates"] },
    { value: "Delivery", subField: "enquiry_sub_category___delivery___1", textboxField: "enquiry_textbox___delivery", subOptions: ["Pre Order", "Existing Order", "Previous Order"] },
    { value: "Website Issue", subField: "enquiry_sub_category___website_issue___1", textboxField: "enquiry_textbox___website_issue", subOptions: ["Login Issue", "Other Issue"] },
    { value: "Invoicing & Accounting", subField: "enquiry_sub_category___invoicing___accounting___1", textboxField: "enquiry_textbox___invoicing___accounting", subOptions: ["Invoice not received", "Other invoicing issue"] },
    { value: "Order Cancellation", subField: "enquiry_sub_category___order_cancellation___1", textboxField: "enquiry_textbox___order_cancellation", subOptions: ["Cancel existing order"] },
    { value: "Certificates (ONLY FOR BO)", subField: "", textboxField: "", subOptions: [] },
    { value: "Dashboard", subField: "", textboxField: "", subOptions: [] },
    { value: "Others", subField: "", textboxField: "", subOptions: [] },
    { value: "MS365", subField: "", textboxField: "", subOptions: [] },
  ],
  quickActions: [
    { label: "Cancel order", pipelines: [BO], cat: "Order Cancellation", sub: "Cancel existing order", prefix: "Cancel:" },
    { label: "Delivery late", pipelines: [BO], cat: "Delivery", sub: "Existing Order", prefix: "Delivery delay:" },
    { label: "Faster delivery", pipelines: [BO], cat: "Delivery", sub: "Existing Order", prefix: "Expedite:" },
    { label: "Quality issue", pipelines: [BO], cat: "Delivery", sub: "Previous Order", prefix: "Quality issue:" },
    { label: "Invoice issue", pipelines: [BO], cat: "Invoicing & Accounting", sub: "Other invoicing issue", prefix: "Invoice:" },
    { label: "Login issue", pipelines: [BO], cat: "Website Issue", sub: "Login Issue", prefix: "Login issue:" },
    { label: "Certificates", pipelines: [BO], cat: "Product Information", sub: "Conformities / Certificates", prefix: "Certificates:" },
    { label: "Datasheet", pipelines: [BO, GQS], cat: "Product Information", sub: "Technical Data Sheet request", prefix: "Datasheet:" },
    { label: "Quote follow-up", pipelines: [GQS], cat: "Product Price", sub: "Request for quotation", prefix: "Quote:" },
    { label: "Alternative product", pipelines: [GQS, PM], cat: "Product Information", sub: "I need an alternative on a existing product", prefix: "Alternative:" },
    { label: "Special pricing", pipelines: [SPR], cat: "Product Price", sub: "Request for quotation", prefix: "Special price:" },
    { label: "Discount request", pipelines: [SPR], cat: "Product Price", sub: "Request for quotation", prefix: "Discount:" },
    { label: "MOQ question", pipelines: [PM], cat: "Product Information", sub: "Minimum order quantity for a product", prefix: "MOQ:" },
    { label: "3D model", pipelines: [PM], cat: "Product Information", sub: "3D Model request", prefix: "3D model:" },
    { label: "Technical question", pipelines: [PM], cat: "Product Information", sub: "Technical question on a product", prefix: "Technical:" },
  ],
  gqsTypes: [
    { label: "Running Business", value: "Running Business", form: "Running Business" },
    { label: "DT - New Business", value: "DT -  New Business", form: "DT -  New Business" },
    { label: "KT - New Business", value: "KT -  New Business", form: "__SHARED__" },
    { label: "FT - New Business", value: "FT -  New Business", form: "__SHARED__" },
    { label: "AT - New Business", value: "AT -  New Business", form: "__SHARED__" },
    { label: "ST - New Business", value: "ST -  New Business", form: "__SHARED__" },
  ],
  gqsForms: {
    "Running Business": [
      F("customer_number_customer_name", "Customer # / Name", "text", { autofill: "customer" }),
      F("article", "Article(s)", "textarea"),
      F("quantity_lot_size", "Quantity / Lot size", "text"),
      F("delivery_date", "Delivery Date", "date"),
      F("liquidation_article", "Article in liquidation?", "yesno"),
      F("margin__", "Margin %", "number", { req: true }),
      F("target_price", "Target price", "number", { req: true }),
      F("order_potential_", "Total Order potential", "number"),
      F("expected_answer_date", "Expected Answer Date", "date"),
    ],
    "DT -  New Business": DT_FIELDS,
    __SHARED__: [
      F("customer_number_customer_name", "Customer # / Name", "text", { autofill: "customer" }),
      F("article", "Article(s)", "textarea"),
      F("quantity_lot_size", "Quantity / Lot size", "text"),
      F("material", "Material", "text"),
      F("colour", "Colour", "text"),
      F("dimensions", "Dimensions", "text"),
      F("delivery_date", "Delivery Date", "date"),
      F("liquidation_article", "Is this article in liquidation?", "yesno"),
      F("previous_supplier_competitior_", "Previous supplier / competitor", "textarea"),
      F("margin__", "Margin %", "number", { req: true }),
      F("target_price", "Target price", "number", { req: true }),
      F("order_potential_", "Total Order potential", "number"),
      F("one_off_recurring_", "One off / Recurring?", "select", { opts: ["Once Off", "Recurring"] }),
      F("expected_answer_date", "Expected Answer Date", "date"),
    ],
  },
  pmSubjects: [
    { label: "MOQ", value: "MOQ" },
    { label: "Price", value: "Price" },
    { label: "Data or other topics", value: "Data or other topics" },
  ],
  pmForms: {
    MOQ: [
      F("sarcla_article_pm_moq", "Article with MOQ", "text"),
      F("requested_quantity", "Requested Quantity", "text"),
      F("sarcla_more_information_moq", "More information about MOQ request", "textarea"),
    ],
    Price: [
      F("sarcla_pm_witch_mandant__", "Which Mandant?", "select", { opts: ["M100", "M110"] }),
      F("sarcla_article_number_pm_other", "Article number in the order", "text"),
      F("requested_quantity", "Quantity", "text"),
      F("sarcla_order_n_with_minus_margin_pm", "Order number", "text"),
      F("sarcla_pm_minusmargin", "Minus or low margin in the order?", "text"),
      F("sarcla_more_information_pm_others", "More information about the issue", "textarea"),
    ],
    "Data or other topics": [
      F("sarcla_pm_describe_pm_subject", "Describe PM subject", "text"),
      F("sarcla_article_number_pm_other", "Article (others)", "text"),
      F("requested_quantity", "Quantity", "text"),
      F("sarcla_more_information_pm_others", "More information", "textarea"),
    ],
  },
  sprLineManagers: [
    { label: "Alexandre Lecomte", value: "76033827" },
    { label: "Bernd Rausmann", value: "817647087" },
    { label: "Claudio Saraiva", value: "1229976033" },
    { label: "Luca Fantasia", value: "1229999587" },
    { label: "Marc Frech", value: "817497321" },
    { label: "Rose Rasteiro", value: "31935670" },
  ],
};

/* ── what HubSpot has, to check the design against ─────────────────────── */

export type TicketProperty = { name: string; label: string; type: string; fieldType: string; options: string[] };
export type Catalog = {
  properties: TicketProperty[];
  pipelines: { id: string; label: string; stages: { id: string; label: string }[] }[];
  owners: { id: string; name: string }[];
};
/* ── validation ─────────────────────────────────────────────────────────── */

const TYPES: FieldType[] = ["text", "textarea", "number", "date", "yesno", "select"];

/** What is wrong with a design, in plain words (empty = fine). */
export function problems(form: SmartForm, c: Catalog): string[] {
  const out: string[] = [];
  const props = new Set(c.properties.map((p) => p.name));
  const pipeById = new Map(c.pipelines.map((p) => [p.id, p]));
  const checkFields = (where: string, fields: Field[]) => {
    const seen = new Set<string>();
    fields.forEach((x, i) => {
      const at = `${where}, field ${i + 1}${x.l ? ` "${x.l}"` : ""}`;
      if (!x.l?.trim()) out.push(`${at}: no label`);
      if (!props.has(x.f)) out.push(`${at}: "${x.f}" is not a ticket property in HubSpot`);
      if (seen.has(x.f)) out.push(`${at}: "${x.f}" is in this form twice`);
      seen.add(x.f);
      if (!TYPES.includes(x.t)) out.push(`${at}: unknown type "${x.t}"`);
      if (x.t === "select" && !(x.opts ?? []).length) out.push(`${at}: a list needs its choices`);
    });
  };
  if (!form.pipelines.length) out.push("Pipelines: at least one");
  for (const p of form.pipelines) {
    const hp = pipeById.get(p.value);
    if (!hp) out.push(`Pipeline "${p.label}": ${p.value} is not a ticket pipeline`);
    else if (!hp.stages.some((s) => s.id === p.stage)) out.push(`Pipeline "${p.label}": the first stage ${p.stage} is not one of its stages`);
  }
  const catByName = new Map(form.categories.map((x) => [x.value, x]));
  for (const x of form.categories) {
    if (!x.value.trim()) out.push("Categories: one has no name");
    if (x.subField && !props.has(x.subField)) out.push(`Category "${x.value}": sub-category property "${x.subField}" does not exist`);
    if (x.textboxField && !props.has(x.textboxField)) out.push(`Category "${x.value}": text property "${x.textboxField}" does not exist`);
    if (x.subOptions.length && !x.subField) out.push(`Category "${x.value}": sub-categories need their property`);
  }
  const pipeIds = new Set(form.pipelines.map((p) => p.value));
  for (const q of form.quickActions) {
    if (!q.label.trim()) out.push("Quick actions: one has no label");
    if (!q.pipelines.length || q.pipelines.some((p) => !pipeIds.has(p))) out.push(`Quick action "${q.label}": its pipelines must be among the form's pipelines`);
    const cat = catByName.get(q.cat);
    if (!cat) out.push(`Quick action "${q.label}": category "${q.cat}" is not in the list`);
    else if (q.sub && !cat.subOptions.includes(q.sub)) out.push(`Quick action "${q.label}": "${q.sub}" is not a sub-category of ${q.cat}`);
  }
  if (!form.gqsTypes.length) out.push("GQS types: at least one");
  for (const t of form.gqsTypes) {
    if (!t.value.trim() || !t.label.trim()) out.push("GQS types: one has no name or value");
    if (!form.gqsForms[t.form]) out.push(`GQS type "${t.label}": its form "${t.form}" does not exist`);
  }
  for (const [k, fields] of Object.entries(form.gqsForms)) {
    checkFields(`GQS form "${k}"`, fields);
    for (const f of GQS_LOCKED) {
      const x = fields.find((y) => y.f === f);
      if (!x || !x.req) out.push(`GQS form "${k}": ${f === "margin__" ? "Margin %" : "Target price"} must stay in it, required`);
    }
  }
  for (const s of form.pmSubjects) if (!form.pmForms[s.value]) out.push(`PM subject "${s.label}": it has no form`);
  for (const [k, fields] of Object.entries(form.pmForms)) checkFields(`PM form "${k}"`, fields);
  const ownerIds = new Set(c.owners.map((o) => o.id));
  for (const m of form.sprLineManagers) if (!ownerIds.has(m.value)) out.push(`SPR line manager "${m.label}": ${m.value} is not a HubSpot owner`);
  return out;
}

/** Which pieces of the draft differ from what the card uses now (published, else built-in). */
export function changedPieces(draft: SmartForm, live: SmartForm): string[] {
  const out: string[] = [];
  for (const s of SECTIONS) {
    if (s === "gqsForms" || s === "pmForms") {
      const a = draft[s] as Record<string, Field[]>, b = live[s] as Record<string, Field[]>;
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(`${s}:${k}`);
    } else if (JSON.stringify(draft[s]) !== JSON.stringify(live[s])) out.push(s);
  }
  return out;
}
