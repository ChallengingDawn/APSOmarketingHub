// THE SHOP-ORDER SYNC'S RULES - a Magento order in, the HubSpot Order properties out.
// Ported line for line from APSOAssistant's smart-bar/gateway/magento-poller.js
// (provisionalProps, validate, orderSkus), and held to it by a test that runs the old
// JavaScript on the same orders. Pure: no HubSpot, no Magento, no database.
//
// One deliberate change (SARCLA, 11.10.2026): once the ERP has linked an order (it
// carries an A-number, or order_reconcile_state = erp_linked), its ERP-owned fields are
// never written again. The old connector protected only the name, the state and the
// A-number - every later shop update reset the stage to "Entered" and rewrote the
// order date, the net revenue, the mandant and the lines that the Compass sync had set.

export type MagentoOrder = Record<string, unknown> & {
  entity_id?: number | string;
  increment_id?: string | number;
  items?: { sku?: string; qty_ordered?: number | string; row_total?: number | string }[];
};

export type Props = Record<string, string>;

/** The ERP owns these once the order is linked to its A-number (the Compass sync writes them). */
export const ERP_OWNED_AFTER_LINK = [
  "hs_order_name", "order_reconcile_state", "order_order_number",
  "hs_pipeline", "hs_pipeline_stage",
  "order_order_date", "order_total_net_revenue", "order_mandant", "order_total_qty",
  // the Compass sync writes the ERP's net total here (11.10.2026: 58 linked orders showed the
  // shop's gross against the ERP's net - the old connector overwrote it on every shop change)
  "hs_total_price",
] as const;
const LINE = /^order_line_\d{2}_/;

type Address = { company?: string; firstname?: string; lastname?: string; email?: string; telephone?: string; street?: string | string[]; city?: string; region?: string; postcode?: string; country_id?: string };

const str = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(v));

/** The Magento timestamp "2026-10-10 14:28:03" (UTC) as epoch ms; "" when there is none. */
function toMs(s: unknown): string {
  if (!s) return "";
  const t = Date.parse(`${String(s).replace(" ", "T")}Z`);
  return Number.isFinite(t) ? String(t) : "";
}

/** The day of a Magento timestamp as midnight UTC epoch ms - HubSpot's date properties. */
function toDate(s: unknown): string {
  const d = s ? new Date(`${String(s).replace(" ", "T")}Z`) : null;
  return d && !Number.isNaN(d.getTime()) ? String(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) : "";
}

const street = (a: Address) => str(Array.isArray(a.street) ? a.street.join(", ") : a.street);

/** The provisional HubSpot order (the web order number is the key; the Compass sync overwrites the ERP fields). */
export function provisionalProps(o: MagentoOrder, pipe: { pipelineId: string; pipelineStage: string }): Props {
  const cur = str(o.order_currency_code);
  const inc = o.increment_id !== null && o.increment_id !== undefined ? String(o.increment_id) : "";
  const ba = (o.billing_address ?? {}) as Address;
  const ext = (o.extension_attributes ?? {}) as { shipping_assignments?: { shipping?: { address?: Address } }[]; erp_order_number?: string };
  const sa = (ext.shipping_assignments?.[0]?.shipping?.address ?? {}) as Address;
  const paid = Number(o.total_paid || 0);
  const erpNo = String(ext.erp_order_number || "").trim();
  const names = `${str(o.customer_firstname)} ${str(o.customer_lastname)}`.trim();
  const companyName = ba.company || names;
  const props: Props = {
    hs_external_order_id: inc,
    hs_order_name: erpNo ? `${erpNo} | ${companyName}` : inc ? `Magento order (${inc}) - to be overwritten` : "",
    order_order_number: erpNo,
    hs_pipeline: pipe.pipelineId,
    hs_pipeline_stage: pipe.pipelineStage,
    hs_currency_code: cur,
    hs_total_price: str(o.grand_total),
    hs_subtotal_price: str(o.subtotal),
    hs_tax: str(o.tax_amount),
    hs_shipping_cost: str(o.shipping_amount),
    hs_order_discount: str(o.discount_amount),
    hs_discount_codes: str(o.coupon_code),
    hs_total_weight: str(o.weight),
    hs_refund_amount: str(o.total_refunded),
    hs_external_created_date: toMs(o.created_at),
    hs_external_modified_date: toMs(o.updated_at),
    hs_external_order_status: str(o.status),
    hs_payment_processing_method: str((o.payment as { method?: string } | undefined)?.method),
    hs_payment_status: paid > 0 && paid >= Number(o.grand_total || 0) ? "paid" : paid > 0 ? "partial" : "pending",
    hs_billing_address_name: ba.company || names,
    hs_billing_address_firstname: str(ba.firstname || o.customer_firstname),
    hs_billing_address_lastname: str(ba.lastname || o.customer_lastname),
    hs_billing_address_email: str(o.customer_email || ba.email),
    hs_billing_address_phone: str(ba.telephone),
    hs_billing_address_street: street(ba),
    hs_billing_address_city: str(ba.city),
    hs_billing_address_state: str(ba.region),
    hs_billing_address_postal_code: str(ba.postcode),
    hs_billing_address_country: str(ba.country_id),
    hs_shipping_address_name: sa.company || `${sa.firstname || ""} ${sa.lastname || ""}`.trim(),
    hs_shipping_address_phone: str(sa.telephone),
    hs_shipping_address_street: street(sa),
    hs_shipping_address_city: str(sa.city),
    hs_shipping_address_state: str(sa.region),
    hs_shipping_address_postal_code: str(sa.postcode),
    hs_shipping_address_country: str(sa.country_id),
    order_total_qty: str(o.total_qty_ordered),
    order_item_count: str(o.total_item_count),
    order_total_net_revenue: str(o.subtotal),
    order_order_date: toDate(o.created_at),
    order_mandant: cur === "CHF" ? "100" : "110",
    order_customer_name: companyName,
    order_channel: "eshop",
    order_source_system: "magento",
    order_reconcile_state: erpNo ? "erp_linked" : "web_provisional",
  };
  // the lines: a priced row and its revenue-0 twin are one line - the higher revenue is kept
  const bySku = new Map<string, { sku?: string; qty_ordered?: number | string; row_total?: number | string }>();
  for (const l of o.items ?? []) {
    if (!l.sku) continue;
    const prev = bySku.get(l.sku);
    if (!prev || Number(l.row_total || 0) > Number(prev.row_total || 0)) bySku.set(l.sku, l);
  }
  let i = 1;
  for (const l of bySku.values()) {
    if (i > 80) break;
    const p = `order_line_${String(i).padStart(2, "0")}_`;
    props[`${p}article`] = String(l.sku);
    props[`${p}qty`] = str(l.qty_ordered);
    props[`${p}revenue`] = str(l.row_total);
    i++;
  }
  // never write a blank - it would wipe a value the Compass sync set
  for (const k of Object.keys(props)) if (props[k] === "") delete props[k];
  return props;
}

/**
 * The shop statuses of an order the ERP does not have yet. Once the shop has transferred an
 * order, the Compass sync holds it: its .000 entry is archived when the deliveries arrive, and
 * no active HubSpot order keeps the web order number (11.10.2026: 645 of the week's 1,034
 * shop orders, all "transferred"). Creating one then makes a twin of the ERP's order.
 */
export const SHOP_SIDE = new Set(["pending", "pending_payment", "payment_review", "processing", "holded", "new"]);
/** An order placed longer ago than this is never created - it reached the ERP, or the old connector, long ago. */
export const CREATE_WITHIN_DAYS = 30;

/**
 * Why an order HubSpot does not hold must NOT be created, or null when it may be.
 * `erpSince` = epoch ms the hub pulled the last ERP delivery. The shop transfers some orders
 * within a minute, before the first sweep sees them (12.10.2026: 5 of the day's orders, e.g.
 * 10000156325 placed 09:57 UTC, "transferred" at 09:58) - but an order placed after the last
 * delivery cannot be in the ERP's files yet, so it is created like any new order and
 * magento_stamp links it when the next delivery comes.
 */
export function mayNotCreate(props: Props, now = Date.now(), erpSince?: number): string | null {
  const status = props.hs_external_order_status ?? "";
  const placed = Number(props.hs_external_created_date);
  const newerThanErp = status === "transferred" && erpSince !== undefined && Number.isFinite(placed) && placed > erpSince;
  if (!SHOP_SIDE.has(status) && !newerThanErp) return `left to the ERP: the shop says "${status || "no status"}", and HubSpot holds no order with this web number`;
  if (Number.isFinite(placed) && now - placed > CREATE_WITHIN_DAYS * 86_400_000) return `left to the ERP: placed more than ${CREATE_WITHIN_DAYS} days ago`;
  return null;
}

/** Why an order cannot be written, or null. */
export function validate(props: Props): string | null {
  if (!props.hs_external_order_id) return "missing web order number";
  if (!props.hs_order_name) return "missing order name";
  if (!props.hs_currency_code) return "missing currency";
  return null;
}

/** The distinct article numbers of an order's lines. */
export function orderSkus(o: MagentoOrder): string[] {
  return [...new Set((o.items ?? []).map((l) => l.sku).filter((s): s is string => !!s).map(String))];
}

/** Has the ERP linked this HubSpot order (an A-number, or erp_linked)? */
export function erpLinked(existing: { order_order_number?: string | null; order_reconcile_state?: string | null } | null | undefined): boolean {
  if (!existing) return false;
  return (!!existing.order_order_number && existing.order_order_number.startsWith("A")) || existing.order_reconcile_state === "erp_linked";
}

/** What may be written onto an existing order: everything, or - once the ERP linked it - only the shop's own fields. */
export function writableProps(props: Props, existing: Parameters<typeof erpLinked>[0]): Props {
  if (!erpLinked(existing)) return props;
  const owned = new Set<string>(ERP_OWNED_AFTER_LINK);
  return Object.fromEntries(Object.entries(props).filter(([k]) => !owned.has(k) && !LINE.test(k)));
}

/** "2026-10-11T09:00:00.000Z" -> "2026-10-11 09:00:00" (Magento's filter format). */
export const magentoTs = (iso: string) => iso.slice(0, 19).replace("T", " ");

/** Two values the same, as HubSpot stores them: numbers as numbers, dates and datetimes as instants. */
export function same(ours: string, theirs: string | null | undefined): boolean {
  if (theirs === null || theirs === undefined) return false;
  if (ours === theirs) return true;
  const a = Number(ours), b = Number(theirs);
  if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  // ours: epoch ms; HubSpot: "2026-10-10T14:28:03Z" (datetime) or "2026-10-10" (date)
  if (/^\d{10,}$/.test(ours) && /^\d{4}-\d{2}-\d{2}/.test(theirs)) return Number(ours) === Date.parse(theirs.length === 10 ? `${theirs}T00:00:00Z` : theirs);
  return ours.trim() === theirs.trim();
}
