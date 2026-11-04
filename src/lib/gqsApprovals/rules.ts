// GQS APPROVALS - the rules (Back Office distribution > GQS > Approvals). Replaces the HubSpot workflow "SARCLA | GQS
// Ticket Created by Sales" (2670957768), SARCLA 04.11.2026: "continue the migration - move now SARCLA | GQS Ticket
// Created by Sales in a new tab Approvals". Pure: no HubSpot, no database, relative imports only.
//
// What the workflow did with a GQS request entering "Created by Sales" (read 04.11.2026, its 31 steps):
//   - re-entered (it had been further on before): only "Review by Line manager", nothing else;
//   - else: the subject "GQS Special Request | <type> |  <requester> | <customer>", the requester, TYPE OF SALES TICKET =
//     GQS, an O-number (O<yy>.<ddmmHHMM>, UTC), for DT - New Business the RFQ sheet as a CSV file (DT - TEMPLATE);
//     the Sales follow-up ticket - the ESO / TSA ticket linked to it renamed "GQS SALES FOLLOW-UP TICKET | <customer>"
//     and labelled GQS, or one made (ESO "Waiting internally - APSO", TSA's when the requester is in TSA);
//   - then the rule, in this order: order potential >= 20,000 EUR; <= 1,000 EUR and margin <= 20 %; 1,000 - 20,000 EUR
//     and margin <= 30 %; a liquidation article -> the line manager reviews it (status "Review by Line manager", a mail
//     to the requester and one to the line manager); else "Automatically Approved", stage "New for Back-Office", owner
//     Backoffice Team, a mail to the Backoffice Team. A value that is not filled in never matches (HubSpot's filters).

export const GQS = "1726786775";
export const ESO = "1726599376", TSA = "1726599377";
export const STAGE = {
  createdBySales: "3153750219",
  newForBackOffice: "2338266314",
  esoFollowUp: "2338232558",
  tsaFollowUp: "2338232562",
} as const;
/** The stages that make an entry a re-entry (the workflow's "EXCLUSION REOPEN"; some no longer exist). */
export const REOPEN_STAGES = ["2964068584", "3152460022", "2520497378", "4704538856", "2520497377", "4793532647", "2510335188", "2510335189", "2338266317", "2338266316", "2338266314"];
/** Backoffice Team - the owner and the mail of an approved request. */
export const BACKOFFICE_TEAM = "76164822";
/** Requesters whose follow-up ticket goes to TSA (the workflow's TSA branch: Falk, Schawlochow, Gustak, Pielock, Kuridza, Frech). */
export const TSA_OWNERS = ["1229976031", "1229999295", "1229976029", "1229976026", "30052119", "817497321"];
export const STATUS = {
  review: "Review by Line manager",
  auto: "Automatically Approved",
  approved: "Approved by Line Manager",
  refused: "Refused by Line Manager",
} as const;

/** The limits, as the workflow had them; changeable on the tab. Money in EUR, margins as fractions (0.2 = 20 %). */
export type Limits = { bigFrom: number; smallUpTo: number; smallMargin: number; midFrom: number; midTo: number; midMargin: number; liquidation: boolean };
export const DEFAULT_LIMITS: Limits = { bigFrom: 20000, smallUpTo: 1000, smallMargin: 0.2, midFrom: 1000, midTo: 20000, midMargin: 0.3, liquidation: true };

export type Reason = "big" | "small" | "mid" | "liquidation";
export type Verdict = { review: true; reason: Reason } | { review: false };
export type Facts = { potential: number | null; margin: number | null; liquidation: boolean };

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
/** The request's values. A margin above 1 was typed as a percentage ("30" for 30 %, 8 of the year's 471 margins - the
 *  workflow read it as 3000 % and approved such requests by themselves); a margin cannot be above 100 %, so it is read
 *  as one (SARCLA 04.11.2026). */
export function factsOf(p: Record<string, string | null | undefined>): Facts {
  const m = num(p.margin__);
  return { potential: num(p.order_potential_), margin: m !== null && m > 1 ? m / 100 : m, liquidation: String(p.liquidation_article ?? "").toLowerCase() === "true" };
}

/** The rule, in the workflow's order; a missing value never matches. */
export function decide(f: Facts, l: Limits = DEFAULT_LIMITS): Verdict {
  const pot = f.potential, m = f.margin;
  if (pot !== null && pot >= l.bigFrom) return { review: true, reason: "big" };
  if (pot !== null && m !== null && pot <= l.smallUpTo && m <= l.smallMargin) return { review: true, reason: "small" };
  if (pot !== null && m !== null && pot >= l.midFrom && pot <= l.midTo && m <= l.midMargin) return { review: true, reason: "mid" };
  if (l.liquidation && f.liquidation) return { review: true, reason: "liquidation" };
  return { review: false };
}

const eur = (n: number) => `${Math.round(n).toLocaleString("de-CH")} EUR`;
const pct = (f: number) => `${Math.round(f * 1000) / 10} %`;
/** Why it goes to the line manager - the mail's sentence and the tab's. */
export function reasonText(r: Reason, l: Limits = DEFAULT_LIMITS): string {
  if (r === "big") return `order potential of ${eur(l.bigFrom)} or more`;
  if (r === "small") return `order up to ${eur(l.smallUpTo)} and margin up to ${pct(l.smallMargin)}`;
  if (r === "mid") return `order between ${eur(l.midFrom)} and ${eur(l.midTo)} and margin up to ${pct(l.midMargin)}`;
  return "the article is in liquidation";
}

/** The workflow's subject (two spaces before the requester, as its template had them). */
export const subjectOf = (type: string | null | undefined, requester: string | null | undefined, customer: string | null | undefined) =>
  `GQS Special Request | ${type ?? ""} |  ${requester ?? ""} | ${customer ?? ""}`;
export const followUpSubject = (customer: string | null | undefined) => `GQS SALES FOLLOW-UP TICKET | ${customer ?? ""}`;
/** O<yy>.<ddmmHHMM> in UTC, as the workflow's code made it. */
export function oNumber(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `O${p(d.getUTCFullYear() % 100)}.${p(d.getUTCDate())}${p(d.getUTCMonth() + 1)}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}
export const isDtNewBusiness = (type: string | null | undefined) => /^DT\s*-\s*New Business$/i.test(String(type ?? "").trim());
export const isRunningBusiness = (type: string | null | undefined) => /^Running Business$/i.test(String(type ?? "").trim());
/** Re-entered: it had been in a later stage before (the stage's history, any order). */
export const reentered = (stagesSeen: string[]) => stagesSeen.some((s) => REOPEN_STAGES.includes(s));

/** The properties the request is read with. */
export const REQUEST_PROPS = [
  "subject", "hubspot_owner_id", "hs_pipeline", "hs_pipeline_stage", "createdate", "gqs_type_of_request", "customer_number_customer_name",
  "order_potential_", "margin__", "liquidation_article", "price_tier_approver", "status_of_gqs", "back_office_ticket_requester", "type_of_sales_ticket",
  "o_number", "upload_template", "article", "quantity_lot_size", "material", "colour", "dimensions", "delivery_date", "certificates_docs_datasheets",
  "target_price", "previous_supplier_competitior_", "one_off_recurring_", "expected_answer_date", "content", "type_of_product",
  "a_p_item_number_if_existing_part_", "call_off", "define_annual_quantites", "hardness", "temperature_range", "tolerances", "other_certificates_to_gqs",
  "original_neutralised_drawing", "molded_parts___extruded_profiles", "why_the_request_for_molded_profiles__",
  "if_benchmark__target_price___reason_for_benchmark_", "sampling_requirements", "special_packaging___winding",
  "if_linear_rotataion_bonded_seals___denomination__type__", "application__e_g__automotive_etc___", "working_temperature",
  "special_surface__coating__treatment___marking", "special_packaging", `hs_v2_date_entered_${STAGE.createdBySales}`,
];

type P = Record<string, string | null | undefined>;
const v = (p: P, k: string) => String(p[k] ?? "").trim();

/** The RFQ sheet of a DT - New Business request, line for line as the workflow's code wrote it. */
export function rfqCsv(p: P): string {
  const callOff = v(p, "call_off");
  const callOffValue = callOff === "1 call off" ? `1 call off - Delivery date: ${v(p, "delivery_date")}` : /Annual/.test(callOff) ? `Annual quantity and call offs - ${v(p, "define_annual_quantites")}` : callOff;
  const certs = v(p, "certificates_docs_datasheets");
  const certValue = /Others/.test(certs) ? `${certs} - ${v(p, "other_certificates_to_gqs")}` : certs;
  const molded = ["true", "yes"].includes(v(p, "molded_parts___extruded_profiles").toLowerCase());
  return [
    "DT Parts - Minimum RFQ Requirements",
    `Customer number/customer name:,${v(p, "customer_number_customer_name")}`,
    `Type of product:,${v(p, "type_of_product")}`,
    `A+P item number if existing part:,${v(p, "a_p_item_number_if_existing_part_")}`,
    `Quantity/Lot Size:,${v(p, "quantity_lot_size")}`,
    `Call off:,${callOffValue}`,
    `Material:,${v(p, "material")}`,
    `Hardness:,${v(p, "hardness")}`,
    `Colour:,${v(p, "colour")}`,
    `Dimensions:,${v(p, "dimensions")}`,
    `Temperature range:,${v(p, "temperature_range")}`,
    `Tolerances:,${v(p, "tolerances")}`,
    `Certificates/DoCs/Datasheets:,${certValue}`,
    "",
    `Original / Neutralised Drawing:,${v(p, "original_neutralised_drawing") || "Not provided"}`,
    "", "",
    `Customer request:,${v(p, "content")}`,
    "",
    "PAE:,NONE",
    "Molded Parts / Extruded Profiles - Additional MUST RFQ Requirements",
    ...(molded ? [
      "Molded Parts / Extruded Profiles:,Yes",
      `Why the request for molded/profiles?:,${v(p, "why_the_request_for_molded_profiles__")}`,
      `If Benchmark Target Price / Reason for Benchmark:,${v(p, "if_benchmark__target_price___reason_for_benchmark_")}`,
      `Sampling requirements:,${v(p, "sampling_requirements")}`,
      "", "",
      `Special packaging / Winding:,${v(p, "special_packaging___winding")}`,
    ] : ["Molded Parts / Extruded Profiles:,No", "", "", "", "", ""]),
    "Linear- / Rotation Sealings / Bonded Seals - Additional MUST RFQ Requirements",
    `If Linear/Rotataion/Bonded Seals - Denomination:,${v(p, "if_linear_rotataion_bonded_seals___denomination__type__")}`,
    "", "",
    `Target purchase price:,${v(p, "target_price")}`,
    `Application (e.g. Automotive etc.):,${v(p, "application__e_g__automotive_etc___")}`,
    `Working temperature:,${v(p, "working_temperature")}`,
    `Special surface coating treatment / Marking:,${v(p, "special_surface__coating__treatment___marking")}`,
    `Special packaging:,${v(p, "special_packaging")}`,
  ].join("\n");
}

/** The request's details for a mail, as the workflow's mails listed them per type; empty ones left out. */
export function mailFields(p: P): [string, string][] {
  const dt = isDtNewBusiness(p.gqs_type_of_request);
  const list: [string, string][] = dt ? [
    ["O-Number", "o_number"], ["GQS type", "gqs_type_of_request"], ["Name", "subject"], ["Customer", "customer_number_customer_name"],
    ["Type of product", "type_of_product"], ["A+P item number", "a_p_item_number_if_existing_part_"], ["Quantity / lot size", "quantity_lot_size"],
    ["Call off", "call_off"], ["Delivery date", "delivery_date"], ["Annual quantities", "define_annual_quantites"], ["Material", "material"],
    ["Hardness", "hardness"], ["Colour", "colour"], ["Dimensions", "dimensions"], ["Temperature range", "temperature_range"], ["Tolerances", "tolerances"],
    ["Certificates / DoCs / datasheets", "certificates_docs_datasheets"], ["Other certificates to GQS", "other_certificates_to_gqs"],
    ["Molded parts", "molded_parts___extruded_profiles"], ["Why the request", "why_the_request_for_molded_profiles__"],
    ["Benchmark / target price", "if_benchmark__target_price___reason_for_benchmark_"], ["Sampling requirements", "sampling_requirements"],
    ["Special packaging / winding", "special_packaging___winding"], ["Denomination", "if_linear_rotataion_bonded_seals___denomination__type__"],
    ["Target price", "target_price"], ["Application", "application__e_g__automotive_etc___"], ["Working temperature", "working_temperature"],
    ["Special surface / coating", "special_surface__coating__treatment___marking"], ["Special packaging", "special_packaging"],
    ["Customer request", "content"], ["Expected answer date", "expected_answer_date"],
  ].map(([a, b]) => [a, b] as [string, string]) : [
    ["Name", "subject"], ["GQS type", "gqs_type_of_request"], ["Customer", "customer_number_customer_name"], ["Article(s)", "article"],
    ["Quantity / lot size", "quantity_lot_size"], ["Material", "material"], ["Colour", "colour"], ["Dimensions", "dimensions"], ["Delivery date", "delivery_date"],
    ["Certificates / DoCs / datasheets", "certificates_docs_datasheets"], ["Original / neutralised drawing", "original_neutralised_drawing"],
    ["In liquidation", "liquidation_article"], ["Margin", "margin__"], ["Target price", "target_price"], ["Total order potential", "order_potential_"],
    ["Previous supplier / competitor", "previous_supplier_competitior_"], ["One off / recurring", "one_off_recurring_"],
    ["Description", "content"], ["Expected answer date", "expected_answer_date"],
  ];
  return list.map(([label, key]) => {
    let val = v(p, key);
    if (key === "margin__" && val) { const n = num(val); if (n !== null) val = pct(n); }
    if (key === "order_potential_" && val) { const n = num(val); if (n !== null) val = eur(n); }
    if (key === "liquidation_article" && val) val = val === "true" ? "yes" : "no";
    return [label, val] as [string, string];
  }).filter(([, val]) => val);
}
