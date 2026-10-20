// TICKET VALUE - THE WORKFLOW'S RULES, LINE BY LINE (SARCLA 20.10.2026: "bring the workflow SARCLA | TICKET VALUE
// CALCULATION as a sub app on the hub"). HubSpot flow 4326395107, revision 25 (3 October 2026), on every ticket:
//   wait 4 minutes, then the first branch that matches -
//     EROSION      erosion_key known        -> the value = erosion_amount_2025, "direct_field", "high"
//     SEPT PUSH    sept_push_target known   -> the value = sept_push_target, "direct_field", "high"
//     PRICE CHECK  price_check_key known    -> nothing
//     New customers  tag 43412670 or 43412983 -> nothing
//     otherwise    its Python step "SALES POTENTIAL SCORER v2 (2026-06-14)" - ported below, function by function,
//                  with the same regular expressions, bounds and order (score_ticket -> scoreTicket, main -> decide,
//                  the KPI events -> kpiEvents). The calls to HubSpot go through `Api`, which answers like the
//                  Python `requests` did (a status, never a throw), so a failed read changes the result the same way.
// Pure apart from `Api`: the tests run it on a fake one.

// ---------------- CONSTANTS (the Python's) ----------------
export const KPI_OBJ = "2-201387076";
export const PROD_OBJ = "2-200042439"; // products___pricing custom object
export const PIPELINES: Record<string, string> = {
  "1726599376": "ESO",
  "1726599377": "TSA",
  "1726786775": "GQS",
  "1553929403": "SPR",
  "1726786777": "BO", // Back Office - sales leads also live here
};
export const GQS_PIPELINE = "1726786775";
export const CLOSED_STAGES_WON = new Set(["2124458187", "2520497377"]); // SPR Approved, GQS Offer Sent
export const CLOSED_STAGES_LOST = new Set(["2124458188", "2510335189"]); // SPR Refused, GQS Refused
export const ALL_CLOSED_STAGES = new Set([...CLOSED_STAGES_WON, ...CLOSED_STAGES_LOST,
  "2338232559", // ESO Closed
  "2338232563", // TSA Closed
  "2338266328", // BO Resolved
]);
/** baseline = (yearly_potential * COMPANY_WIN_RATE) / tickets_count_last_12m - lowered 14.06.2026 (0.25 -> 0.10) */
export const COMPANY_WIN_RATE = 0.10;
export const MIN_UNIT_PRICE = 0.0005;
export const MAX_UNIT_PRICE = 10000.0;
export const UNQUALIFIED_TAG_IDS = new Set(["38228151"]); // BISPHENOL ACTION main tag
export const NEW_CUSTOMER_TAGS = ["43412670", "43412983"];

/** The workflow's trigger: a ticket entering one of these (ESO/TSA "Waiting on customer", "In progress") is taken
 *  again - when its value is unknown, was written since yesterday, or not in the last 10 days. */
export const REENROL_STAGES: Record<string, string> = {
  "2338232557": "ESO · Waiting on customer",
  "3865966812": "ESO · In progress or offer sent",
  "2338232561": "TSA · Waiting on customer",
  "4962938099": "TSA · In Progress",
};
export const WAIT_MS = 4 * 60_000;

// ---------------- REGULAR EXPRESSIONS ----------------
// Python's \w and \b know every alphabet; JavaScript's only ASCII without help - so "a word character" is spelled out
// and \b is written as the two ways a boundary can fall.
const W = "[\\p{L}\\p{N}_]";
const B = `(?:(?<=${W})(?!${W})|(?<!${W})(?=${W}))`;
const SAFELINK_RE = /safelinks\.protection\.outlook\.com\/\?url=([^&]+)/giu;
const URLSAND_RE = /urlsand\.esvalabs\.com\/\?u=([^&]+)/giu;
const APSO_ART_RE = /apsoparts\.com\/[a-z]{2}-[A-Z]{2}\/(\d{8,10})-/giu;
// Bare 10-digit article - but NOT glued to letters/hyphen (kills "DT-1140401819", delivery-note refs, "0010.000")
const BARE_ART_RE = new RegExp(`(?<![\\p{L}\\p{N}_-])(\\d{10})(?![\\p{L}\\p{N}_-])`, "gu");
const CART_RE = /abandoned\s*cart\s*([\d.,]+)\s*(?:€|EUR|CHF|USD|\$)/iu;
// QUANTITY - keyword-anchored only
const QTY_REGEXES = [
  new RegExp(`${B}(\\d{1,7})\\s*(?:pcs?|pieces?|pi[eèé]ces?|st[uü]?cks?|stuks|pezzi|piezas|sztuk|units?|ud[s.]?)${B}`, "iu"),
  new RegExp(`(?:qty|quantity|qte|qt[eèé]|menge|anzahl|stuck|stueck|cantidad|aantal|hoeveelheid)\\s*[:=]?\\s*(\\d{1,7})${B}`, "iu"),
];
const PRICE_REGEXES = [
  /(\d+[.,]\d{1,4})\s*(?:€|EUR|CHF|USD|\$)\s*\/\s*(?:pc|piece|pi[eè]ce|st[uü]ck|pezzo)/iu,
  /(?:€|EUR|CHF|USD|\$)\s*(\d+[.,]\d{1,4})\s*(?:\/|per)\s*(?:pc|piece|pi[eè]ce|st[uü]ck|pezzo)/iu,
  /(\d+[.,]\d{1,4})\s*(?:€|EUR|CHF|USD|\$)\s*(?:per|\/|à|each|chaque)\s*(?:pc|piece|pi[eè]ce|st[uü]ck|pezzo)/iu,
  new RegExp(`(?:prix unitaire|unit price|st[uü]ckpreis|prezzo unit${W}*|precio unit${W}*)\\s*[:=]?\\s*(\\d+[.,]\\d{1,4})`, "iu"),
];
const UNQUALIFIED_SUBJECT_RE = /(bisphenol\s*action|nps\s*survey|nps\s*follow|nps\s*feedback)/iu;

// ---------------- HELPERS ----------------
/** Python's to_num: "1.234,5" -> 1234.5, "12,5" -> 12.5, anything unreadable -> 0. */
export function toNum(s: unknown): number {
  if (s === null || s === undefined) return 0;
  let t = String(s).trim().replace(/ /g, "").replace(/ /g, "");
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(/,/g, ".");
  else if (t.includes(",")) t = t.replace(/,/g, ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return 0;
  const v = Number(t);
  return Number.isFinite(v) ? v : 0;
}

/** Python's urllib.parse.unquote: %XX runs as UTF-8, a bad sequence becomes U+FFFD, anything else left alone. */
export function unquote(s: string): string {
  return s.replace(/(?:%[0-9a-fA-F]{2})+/g, (run) => {
    const bytes = new Uint8Array(run.length / 3);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(run.slice(i * 3 + 1, i * 3 + 3), 16);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  });
}

export const unwrapUrl = (s: string) => s.replace(SAFELINK_RE, (_, g: string) => unquote(g)).replace(URLSAND_RE, (_, g: string) => unquote(g));

export function findFirstQty(text: string): number | null {
  for (const r of QTY_REGEXES) {
    const m = r.exec(text);
    if (m) {
      const v = toNum(m[1]);
      if (v > 0 && v < 1_000_000) return Math.trunc(v);
    }
  }
  return null;
}

export function findFirstPrice(text: string): number | null {
  for (const r of PRICE_REGEXES) {
    const m = r.exec(text);
    if (m) {
      const v = toNum(m[1]);
      if (v > 0 && v < 100_000) return v;
    }
  }
  return null;
}

export function findArticles(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rx of [APSO_ART_RE, BARE_ART_RE]) {
    for (const m of text.matchAll(rx)) {
      const a = m[1];
      if (!seen.has(a)) { seen.add(a); out.push(a); }
    }
  }
  return out;
}

/** '100 Pcs' -> 100, 'Pcs' -> 1, '1000 Pcs' -> 1000. Default 1. */
export function parseUnitQty(salesUnit: unknown): number {
  if (!salesUnit) return 1.0;
  const m = /(\d[\d.,]*)/u.exec(String(salesUnit));
  if (m) {
    const v = toNum(m[1]);
    return v > 0 ? v : 1.0;
  }
  return 1.0;
}

type Props = Record<string, string | null | undefined>;

/** The price PER SALES-UNIT for this quantity: the scale-price tier that matches it, else the listed price; the M100
 *  or M110 columns by mandant. */
export function pickUnitPrice(props: Props, qty: number, mandant: string): number | null {
  const suffix = mandant === "M110" ? "__m110" : "";
  let bestPrice: number | null = null, bestQ = -1.0;
  for (let i = 1; i <= 10; i++) {
    const sq = toNum(props[`scale_quantity_${i}${suffix}`]);
    const sp = toNum(props[`scale_price_${i}${suffix}`]);
    if (sq > 0 && sp > 0 && qty >= sq && sq > bestQ) { bestQ = sq; bestPrice = sp; }
  }
  if (bestPrice === null) {
    const listed = mandant === "M110" ? "art_price__m110__listed_price" : "art_price__m100__listed_price";
    const lp = toNum(props[listed]);
    bestPrice = lp > 0 ? lp : null;
  }
  return bestPrice;
}

export function isUnqualified(p: Props): boolean {
  const tagIds = (p.hs_tag_ids || "").split(";");
  if (tagIds.some((t) => UNQUALIFIED_TAG_IDS.has(t.trim()))) return true;
  return UNQUALIFIED_SUBJECT_RE.test(p.subject || "");
}

/** Python's round(x, 2) - toFixed rounds the exact binary value as Python does (an exact tie aside). */
export const round2 = (v: number) => Number(v.toFixed(2));

const known = (v: unknown) => v !== null && v !== undefined && String(v) !== "";

// ---------------- THE WORKFLOW'S BRANCHES ----------------
export type Branch = "erosion" | "sept" | "pricecheck" | "newcustomer" | "score";
export const BRANCH_LABEL: Record<Branch, string> = {
  erosion: "Erosion ticket - its erosion amount",
  sept: "September push - its target",
  pricecheck: "Price check - left as it is",
  newcustomer: "New customer - left as it is",
  score: "Scored",
};
export function branchOf(p: Props): Branch {
  if (known(p.erosion_key)) return "erosion";
  if (known(p.sept_push_target)) return "sept";
  if (known(p.price_check_key)) return "pricecheck";
  const tags = (p.hs_tag_ids || "").split(";").map((t) => t.trim());
  if (tags.some((t) => NEW_CUSTOMER_TAGS.includes(t))) return "newcustomer";
  return "score";
}

// ---------------- HUBSPOT, AS THE PYTHON SAW IT ----------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Resp = { status: number; json: any };
export type Api = {
  get(path: string): Promise<Resp>;
  post(path: string, body: unknown): Promise<Resp>;
  /** the ticket -> company link; the shadow records it and sends nothing */
  put(path: string): Promise<Resp>;
};

export type Scored = { value: number; source: string; confidence: string; why: string; company?: CompanyFacts | null; linked?: string | null };
export type CompanyFacts = { id: string; via: "ticket" | "contact" | "domain"; mandant: string; yp: number; tickets12m: number };

/** The 5-tier logic (score_ticket). Returns the value, its source and confidence, and why. */
export async function scoreTicket(api: Api, tid: string, p: Props): Promise<Scored> {
  // Tier 0 - UNQUALIFIED (Bisphenol / NPS / non-sales)
  if (isUnqualified(p)) return { value: 0, source: "unqualified", confidence: "unqualified", why: "non-sales ticket (Bisphenol / NPS)" };

  const subject = p.subject || "";
  const content = unwrapUrl(p.content || "");
  const text = `${subject}\n${content}`;

  // Tier 1A - direct order_potential_ on this ticket
  let v = toNum(p.order_potential_);
  if (v > 0) return { value: v, source: "direct_field", confidence: "high", why: `order_potential_=${v}` };

  // Tier 1B - abandoned cart in the subject
  const cart = CART_RE.exec(subject);
  if (cart) {
    v = toNum(cart[1]);
    if (v > 0 && v < 1_000_000) return { value: v, source: "direct_field", confidence: "high", why: `abandoned_cart_subject=${v}` };
  }

  // Tier 2 - a GQS child (the GQS Special Request ticket holds the real value), read live
  const ar = await api.get(`/crm/v4/objects/tickets/${tid}/associations/tickets`);
  if (ar.status === 200) {
    const childIds = ((ar.json?.results ?? []) as { toObjectId?: string | number }[]).map((a) => a.toObjectId).filter(Boolean);
    if (childIds.length) {
      const br = await api.post("/crm/v3/objects/tickets/batch/read", { properties: ["hs_pipeline", "order_potential_"], inputs: childIds.slice(0, 10).map((c) => ({ id: String(c) })) });
      if (br.status === 200 || br.status === 207) {
        for (const c of (br.json?.results ?? []) as { id: string; properties?: Props }[]) {
          const cp = c.properties ?? {};
          if (cp.hs_pipeline === GQS_PIPELINE) {
            const cv = toNum(cp.order_potential_);
            if (cv > 0) return { value: cv, source: "child_gqs", confidence: "high", why: `gqs_child_${c.id}=${cv}` };
          }
        }
      }
    }
  }

  // Tier 3 - quantity x an explicit price per piece in the text
  const q = findFirstQty(text), prPc = findFirstPrice(text);
  if (q && prPc) {
    v = q * prPc;
    if (v > 0 && v < 1_000_000) return { value: v, source: "text_qty_price", confidence: "medium", why: `${q}x${prPc.toFixed(2)}` };
  }

  // ---- the company: the ticket's, else a contact's, else a company with the contact's e-mail domain ----
  const company = { mandant: "M100", yp: 0.0, tickets12m: 0 };
  let resolved: string | null = null, via: CompanyFacts["via"] = "ticket", linked: string | null = null;
  const ar2 = await api.get(`/crm/v4/objects/tickets/${tid}/associations/companies`);
  if (ar2.status === 200) {
    const rs = ar2.json?.results ?? [];
    if (rs.length) resolved = String(rs[0].toObjectId);
  }
  if (!resolved) {
    const crContacts = await api.get(`/crm/v4/objects/tickets/${tid}/associations/contacts`);
    if (crContacts.status === 200) {
      for (const cassoc of (crContacts.json?.results ?? []) as { toObjectId?: string | number }[]) {
        const conId = cassoc.toObjectId;
        if (!conId) continue;
        const cc = await api.get(`/crm/v4/objects/contacts/${conId}/associations/companies`);
        if (cc.status === 200) {
          const cs = cc.json?.results ?? [];
          if (cs.length) { resolved = String(cs[0].toObjectId); via = "contact"; break; }
        }
        if (!resolved) {
          const cdet = await api.get(`/crm/v3/objects/contacts/${conId}?properties=email`);
          if (cdet.status === 200) {
            const em = String(cdet.json?.properties?.email || "").trim().toLowerCase();
            if (em && em.includes("@")) {
              const dom = em.split("@").slice(1).join("@");
              if (dom && !["apsoparts.com", "angst-pfister.com", "apso-parts.com"].some((x) => dom.endsWith(x))) {
                const sr = await api.post("/crm/v3/objects/companies/search", { filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: dom }] }], properties: ["name"], limit: 1 });
                if (sr.status === 200) {
                  const rs2 = sr.json?.results ?? [];
                  if (rs2.length) { resolved = String(rs2[0].id); via = "domain"; break; }
                }
              }
            }
          }
        }
      }
    }
    if (resolved) {
      await api.put(`/crm/v4/objects/tickets/${tid}/associations/default/companies/${resolved}`);
      linked = resolved;
    }
  }
  let facts: CompanyFacts | null = null;
  if (resolved) {
    const cr = await api.get(`/crm/v3/objects/companies/${resolved}?properties=mandant,yearly_customer_potential,tickets_count_last_12m`);
    if (cr.status === 200) {
      const cp: Props = cr.json?.properties ?? {};
      company.mandant = cp.mandant || "M100";
      company.yp = toNum(cp.yearly_customer_potential);
      company.tickets12m = toNum(cp.tickets_count_last_12m);
    }
    facts = { id: resolved, via, ...company };
  }

  // Tier 4 - article number + quantity -> Products & Pricing (sales unit + scale price)
  if (q) {
    const mandant = company.mandant;
    const suffix = mandant === "M110" ? "__m110" : "";
    const listedField = mandant === "M110" ? "art_price__m110__listed_price" : "art_price__m100__listed_price";
    const prodProps = ["article_number", "sales_unit", listedField];
    for (let i = 1; i <= 10; i++) prodProps.push(`scale_quantity_${i}${suffix}`, `scale_price_${i}${suffix}`);
    for (const a of findArticles(text).slice(0, 3)) {
      const sr = await api.post(`/crm/v3/objects/${PROD_OBJ}/search`, { filterGroups: [{ filters: [{ propertyName: "article_number", operator: "EQ", value: a }] }], properties: prodProps, limit: 1 });
      if (sr.status === 200) {
        const rs = sr.json?.results ?? [];
        if (rs.length) {
          const pp: Props = rs[0].properties ?? {};
          const unitPrice = pickUnitPrice(pp, q, mandant); // per sales unit
          if (unitPrice && unitPrice > 0) {
            const unitQty = parseUnitQty(pp.sales_unit); // e.g. 100
            v = (q / unitQty) * unitPrice;
            const eff = q ? v / q : 0; // per piece
            if (v > 0 && v < 1_000_000 && MIN_UNIT_PRICE < eff && eff < MAX_UNIT_PRICE) {
              return { value: v, source: "product_lookup", confidence: "medium", why: `${q}pcs/(unit${unitQty.toFixed(0)})x${unitPrice.toFixed(2)}=${v.toFixed(0)}(art ${a},${mandant})`, company: facts, linked };
            }
          }
        }
      }
    }
  }

  // Tier 5 - the company's baseline (the last resort)
  const yp = company.yp;
  if (yp > 0) {
    const tc = company.tickets12m || 0;
    if (tc > 0) {
      v = (yp * COMPANY_WIN_RATE) / tc;
      return { value: v, source: "company_baseline", confidence: "low", why: `(yp${yp.toFixed(0)}*${COMPANY_WIN_RATE})/tc${tc.toFixed(0)}=${v.toFixed(0)}`, company: facts, linked };
    }
    v = (yp * COMPANY_WIN_RATE) / 12; // when tickets_count_last_12m is not filled
    return { value: v, source: "company_baseline", confidence: "low", why: `(yp${yp.toFixed(0)}*${COMPANY_WIN_RATE})/12=${v.toFixed(0)} (no tc)`, company: facts, linked };
  }
  return { value: 0, source: "unknown", confidence: "low", why: "no signal", company: facts, linked };
}

/** A person (not the workflow, not an app) wrote the value last: the scorer leaves it alone. */
export type HistoryEntry = { value?: string | null; timestamp?: string; sourceType?: string; sourceId?: string | null };
export function lastEditorIsHuman(hist: HistoryEntry[] | undefined): boolean {
  const top = hist?.[0];
  if (!top) return false;
  const st = String(top.sourceType || "").toUpperCase();
  const sid = String(top.sourceId || "");
  return ["CRM_UI", "EMAIL", "SALESFORCE", "IMPORT"].includes(st) || sid.startsWith("userId:");
}

export type Patch = Partial<Record<"sales_potential_estimate" | "sales_potential_source" | "sales_potential_confidence", string | number>>;
export type Decision = {
  branch: Branch;
  /** the Python's own words: "scored->company_baseline(...)", "unchanged(unknown)", "respect_manual_override(human)" */
  action: string;
  patch: Patch | null;
  scored?: Scored;
  /** the KPI object rows it upserts / archives (names) */
  kpi?: { upsert: string[]; archive: string[] };
};

/**
 * What the workflow does to one ticket, from its properties as they were (`p`) and whether a person wrote the value
 * last (`human`). The branch actions first; then the Python's main(): unqualified, a person's value, or score again.
 */
export async function decide(api: Api, tid: string, p: Props, human: boolean, today: string): Promise<Decision> {
  const branch = branchOf(p);
  if (branch === "erosion" || branch === "sept") {
    const from = branch === "erosion" ? "erosion_amount_2025" : "sept_push_target";
    const patch: Patch = { sales_potential_confidence: "high", sales_potential_source: "direct_field" };
    if (known(p[from])) patch.sales_potential_estimate = toNum(p[from]);
    return { branch, action: `copied ${from}`, patch };
  }
  if (branch !== "score") return { branch, action: "left as it is", patch: null };

  const pname = PIPELINES[p.hs_pipeline || ""];
  if (!pname) return { branch, action: "not_tracked_pipeline", patch: null };
  let srcCur = (p.sales_potential_source || "").trim();
  let potCur = toNum(p.sales_potential_estimate);
  let action = "noop";
  let patch: Patch | null = null;
  let scored: Scored | undefined;
  const q: Props = { ...p };

  if (isUnqualified(p) && srcCur !== "unqualified") {
    patch = { sales_potential_source: "unqualified", sales_potential_confidence: "unqualified", sales_potential_estimate: 0 };
    Object.assign(q, { sales_potential_source: "unqualified", sales_potential_confidence: "unqualified", sales_potential_estimate: "0" });
    srcCur = "unqualified"; potCur = 0;
    action = "flagged_unqualified(Bisphenol/NPS)";
  }
  if (srcCur === "unqualified" && action === "noop") {
    action = "respect_unqualified";
  } else if (srcCur !== "unqualified") {
    if (human) {
      if (srcCur !== "manual_override") {
        patch = { sales_potential_source: "manual_override", sales_potential_confidence: "high" };
        Object.assign(q, { sales_potential_source: "manual_override", sales_potential_confidence: "high" });
        action = `flagged_manual_override(human=${potCur.toFixed(0)})`;
      } else {
        action = "respect_manual_override(human)";
      }
    } else {
      scored = await scoreTicket(api, tid, p);
      const { value: v, source: src, confidence: conf, why } = scored;
      const changed = src !== srcCur || Math.abs(v - potCur) > 0.01 || src === "unqualified";
      if (changed) {
        patch = { sales_potential_source: src, sales_potential_confidence: conf, sales_potential_estimate: src === "unqualified" ? 0 : round2(v) };
        Object.assign(q, { sales_potential_source: src, sales_potential_confidence: conf, sales_potential_estimate: String(src === "unqualified" ? 0 : v) });
        action = `scored->${src}(${why})`;
      } else {
        action = `unchanged(${src})`;
      }
    }
  }
  return { branch, action, patch, scored, kpi: kpiEvents(tid, q, pname, today) };
}

/** STEP 2 of the Python: the KPI object rows (sales_funnel|<kind>|tid<id>) it writes or archives for this run. */
export function kpiEvents(tid: string, p: Props, pname: string, today: string): { upsert: string[]; archive: string[] } {
  const upsert: string[] = [], archive: string[] = [];
  const cdIso = (p.createdate || "").slice(0, 10);
  const clsdIso = (p.closed_date || "").slice(0, 10);
  const stage = p.hs_pipeline_stage || "";
  const isClosed = ALL_CLOSED_STAGES.has(stage);
  const src = (p.sales_potential_source || "unknown").trim();
  const pot = toNum(p.sales_potential_estimate);
  if (cdIso === today) {
    upsert.push(`sales_funnel|created|tid${tid}`);
    if (pot > 0) upsert.push(`sales_funnel|pot_created|tid${tid}`);
    if (pname === "GQS") upsert.push(`sales_funnel|gqs|tid${tid}`);
    if (pname === "SPR") upsert.push(`sales_funnel|spr|tid${tid}`);
  }
  if (isClosed && (clsdIso === today || !clsdIso)) {
    upsert.push(`sales_funnel|closed|tid${tid}`);
    if (pot > 0) upsert.push(`sales_funnel|${CLOSED_STAGES_LOST.has(stage) ? "pot_lost" : "pot_won"}|tid${tid}`);
  }
  (isClosed ? archive : upsert).push(`sales_funnel|live|tid${tid}`);
  (src === "manual_override" ? upsert : archive).push(`sales_funnel|mo|tid${tid}`);
  return { upsert, archive };
}

/** The properties the workflow reads from a ticket (main()'s GET plus the branches'). */
export const TICKET_PROPS = [
  "hs_pipeline", "hs_pipeline_stage", "createdate", "closed_date", "subject", "content", "order_potential_",
  "sales_potential_estimate", "sales_potential_source", "sales_potential_confidence", "hubspot_owner_id", "hs_tag_ids",
  "erosion_key", "erosion_amount_2025", "sept_push_target", "price_check_key",
];
