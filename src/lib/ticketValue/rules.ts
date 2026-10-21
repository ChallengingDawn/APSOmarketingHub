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
//
// THE HUB'S IMPROVEMENTS (SARCLA 20.10.2026, after reading the copy's first results) - decideHub(), and scoreTicket()
// when `Better` is passed; without it every function below is the workflow, unchanged:
//   - a value only on ESO and TSA tickets ("the value on the ticket should only be calculated on ESO/TSA")
//   - every automated ticket takes the value its automation gives ("it should get it from all automated tickets"):
//     erosion amount, push target, the cart in the subject, the push's order potential; lost leads and new registrants
//     the average first order; a second-purchase push the customer's own first order (he chose both, 20.10)
//   - a value a person typed is never overwritten, on any ticket
//   - price checks ("we can just copy the potential given, and set the confidence"): the articles and quantities the
//     customer priced (price_check_articles) x each article's own price per piece -> "article x quantity", high
//   - new registrants: what a new customer's first order is worth on average (he chose it) -> "company's potential", low
//   - products ("the detection of products is not working correctly"): Products & Pricing's list price is per ERP
//     price unit (1, 100 or 1,000 pieces) and its sales unit never says which ("Stk", "m", "Pcs" - never "100 Pcs"),
//     so the copy reads O-rings 100x too dear. The hub prices an article by what it actually sold for (revenue /
//     quantity, this year and last); each article takes the quantity on ITS line ("1120036838 x 100", "100 Stk"),
//     every article of the e-mail is added up, and "Stk", "pz", "szt", "ks" count as pieces too
//   - the ticket's PRIMARY company, not the first HubSpot lists (the lowest id)

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

/** What the hub knows that the workflow does not (the improvements above). */
export type Better = {
  /** the article's price per piece from what it sold for (revenue / quantity, this year and last); null = never sold */
  price: (article: string) => number | null;
  /** what a new customer's first order is worth on average; null = not worked out yet */
  firstOrder: number | null;
};

/** One company's first order: its orders of that day, one figure per order number. */
export function firstOrderValue(orders: { name: string; net: number; status: string }[]): number | null {
  const byBase = new Map<string, { whole: number | null; parts: number }>();
  for (const o of orders) {
    if (/credit/i.test(o.status)) continue;
    const num = o.name.split("|")[0].trim();
    const m = /^(.*)\.(\d{3})$/.exec(num);
    const base = m ? m[1] : num, pos = m ? m[2] : "000";
    const e = byBase.get(base) ?? { whole: null, parts: 0 };
    if (pos === "000") e.whole = (e.whole ?? 0) + o.net; else e.parts += o.net;
    byBase.set(base, e);
  }
  if (!byBase.size) return null;
  let sum = 0;
  for (const e of byBase.values()) sum += e.whole ?? e.parts;
  return sum > 0 ? sum : null;
}

// ---------------- THE HUB'S PRODUCT RULE ----------------
const QTY_WORD = "(?:pcs?|pieces?|pi[eèé]ces?|st[uü]?cks?|stk|stuks|pezzi|pz|piezas|sztuk|szt|units?|uds?|ks|pce)";
const QTY_ON_LINE = [
  new RegExp(`${B}(\\d{1,7})\\s*${QTY_WORD}\\.?${B}`, "iu"),
  new RegExp(`(?:qty|quantity|qte|qt[eèé]|menge|anzahl|st[uü]ckzahl|cantidad|quantit[aàé]|aantal|hoeveelheid|ilo[sś][cć])\\s*[:=]?\\s*(\\d{1,7})${B}`, "iu"),
];
const lineArticles = (line: string) => [...new Set([...line.matchAll(APSO_ART_RE), ...line.matchAll(BARE_ART_RE)].map((m) => m[1]).filter((a) => a.length === 10))];

/** Each article with the quantity on its own line: "1120036838 x 100", "100 x 1120036838", "100 Stk", "Menge: 100". */
export function articleQuantities(text: string): { article: string; qty: number }[] {
  const out = new Map<string, number>();
  for (const line of text.split(/\r?\n|;|\|/)) {
    for (const a of lineArticles(line)) {
      if (out.has(a)) continue;
      const near = [new RegExp(`${a}\\s*(?:[x×*]|pcs?\\.?:?)\\s*(\\d{1,7})${B}`, "iu"), new RegExp(`${B}(\\d{1,7})\\s*[x×*]\\s*${a}`, "iu"), ...QTY_ON_LINE];
      for (const r of near) {
        const m = r.exec(line);
        const q = m ? toNum(m[1]) : 0;
        if (q > 0 && q < 1_000_000) { out.set(a, Math.trunc(q)); break; }
      }
    }
  }
  // one article only, its quantity on another line: that quantity (as the workflow does, with the hub's words)
  if (!out.size) {
    const arts = findArticles(text).filter((a) => a.length === 10);
    if (arts.length === 1) {
      for (const r of QTY_ON_LINE) {
        const m = r.exec(text);
        const q = m ? toNum(m[1]) : 0;
        if (q > 0 && q < 1_000_000) { out.set(arts[0], Math.trunc(q)); break; }
      }
    }
  }
  return [...out].map(([article, qty]) => ({ article, qty }));
}

/** The articles a price check carries: "1120036838 x 100 (DT · Stk · no MOQ); 1120075420 x 30 (...)". */
export function priceCheckArticles(s: string | null | undefined): { article: string; qty: number }[] {
  return [...String(s ?? "").matchAll(/(\d{8,10})\s*x\s*(\d+(?:[.,]\d+)?)/g)].map((m) => ({ article: m[1], qty: toNum(m[2]) })).filter((x) => x.qty > 0);
}

/** Articles x quantities x each article's own price per piece; the ones that never sold are left out and said. */
export function priceArticles(items: { article: string; qty: number }[], price: Better["price"]): { value: number; priced: number; unpriced: number; why: string } {
  let value = 0, priced = 0, unpriced = 0;
  const parts: string[] = [];
  for (const { article, qty } of items.slice(0, 30)) {
    const pp = price(article);
    if (!pp || pp <= 0) { unpriced++; continue; }
    value += qty * pp;
    priced++;
    if (parts.length < 4) parts.push(`${article} ${qty}x${pp.toFixed(2)}`);
  }
  const more = priced > parts.length ? ` +${priced - parts.length} more` : "";
  return { value, priced, unpriced, why: `${parts.join(" + ")}${more}${unpriced ? ` (${unpriced} never sold, left out)` : ""}` };
}
export type CompanyFacts = { id: string; via: "ticket" | "contact" | "domain"; mandant: string; yp: number; tickets12m: number };

/** The 5-tier logic (score_ticket). Returns the value, its source and confidence, and why. */
export async function scoreTicket(api: Api, tid: string, p: Props, better?: Better): Promise<Scored> {
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
    const rs: { toObjectId: string | number; associationTypes?: { label?: string | null }[] }[] = ar2.json?.results ?? [];
    // the hub: the primary company; the workflow: the first one listed
    const pick = better ? rs.find((x) => (x.associationTypes ?? []).some((t) => t.label === "Primary")) ?? rs[0] : rs[0];
    if (pick) resolved = String(pick.toObjectId);
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

  // Tier 4, the hub's: each article with its own quantity x what it actually sold for per piece
  if (better) {
    const r = priceArticles(articleQuantities(text), better.price);
    if (r.priced && r.value > 0 && r.value < 1_000_000) {
      return { value: r.value, source: "product_lookup", confidence: "medium", why: r.why, company: facts, linked };
    }
  }
  // Tier 4 - article number + quantity -> Products & Pricing (sales unit + scale price)
  if (q && !better) {
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

// ---------------- THE HUB'S RULES ----------------

/** Where the hub's value comes from - the path, in the order it is tried. */
export type HubRule =
  | "not-eso-tsa" | "manual" | "unqualified"
  | "erosion" | "push" | "pricecheck" | "registrant" | "lostlead" | "secondpurchase"
  | "direct" | "cart" | "gqs" | "textqty" | "product" | "company" | "unknown";
export const HUB_RULES: { rule: HubRule; label: string; from: string; confidence: string; automated?: boolean }[] = [
  { rule: "not-eso-tsa", label: "Not ESO or TSA", from: "No value - only ESO and TSA tickets get one", confidence: "-" },
  { rule: "manual", label: "Typed by a person", from: "A person changed the value in HubSpot last - it is kept", confidence: "high" },
  { rule: "unqualified", label: "Not a sales ticket", from: "Tagged BISPHENOL ACTION, or an NPS survey in the subject - 0", confidence: "unqualified" },
  { rule: "erosion", label: "Erosion", from: "Its erosion amount (erosion_amount_2025)", confidence: "high", automated: true },
  { rule: "push", label: "Push (September, Marc, Nancy)", from: "Its push value (sept_push_target / order potential)", confidence: "high", automated: true },
  { rule: "pricecheck", label: "Price check", from: "The priced articles x quantities x what each article sells for per piece", confidence: "high", automated: true },
  { rule: "registrant", label: "New registrant", from: "The average first order of a new customer", confidence: "low", automated: true },
  { rule: "lostlead", label: "Lost lead", from: "The average first order of a new customer (the push is for a first purchase)", confidence: "low", automated: true },
  { rule: "secondpurchase", label: "Second purchase", from: "The customer's own first order (what it bought the first time)", confidence: "medium", automated: true },
  { rule: "cart", label: "Abandoned cart", from: "The cart amount in the subject", confidence: "high", automated: true },
  { rule: "direct", label: "Order potential", from: "The ticket's own Order potential", confidence: "high" },
  { rule: "gqs", label: "Its GQS ticket", from: "The Order potential of the GQS ticket linked to it", confidence: "high" },
  { rule: "textqty", label: "Quantity x price in the text", from: "A quantity and a price per piece written in the e-mail", confidence: "medium" },
  { rule: "product", label: "Articles x quantities", from: "Each article in the e-mail x the quantity on its line x what it sells for per piece", confidence: "medium" },
  { rule: "company", label: "The company's potential", from: "The primary company's yearly potential x 10% / its tickets of the last 12 months", confidence: "low" },
  { rule: "unknown", label: "No signal", from: "None of the above - 0", confidence: "low" },
];
const LOST_LEAD_RE = /^\s*lost\s*lead\b/i;
const SECOND_PURCHASE_RE = /^\s*push\s*for\s*second\s*purchase\b/i;

/** The customer's own first order: the ticket's primary company, its first order day, its orders of that day. */
async function ownFirstOrder(api: Api, tid: string): Promise<{ value: number; day: string; company: string } | null> {
  const ar = await api.get(`/crm/v4/objects/tickets/${tid}/associations/companies`);
  const rs: { toObjectId: string | number; associationTypes?: { label?: string | null }[] }[] = ar.status === 200 ? ar.json?.results ?? [] : [];
  const pick = rs.find((x) => (x.associationTypes ?? []).some((t) => t.label === "Primary")) ?? rs[0];
  if (!pick) return null;
  const company = String(pick.toObjectId);
  const cr = await api.get(`/crm/v3/objects/companies/${company}?properties=order_first_order_date`);
  const day = cr.status === 200 ? String(cr.json?.properties?.order_first_order_date ?? "").slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const from = Date.parse(`${day}T00:00:00Z`);
  const sr = await api.post("/crm/v3/objects/orders/search", {
    filterGroups: [{ filters: [{ propertyName: "associations.company", operator: "EQ", value: company }, { propertyName: "order_order_date", operator: "BETWEEN", value: String(from), highValue: String(from + 86_399_999) }] }],
    properties: ["hs_order_name", "order_total_net_revenue", "order_order_status"], limit: 100,
  });
  if (sr.status !== 200) return null;
  const v = firstOrderValue(((sr.json?.results ?? []) as { properties: Props }[]).map((o) => ({ name: o.properties.hs_order_name ?? "", net: toNum(o.properties.order_total_net_revenue), status: o.properties.order_order_status ?? "" })));
  return v ? { value: v, day, company } : null;
}

const RULE_OF_SOURCE: Record<string, HubRule> = { child_gqs: "gqs", text_qty_price: "textqty", product_lookup: "product", company_baseline: "company", unknown: "unknown", unqualified: "unqualified" };

/**
 * The hub's own rules: what the hub writes once it takes over. ESO and TSA only; a person's value first; then the
 * automated tickets with the value their automation gives; then the customer requests' path (scoreTicket with the
 * improvements). Writes only what changes.
 */
export async function decideHub(api: Api, tid: string, p: Props, human: boolean, today: string, better: Better): Promise<Decision & { rule: HubRule }> {
  const branch = branchOf(p);
  const pname = PIPELINES[p.hs_pipeline || ""];
  if (pname !== "ESO" && pname !== "TSA") return { branch, rule: "not-eso-tsa", action: "not an ESO or TSA ticket - no value", patch: null };
  const cur: Patch = { sales_potential_estimate: p.sales_potential_estimate ?? "", sales_potential_source: (p.sales_potential_source ?? "").trim(), sales_potential_confidence: (p.sales_potential_confidence ?? "").trim() };
  const done = (rule: HubRule, action: string, want: { value?: number | null; source: string; confidence: string }, scored?: Scored): Decision & { rule: HubRule } => {
    const next: Patch = { sales_potential_source: want.source, sales_potential_confidence: want.confidence };
    if (want.value !== undefined && want.value !== null) next.sales_potential_estimate = round2(want.value);
    const changed = next.sales_potential_source !== cur.sales_potential_source || next.sales_potential_confidence !== cur.sales_potential_confidence
      || (next.sales_potential_estimate !== undefined && Math.abs(toNum(next.sales_potential_estimate) - toNum(cur.sales_potential_estimate)) > 0.01)
      || (next.sales_potential_estimate !== undefined && !known(cur.sales_potential_estimate));
    const after = { ...p, ...(changed ? Object.fromEntries(Object.entries(next).map(([k, v]) => [k, String(v)])) : {}) };
    return { branch, rule, action, patch: changed ? next : null, scored, kpi: kpiEvents(tid, after, pname, today) };
  };
  if (human) return done("manual", "typed by a person - kept", { source: "manual_override", confidence: "high" });
  if (isUnqualified(p)) return done("unqualified", "not a sales ticket (Bisphenol / NPS)", { value: 0, source: "unqualified", confidence: "unqualified" });
  const subject = p.subject || "";
  // the automated tickets: the value their automation gives
  if (branch === "erosion" && toNum(p.erosion_amount_2025) > 0) return done("erosion", `erosion amount ${toNum(p.erosion_amount_2025)}`, { value: toNum(p.erosion_amount_2025), source: "direct_field", confidence: "high" });
  if (branch === "sept" && toNum(p.sept_push_target) > 0) return done("push", `push target ${toNum(p.sept_push_target)}`, { value: toNum(p.sept_push_target), source: "direct_field", confidence: "high" });
  if (branch === "pricecheck") {
    const r = priceArticles(priceCheckArticles(p.price_check_articles), better.price);
    if (r.priced && r.value > 0) return done("pricecheck", r.why, { value: r.value, source: "product_lookup", confidence: "high" });
  }
  const lost = LOST_LEAD_RE.test(subject);
  if ((branch === "newcustomer" || lost) && better.firstOrder) {
    return done(lost ? "lostlead" : "registrant", `the average first order ${better.firstOrder.toFixed(0)}`, { value: better.firstOrder, source: "company_baseline", confidence: "low" });
  }
  if (SECOND_PURCHASE_RE.test(subject)) {
    const f = await ownFirstOrder(api, tid);
    if (f) return done("secondpurchase", `its first order on ${f.day}: ${f.value.toFixed(0)} (company ${f.company})`, { value: f.value, source: "company_baseline", confidence: "medium" });
  }
  // the customer requests (and an automated ticket whose value is not known): the path
  const scored = await scoreTicket(api, tid, p, better);
  let rule: HubRule = RULE_OF_SOURCE[scored.source] ?? "unknown";
  if (scored.source === "direct_field") rule = /abandoned_cart/.test(scored.why) ? "cart" : /^order_potential_/.test(scored.why) && /push/i.test(subject) ? "push" : "direct";
  return done(rule, scored.why, { value: scored.source === "unqualified" ? 0 : scored.value, source: scored.source, confidence: scored.confidence }, scored);
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
  "erosion_key", "erosion_amount_2025", "sept_push_target", "price_check_key", "price_check_articles",
];
