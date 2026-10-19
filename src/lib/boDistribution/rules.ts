// BACK OFFICE DISTRIBUTION - the rules, pure (SARCLA 18.10.2026: move the Back Office distribution to the hub,
// "a huge one and really vital ... it should work seamlessly"). A faithful copy of what the live HubSpot workflows
// decide, read from them on 18.10.2026 (C:\dev\hubspot-workflows-snapshot-2026-10-18, graph-3678508243.txt and the
// code steps):
//   route()        - "SARCLA | BACK OFFICE MAIN ROUTING" (3678508243): the branch tree, in its order;
//   findSalesAgent - the SA / SA Sub lookup shared by its code steps;
//   assignBo()     - code steps #23 (Assignment System), #27 / #42 (General Distribution v2), #31 (Load Balancer v2),
//                    #50's fallback (Task Status Report without a GQS task);
//   assignGqs()    - "SARCLA | NEW FOR BACK-OFFICE GQS DISTRIBUTION" (3680656607) code #1.
// Every assigner answers twice: "legacy" = exactly what the workflow code would pick from the same facts, quirks
// included; "hub" = the same rules with the known faults fixed (an archived person is never picked, a failed count
// is not read as an idle person, a user missing from HubSpot's list is away everywhere). Shadow mode compares legacy
// with what HubSpot really did (is the copy right?) and hub with legacy (what the fixes change).

export const BO = "1726786777", GQS = "1726786775";
export const STAGE = {
  boNew: "2338266325", boRedirectedFromChat: "2554860732", assigned: "2338266326", resolved: "2338266328",
  cutToSizeIssue: "5948837104", chatNewBoTopic: "5166408896", gqsNewForBo: "2338266314", gqsWaitingOnApso: "2338266316",
} as const;
/** Back Office stages the code counts as someone's workload. */
export const BO_OPEN_STAGES = ["2338266326", "2473210048", "2726922455", "2728031473", "2338266327"];
/** GQS stages the GQS code counts: 3279663337 no longer exists and 6078992599 "Waiting on APSO" is missing (legacy). */
export const GQS_OPEN_STAGES_LEGACY = ["2338266316", "4704538856", "2964068584", "3279663337"];
/** Working stages for "has ever been" checks in the chat path. */
const BO_WORKED = ["3640065212", "2726922455", "2473210048", "2338266328", "2338266327", "2338266326", "2728031473"];
/** ESO New, TSA / ESO "Redirected" - a ticket that came back from sales goes to the Load Balancer unclassified. */
const FROM_SALES = ["2338232556", "2621331643", "2624466140"];

export type Person = { id: string; name: string };
const P = (id: string, name: string): Person => ({ id, name });
export const PEOPLE = {
  claudia: P("76134337", "Claudia Cagnoni"), claudioG: P("1229976030", "Claudio Gabinato"), leart: P("37413486", "Leart Asllani"),
  adriana: P("76134415", "Adriana Deblander"), sara: P("30050251", "Sara Gashi"), maida: P("1207485931", "Maida Osmani"),
  vanessa: P("76134388", "Vanessa Battaglia"), rose: P("31935670", "Rose Rasteiro"), backofficeTeam: P("76164822", "Backoffice Team"),
};
const { claudia, claudioG, leart, adriana, sara, maida, vanessa } = PEOPLE;

/** The rosters exactly as the code steps carry them (order = tie-break). */
export const LEGACY = {
  primary23: [maida, sara],
  saToOwnerBo: [adriana, claudia, claudioG, leart, sara, maida],
  saToOwnerGqs: [claudia, claudioG, leart, sara, maida],
  team27: [claudia, claudioG, leart, adriana, sara],
  team31: [claudia, claudioG, sara, leart, adriana],
  team23: [claudia, claudioG, vanessa, adriana],
  team50: [claudia, claudioG, leart, adriana, sara],
  gqsTeam: [claudia, claudioG, leart, sara],
  gqsDt: [claudioG, leart],
};
/** The 17 senders of the "Sales" branch (emails to sales@ from them go to ESO with the rep, code #75). */
export const SALES_SPLIT_SENDERS = [
  "hans-peter.hoehn@apsoparts.com", "raffaello.lonardi@apsoparts.com", "jeremy.borey@apsoparts.com", "luca.fantasia@angst-pfister.com",
  "yani.alioua@apsoparts.com", "stefan.wieneber@apsoparts.com", "benjamin.nitschke@apsoparts.com", "christopher.stahl@apsoparts.com",
  "marc.frech@apsoparts.com", "claudio.saraiva@apsoparts.com", "simone.vitale@apsoparts.com", "tamara.mandl@apsoparts.com",
  "bernd.rausmann@apsoparts.com", "katja.storm@apsoparts.com", "nigel.vanderloo@apsoparts.com", "adem.can@apsoparts.com",
  "christoph.lange@apsoparts.com",
];

/* ── the route: MAIN ROUTING's tree ───────────────────────────────────────── */

export const SUB = {
  website: "enquiry_sub_category___website_issue___1", price: "enquiry_sub_category___price_1",
  delivery: "enquiry_sub_category___delivery___1", delivery2: "enquiry_sub_category___delivery___2",
  invoicing: "enquiry_sub_category___invoicing___accounting___1", product: "enquiry_sub_category___product_information___1",
} as const;

export type Classified = { category: string | null; subProperty: string | null; subCategory: string | null; orderNumber?: string | null };
export type RouteFacts = {
  subject: string;
  sourceType: string | null;
  aiChatSource: string | null;
  c2sProblemOrder: boolean;
  stage: string;
  /** every stage the ticket has been in (hs_pipeline_stage history), the current one included */
  stagesEver: string[];
  category: string | null;
  /** current sub-category values, by property name */
  subs: Partial<Record<string, string | null>>;
  /** an associated email was sent to sales@apsoparts.com / from one of SALES_SPLIT_SENDERS */
  emailToSales: boolean;
  emailFromSalesRep: boolean;
};
export type Assigner = "23" | "27" | "31" | "42" | "50" | "75";
export type Route = {
  /** the branch names taken, in order - the explanation */
  path: string[];
  /** the code step that picks the owner, if any */
  assigner: Assigner | null;
  /** properties the flow writes on the way (category, sub-categories, priority, dispatch, stage, owner, subject, comment) */
  sets: Record<string, string>;
  /** the classifier's answer when the path ran it */
  classified?: Classified;
  /** after #27: c2s_problem_order known -> stage Cut-to-Size issue */
  c2sStageAfter?: boolean;
};

/** HubSpot's subject "contains exactly" / "contains", read case-insensitively. */
const has = (s: string, ...needles: string[]) => needles.some((n) => s.toLowerCase().includes(n.toLowerCase()));

export function route(f: RouteFacts, classify: () => Classified): Route {
  const r: Route = { path: [], assigner: null, sets: {} };
  const set = (k: string, v: string) => { r.sets[k] = v; };
  const ever = (ids: string[]) => ids.some((s) => f.stagesEver.includes(s));
  let category = f.category;
  const subs = { ...f.subs };

  const router = () => {
    const sub = (p: string) => subs[p] ?? null;
    const delivery = has(f.subject, "PERFORMIS", "AVOR | WSMB") || category === "Delivery";
    if (category === "Website Issue") {
      r.path.push("Registration/Website issue");
      if (sub(SUB.website) === "Login Issue") { r.path.push("Login Issue"); set("hs_ticket_priority", "HIGH"); r.assigner = "23"; return; }
      set("hs_ticket_priority", "MEDIUM"); r.assigner = "27"; r.c2sStageAfter = f.c2sProblemOrder; return;
    }
    if (category === "Product Price") {
      r.path.push("PRODUCT PRICE");
      const s = sub(SUB.price);
      if (s === "Price is not visible") { r.path.push("Price is not visible"); set("hs_ticket_priority", "HIGH"); r.assigner = "27"; r.c2sStageAfter = f.c2sProblemOrder; return; }
      if (s === "Request for quotation") { r.path.push("Request for quotation"); set("hs_ticket_priority", "URGENT"); r.assigner = "42"; set("dispatch", "Send to ESO/TSA"); return; }
      set("hs_ticket_priority", "HIGH"); r.assigner = "27"; r.c2sStageAfter = f.c2sProblemOrder; return;
    }
    if (delivery) {
      r.path.push("DELIVERY");
      const s = sub(SUB.delivery);
      set("hs_ticket_priority", s === "Previous Order" || s === "Existing Order" ? "URGENT" : "HIGH");
      r.assigner = "27"; r.c2sStageAfter = f.c2sProblemOrder; return;
    }
    if (has(f.subject, "MICROSOFT")) {
      r.path.push("MICROSOFT EXCLUSION");
      set("comment_for_back_office", "⚠️ MICROSOFT DUPLICATE QUARANTINE"); set("hs_pipeline_stage", STAGE.resolved); return;
    }
    if (category === "Invoicing & Accounting") {
      r.path.push("INVOICING AND ACCOUNTING");
      set("hs_ticket_priority", sub(SUB.invoicing) === "Invoice not received" ? "MEDIUM" : "LOW");
      r.assigner = "27"; r.c2sStageAfter = f.c2sProblemOrder; return;
    }
    if (category === "Order Cancellation") {
      r.path.push("ORDER CANCELLATION"); set("hs_ticket_priority", "URGENT"); r.assigner = "27"; r.c2sStageAfter = f.c2sProblemOrder; return;
    }
    if (category === "Product Information") {
      r.path.push("PRODUCT INFORMATION");
      const s = sub(SUB.product);
      if (s === "Technical question on a product" || s === "Minimum order quantity for a product") {
        r.path.push(s === "Technical question on a product" ? "Technical question" : "MOQ");
        set("hs_ticket_priority", "HIGH"); r.assigner = "42"; set("dispatch", "Send to ESO/TSA"); return;
      }
      const prio = s === "Technical Data Sheet request" ? "MEDIUM" : s === "3D Model request" ? "LOW" : "HIGH";
      set("hs_ticket_priority", prio); r.assigner = "27"; r.c2sStageAfter = f.c2sProblemOrder; return;
    }
    r.path.push("ELSE -> Others"); set("enquiry_category", "Others"); set("hs_ticket_priority", "MEDIUM"); r.assigner = "31";
  };
  const classifier = () => {
    r.path.push("#22 classifier");
    const c = classify();
    r.classified = c;
    if (c.category) { category = c.category; set("enquiry_category", c.category); }
    if (c.subProperty && c.subCategory) { subs[c.subProperty] = c.subCategory; set(c.subProperty, c.subCategory); }
    if (c.category && c.orderNumber) set("order_number", c.orderNumber); // the step writes nothing without a category
    router();
  };

  // [77] C2S problem -> Delivery / Existing / late, URGENT, then the category router
  if (has(f.subject, "C2S PROBLEM") || f.c2sProblemOrder) {
    r.path.push("C2S Problem");
    category = "Delivery"; subs[SUB.delivery] = "Existing Order"; subs[SUB.delivery2] = "Delivery is late";
    set("enquiry_category", "Delivery"); set(SUB.delivery, "Existing Order"); set(SUB.delivery2, "Delivery is late"); set("hs_ticket_priority", "URGENT");
    router(); return r;
  }
  // [66] Anyseals stock file -> its own code, Resolved
  if (has(f.subject, "Anyseals Stock")) { r.path.push("ANYSEALS"); set("hs_pipeline_stage", STAGE.resolved); return r; }

  // [2] by origin: CHAT, EMAIL, AI CHAT, FORM, else - first match wins
  const chat = f.sourceType === "CHAT" || (f.sourceType !== "EMAIL" && f.aiChatSource === "CHAT");
  if (chat) {
    r.path.push(f.sourceType === "CHAT" ? "CHAT" : "AI CHAT");
    if (category === "Website Issue" && subs[SUB.website] === "Other Issue") { r.path.push("EXCLUDE SHOP BUG DANIEL"); return r; }
    if (category === "Product Information" && subs[SUB.product] === "3D Model request") {
      r.path.push("EXCLUDE FORM 3D REQUESTS");
      if (f.stage === STAGE.boRedirectedFromChat && !ever(BO_WORKED)) { r.path.push("REDIRECTED VIA THE CHAT"); set("dispatch", "Send to CAD TEAM"); }
      else if (f.stage === STAGE.boNew && ever(BO_WORKED)) { r.path.push("SENT TO CUSTOMER BY CAD"); set("hs_pipeline_stage", STAGE.resolved); }
      return r;
    }
    if (ever(["1", STAGE.chatNewBoTopic])) {
      r.path.push("RESENT TO BO BY TSA");
      set("hs_pipeline_stage", STAGE.boRedirectedFromChat); set("subject", `📍CHAT REQUEST | ${category ?? ""} | ROSE`); set("hubspot_owner_id", PEOPLE.rose.id);
      return r;
    }
    r.path.push("parked"); set("hs_pipeline_stage", STAGE.chatNewBoTopic); return r;
  }
  if (f.sourceType === "EMAIL") {
    r.path.push("EMAIL");
    if (has(f.subject, "Task Status Report")) { r.path.push("GQS EXCLUSION AND MAILS"); r.assigner = "50"; return r; }
    if (has(f.subject, "Request billing address", "ERP Order Export")) {
      r.path.push("CHANGES OF ACCOUNT ADDRESS");
      if (has(f.subject, "ERP Order Export")) { r.path.push("ERP ORDER EXPORT"); set("enquiry_category", "Delivery"); set(SUB.delivery, "Existing Order"); }
      else { set("enquiry_category", "Website Issue"); set(SUB.website, "Login Issue"); }
      set("hs_ticket_priority", "HIGH"); r.assigner = "23"; return r;
    }
    if (f.emailToSales) {
      r.path.push("Sales ticket Split");
      if (f.emailFromSalesRep) { r.path.push("Sales"); r.assigner = "75"; return r; }
      classifier(); return r;
    }
    if (has(f.subject, "PERFORMIS", "AVOR | WSMB")) {
      r.path.push("STOPPED ORDERS");
      category = "Delivery";
      set("enquiry_category", "Delivery"); set(SUB.delivery, "Existing Order"); set(SUB.delivery2, "Delivery is late"); set("hs_ticket_priority", "HIGH");
      r.assigner = "27"; r.c2sStageAfter = f.c2sProblemOrder; return r;
    }
    if (ever(FROM_SALES)) { r.path.push("ESO/TSA PIPELINE REDIRECT"); r.assigner = "31"; return r; }
    classifier(); return r;
  }
  if (f.sourceType === "FORM") { r.path.push("FORM"); router(); return r; }
  r.path.push("ELSE (API / hub / UI)");
  if (has(f.subject, "CERTIFICATES", "MAIL TO CUSTOMER")) { r.path.push("CERTIFICATES AND MAIL TO CUSTOMER"); return r; }
  router();
  return r;
}

/* ── the sales agent: company first, then contact ──────────────────────────── */

export type CompanyFacts = { id: string; name: string; domain?: string | null; website?: string | null; sa?: string | null; saSub?: string | null };
export type ContactFacts = { id: string; email?: string | null; name: string; sa?: string | null; companyId?: string | null };
export type SalesAgent = { sa: Person | null; saSub: Person | null; source: string | null; skippedInternal: string[]; companyToAssociate: string | null };

const INTERNAL = ["apsoparts.com", "angst-pfister.com"];
const internalEmail = (e?: string | null) => !!e && INTERNAL.some((d) => e.toLowerCase().trim().endsWith(`@${d}`));
const internalCompany = (c: CompanyFacts) => {
  const d = (c.domain || c.website || "").toLowerCase().trim();
  const n = (c.name || "").toLowerCase();
  return INTERNAL.some((x) => d.includes(x)) || (n.includes("angst") && n.includes("pfister")) || n.includes("apsoparts");
};

/** find_sales_agent: companies in association order (the first one with a known SA wins, a later one's SA Sub
 *  overwrites an earlier one's), then - only without a company SA - the first contact with a known SA. */
export function findSalesAgent(companies: CompanyFacts[], contacts: ContactFacts[], saToOwner: Person[]): SalesAgent {
  const byName = new Map(saToOwner.map((p) => [p.name.toLowerCase(), p]));
  const out: SalesAgent = { sa: null, saSub: null, source: null, skippedInternal: [], companyToAssociate: null };
  for (const c of companies) {
    if (internalCompany(c)) { out.skippedInternal.push(`${c.name} (company)`); continue; }
    const sa = byName.get((c.sa ?? "").trim().toLowerCase());
    if (sa) { out.sa = sa; out.source = `company: ${c.name}`; }
    const sub = byName.get((c.saSub ?? "").trim().toLowerCase());
    if (sub) { out.saSub = sub; out.source ??= `company: ${c.name}`; }
    if (out.sa) return out;
  }
  const hasCompany = companies.length > 0;
  for (const c of contacts) {
    if (internalEmail(c.email)) { out.skippedInternal.push(`${c.name} (${c.email})`); continue; }
    const sa = byName.get((c.sa ?? "").trim().toLowerCase());
    if (sa) {
      out.sa = sa; out.source = `contact: ${c.name}`;
      if (!hasCompany && c.companyId) out.companyToAssociate = c.companyId;
      return out;
    }
  }
  return out;
}

/* ── the assigners ──────────────────────────────────────────────────────────── */

/** HubSpot users' chat status by owner id: "available" / anything else / null (no status). Missing = not in the list. */
export type Availability = Map<string, string | null>;
/** Open tickets per owner; null = the count failed. */
export type Workload = Map<string, number | null>;
export type Mode = "legacy" | "hub";
export type Pick = { owner: Person | null; method: string; reasons: string[] };
/** The lists the page can change (hub mode only - the copy always uses LEGACY). */
export type RosterKey = keyof typeof LEGACY;
export const ROSTER_LABEL: Record<RosterKey, string> = {
  primary23: "Login / billing / ERP export - tried first, in order (#23)",
  saToOwnerBo: "Sales Agent names that count - Back Office",
  saToOwnerGqs: "Sales Agent names that count - GQS",
  team27: "General Distribution team (#27, #42)",
  team31: "Load Balancer team (#31)",
  team23: "Login / billing / ERP export - then least busy of (#23)",
  team50: "Task Status Report without a GQS task (#50)",
  gqsTeam: "GQS team",
  gqsDt: "GQS DT New Business - in order",
};

export type AssignInput = {
  sa: SalesAgent;
  /** hub mode: the sales agent found with the page's Sales Agent names (default: the same as sa) */
  saHub?: SalesAgent;
  /** every page of users (the code's paged read) */
  availability: Availability;
  /** only the first 100 users - #23 never pages */
  availabilityFirstPage: Availability;
  workload: Workload;
  /** owners HubSpot has archived (deactivated) */
  archived: Set<string>;
  /** hub mode: the lists from the page (default = the legacy lists; archived people are always left out) */
  pools?: Partial<Record<RosterKey, Person[]>>;
  /** hub mode, from Settings: who counts as available (chat dot / out of office / both), the workload counted on the
   *  page's stages, and the most open tickets a person may have before the least-busy step passes them over */
  availabilityHub?: Availability;
  workloadHub?: Workload;
  cap?: number | null;
  /** hub mode (SARCLA 19.10.2026 "if they are not available we should not pass"): nobody available -> nobody, the
   *  ticket waits in the Back Office queue; the workflow gives it to the least busy of everyone */
  waitWhenNobody?: boolean;
};

const isAvailable = (a: Availability, id: string, missing: boolean) => (a.has(id) ? a.get(id) === "available" : missing);
const leastBusy = (cands: { p: Person; n: number }[]) => [...cands].sort((x, y) => x.n - y.n)[0]; // stable: list order breaks ties

function pool(inp: AssignInput, key: RosterKey, mode: Mode): Person[] {
  if (mode === "legacy") return LEGACY[key];
  return (inp.pools?.[key] ?? LEGACY[key]).filter((x) => !inp.archived.has(x.id));
}
const salesAgent = (inp: AssignInput, mode: Mode) => (mode === "hub" ? inp.saHub ?? inp.sa : inp.sa);
const availOf = (inp: AssignInput, mode: Mode) => (mode === "hub" ? inp.availabilityHub ?? inp.availability : inp.availability);

/** Least busy of a pool. legacy: count failure = `onFail` (0, or 999 in the GQS code); everyone away -> everyone.
 *  hub: a failed count leaves the person out, an archived person is never in it. */
function balance(people: Person[], inp: AssignInput, mode: Mode, avail: (id: string) => boolean, onFail: number, reasons: string[]): Person | null {
  const load = mode === "hub" ? inp.workloadHub ?? inp.workload : inp.workload;
  let all = people.map((p) => ({ p, n: load.get(p.id), up: avail(p.id) }));
  if (mode === "hub" && inp.cap) {
    const under = all.filter((x) => typeof x.n !== "number" || x.n < inp.cap!);
    if (under.length && under.length < all.length) reasons.push(`at the limit of ${inp.cap} open tickets: ${all.filter((x) => !under.includes(x)).map((x) => x.p.name).join(", ")}`);
    if (under.length) all = under;
  }
  const known = mode === "hub" ? all.filter((x) => x.n !== null && x.n !== undefined) : all;
  if (mode === "hub" && known.length < all.length) reasons.push(`count failed for ${all.filter((x) => !known.includes(x)).map((x) => x.p.name).join(", ")} - left out`);
  const scored = known.map((x) => ({ p: x.p, n: x.n ?? onFail, up: x.up }));
  let cands = scored.filter((x) => x.up);
  if (!cands.length && mode === "hub" && inp.waitWhenNobody) { reasons.push("nobody available - waits in the queue"); return null; }
  if (!cands.length) { reasons.push("nobody available - least busy of everyone"); cands = scored; }
  const best = cands.length ? leastBusy(cands) : null;
  if (best) reasons.push(`least busy: ${scored.map((x) => `${x.p.name} ${x.n}${x.up ? "" : " (away)"}`).join(", ")}`);
  return best?.p ?? null;
}

/** #23 / #27 / #31 / #42 and #50's fallback. */
export function assignBo(step: "23" | "27" | "31" | "42" | "50", inp: AssignInput, mode: Mode): Pick {
  const reasons: string[] = [];
  const archivedOut = (p: Person | null) => (p && mode === "hub" && inp.archived.has(p.id) ? (reasons.push(`${p.name} is deactivated - skipped`), null) : p);
  if (step === "23") {
    const a = mode === "legacy" ? inp.availabilityFirstPage : availOf(inp, mode);
    for (const [i, p] of pool(inp, "primary23", mode).entries()) {
      if (isAvailable(a, p.id, false)) return { owner: p, method: i === 0 ? `Primary (${p.name})` : `Deputy (${p.name})`, reasons };
      reasons.push(`${p.name} away`);
    }
    return { owner: balance(pool(inp, "team23", mode), inp, mode, (id) => isAvailable(a, id, false), 0, reasons), method: "Least busy", reasons };
  }
  if (step === "50") {
    // no GQS task to merge into: least busy; a user missing from the list, or with no status, counts as AVAILABLE (legacy)
    const avail = (id: string) => (mode === "legacy" ? !inp.availability.has(id) || inp.availability.get(id) === null || inp.availability.get(id) === "available" : isAvailable(availOf(inp, mode), id, false));
    return { owner: balance(pool(inp, "team50", mode), inp, mode, avail, 999, reasons), method: "Least busy (no GQS task)", reasons };
  }
  // #27 / #42 / #31: SA -> SA Sub (availability only, no cap) -> least busy
  const avail = (id: string) => isAvailable(availOf(inp, mode), id, false);
  const found = salesAgent(inp, mode);
  const sa = archivedOut(found.sa);
  if (sa) { if (avail(sa.id)) return { owner: sa, method: `Sales Agent (${found.source})`, reasons }; reasons.push(`SA ${sa.name} away`); }
  else if (!found.sa) reasons.push("no SA");
  const sub = archivedOut(found.saSub);
  if (sub) { if (avail(sub.id)) return { owner: sub, method: `SA Sub (${found.source})`, reasons }; reasons.push(`SA Sub ${sub.name} away`); }
  return { owner: balance(pool(inp, step === "31" ? "team31" : "team27", mode), inp, mode, avail, 0, reasons), method: "Least busy", reasons };
}

/** GQS code #1: SA -> SA Sub -> "DT - New Business" to Claudio then Leart -> least busy of the GQS team. */
export function assignGqs(gqsType: string, inp: AssignInput, mode: Mode): Pick {
  const reasons: string[] = [];
  // legacy: for SA / SA Sub a user missing from the list is away; for DT and the team he is AVAILABLE
  const saAvail = (id: string) => isAvailable(availOf(inp, mode), id, false);
  const teamAvail = (id: string) => isAvailable(availOf(inp, mode), id, mode === "legacy");
  const found = salesAgent(inp, mode);
  for (const [p, label] of [[found.sa, "Sales Agent"], [found.saSub, "SA Sub"]] as const) {
    if (!p) continue;
    if (mode === "hub" && inp.archived.has(p.id)) { reasons.push(`${p.name} is deactivated - skipped`); continue; }
    if (saAvail(p.id)) return { owner: p, method: `${label} (${found.source})`, reasons };
    reasons.push(`${label} ${p.name} away`);
  }
  const t = gqsType.split(/\s+/).filter(Boolean).join(" ").toUpperCase();
  if (t.includes("DT") && t.includes("NEW BUSINESS")) {
    for (const p of pool(inp, "gqsDt", mode)) {
      if (teamAvail(p.id)) return { owner: p, method: "DT New Business priority", reasons };
      reasons.push(`${p.name} away`);
    }
  }
  return { owner: balance(pool(inp, "gqsTeam", mode), inp, mode, teamAvail, 999, reasons), method: "Least busy", reasons };
}

/* ── priority (SARCLA 19.10.2026: "a priority tab, to set the priority more accurately") ─────────────────────── */

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
/** The category router's priorities in MAIN ROUTING (18.10.2026); sub null = any other sub-category of that category. */
export const PRIORITY_TABLE: { key: string; category: string; sub: string | null; priority: Priority }[] = [
  ["Website Issue", "Login Issue", "HIGH"], ["Website Issue", null, "MEDIUM"],
  ["Product Price", "Price is not visible", "HIGH"], ["Product Price", "Request for quotation", "URGENT"], ["Product Price", null, "HIGH"],
  ["Delivery", "Existing Order", "URGENT"], ["Delivery", "Previous Order", "URGENT"], ["Delivery", null, "HIGH"],
  ["Invoicing & Accounting", "Invoice not received", "MEDIUM"], ["Invoicing & Accounting", null, "LOW"],
  ["Order Cancellation", null, "URGENT"],
  ["Product Information", "Technical question on a product", "HIGH"], ["Product Information", "Minimum order quantity for a product", "HIGH"],
  ["Product Information", "I need an alternative on a existing product", "HIGH"], ["Product Information", "Product cannot be found in the shop/Alternative products", "HIGH"],
  ["Product Information", "Technical Data Sheet request", "MEDIUM"], ["Product Information", "3D Model request", "LOW"], ["Product Information", null, "HIGH"],
  ["Others", null, "MEDIUM"],
].map(([category, sub, priority]) => ({ key: `${category}|${sub ?? "*"}`, category: category as string, sub: sub as string | null, priority: priority as Priority }));

export type PrioritySettings = {
  /** a line of the table set to another priority, by key "Category|Sub" or "Category|*" */
  overrides: Record<string, Priority>;
  raiseOnUrgentWords: boolean; urgentWords: string[];
  raiseKeyCustomers: boolean; keyCustomerPriorities: string[];
  lowerNewsletters: boolean; newsletterWords: string[];
};
export const DEFAULT_PRIORITY: PrioritySettings = {
  overrides: {},
  raiseOnUrgentWords: false,
  urgentWords: ["dringend", "eilt", "sofort", "urgent", "urgente", "urgentissimo", "asap", "as soon as possible", "pilne", "spoed", "dringende", "immédiatement", "stillstand", "line down", "production stop", "produktionsstopp", "arrêt de production"],
  raiseKeyCustomers: false, keyCustomerPriorities: ["P1"],
  lowerNewsletters: false,
  newsletterWords: ["newsletter", "unsubscribe", "abmelden", "désinscrire", "disiscriviti", "advent calendar", "adventskalender", "webinar", "no-reply", "noreply"],
};
/** What a ticket says that the priority signals read - found once, when the hub decides. */
export type PriorityFacts = { urgentHits: string[]; newsletterHits: string[]; salesPriority: string | null };
export function priorityFacts(text: string, salesPriority: string | null, s: PrioritySettings): PriorityFacts {
  const t = ` ${text.toLowerCase()} `;
  const hit = (words: string[]) => [...new Set(words.map((w) => w.trim().toLowerCase()).filter((w) => w && t.includes(w)))];
  return { urgentHits: hit(s.urgentWords), newsletterHits: hit(s.newsletterWords), salesPriority };
}
const step = (p: Priority, d: 1 | -1): Priority => PRIORITIES[Math.min(3, Math.max(0, PRIORITIES.indexOf(p) + d))];
/** The hub's priority: the workflow's (or the table line changed on the page), then the signals switched on. */
export function priorityFor(
  base: Priority | null, category: string | null, sub: string | null, facts: PriorityFacts | null | undefined, s: PrioritySettings,
): { value: Priority; base: Priority | null; why: string[] } | null {
  if (!base) return null;
  const why: string[] = [];
  let p = base;
  const line = (category && (s.overrides[`${category}|${sub ?? "*"}`] ?? (sub ? s.overrides[`${category}|*`] : undefined))) || null;
  if (line && line !== p) { why.push(`${category}${sub ? ` / ${sub}` : ""}: ${line} on the page (workflow ${p})`); p = line; }
  if (facts) {
    if (s.lowerNewsletters && facts.newsletterHits.length && p !== "LOW") { why.push(`newsletter / advertising ("${facts.newsletterHits[0]}") -> LOW`); return { value: "LOW", base, why }; }
    if (s.raiseOnUrgentWords && facts.urgentHits.length && p !== "URGENT") { const n = step(p, 1); why.push(`"${facts.urgentHits[0]}" in the e-mail -> ${n}`); p = n; }
    if (s.raiseKeyCustomers && facts.salesPriority && s.keyCustomerPriorities.includes(facts.salesPriority) && p !== "URGENT") { const n = step(p, 1); why.push(`key customer (${facts.salesPriority}) -> ${n}`); p = n; }
  }
  return { value: p, base, why };
}
