// WHAT THE SHOP-ORDER SYNC WRITES - every HubSpot Order property rules.ts sets, with the
// shop's field it comes from, grouped for the "What it writes" page. Pure (the page imports
// it); a test holds it to provisionalProps, so a field added there and not here fails.

import { ERP_OWNED_AFTER_LINK } from "./rules";

export type Field = { name: string; from: string };
export type FieldGroup = { key: string; name: string; fields: Field[] };

export const FIELD_GROUPS: FieldGroup[] = [
  { key: "identity", name: "The order and its stage", fields: [
    { name: "hs_external_order_id", from: "increment_id - the web order number; the order is found by it" },
    { name: "hs_order_name", from: "\"A-number | company\" once the ERP linked it, else \"Magento order (number)\"" },
    { name: "order_order_number", from: "the ERP's A-number, when the shop has it" },
    { name: "order_reconcile_state", from: "erp_linked with an A-number, else web_provisional" },
    { name: "hs_pipeline", from: "PERFORMIS" },
    { name: "hs_pipeline_stage", from: "Entered" },
    { name: "order_channel", from: "always eshop" },
    { name: "order_source_system", from: "always magento" },
    { name: "order_mandant", from: "100 for a CHF order, else 110" },
  ] },
  { key: "amounts", name: "Amounts", fields: [
    { name: "hs_currency_code", from: "order_currency_code" },
    { name: "hs_total_price", from: "grand_total" },
    { name: "hs_subtotal_price", from: "subtotal" },
    { name: "order_total_net_revenue", from: "subtotal" },
    { name: "hs_tax", from: "tax_amount" },
    { name: "hs_shipping_cost", from: "shipping_amount" },
    { name: "hs_order_discount", from: "discount_amount" },
    { name: "hs_discount_codes", from: "coupon_code" },
    { name: "hs_refund_amount", from: "total_refunded" },
    { name: "order_total_qty", from: "total_qty_ordered" },
    { name: "order_item_count", from: "total_item_count" },
    { name: "hs_total_weight", from: "weight" },
  ] },
  { key: "status", name: "Dates, status and payment", fields: [
    { name: "hs_external_created_date", from: "created_at" },
    { name: "hs_external_modified_date", from: "updated_at" },
    { name: "order_order_date", from: "created_at - the day" },
    { name: "hs_external_order_status", from: "status - processing, transferred, complete…" },
    { name: "hs_payment_processing_method", from: "payment.method" },
    { name: "hs_payment_status", from: "paid, partial or pending - total_paid against grand_total" },
  ] },
  { key: "billing", name: "Billing address", fields: [
    { name: "order_customer_name", from: "the billing company, else the customer's name" },
    { name: "hs_billing_address_name", from: "the billing company, else the customer's name" },
    { name: "hs_billing_address_firstname", from: "billing_address.firstname" },
    { name: "hs_billing_address_lastname", from: "billing_address.lastname" },
    { name: "hs_billing_address_email", from: "customer_email" },
    { name: "hs_billing_address_phone", from: "billing_address.telephone" },
    { name: "hs_billing_address_street", from: "billing_address.street" },
    { name: "hs_billing_address_city", from: "billing_address.city" },
    { name: "hs_billing_address_state", from: "billing_address.region" },
    { name: "hs_billing_address_postal_code", from: "billing_address.postcode" },
    { name: "hs_billing_address_country", from: "billing_address.country_id" },
  ] },
  { key: "shipping", name: "Shipping address", fields: [
    { name: "hs_shipping_address_name", from: "the shipping company, else the name" },
    { name: "hs_shipping_address_phone", from: "shipping address telephone" },
    { name: "hs_shipping_address_street", from: "shipping address street" },
    { name: "hs_shipping_address_city", from: "shipping address city" },
    { name: "hs_shipping_address_state", from: "shipping address region" },
    { name: "hs_shipping_address_postal_code", from: "shipping address postcode" },
    { name: "hs_shipping_address_country", from: "shipping address country_id" },
  ] },
  { key: "lines", name: "Lines", fields: [
    { name: "order_line_NN_article", from: "items.sku - up to 80 lines, a priced row and its zero twin as one" },
    { name: "order_line_NN_qty", from: "items.qty_ordered" },
    { name: "order_line_NN_revenue", from: "items.row_total" },
  ] },
];

const OWNED = new Set<string>(ERP_OWNED_AFTER_LINK);

/** Does the Compass sync take this field over once the ERP linked the order? (the lines too) */
export const erpOwned = (name: string) => OWNED.has(name) || name.startsWith("order_line_");

/** Every property name on the page, the lines as their NN pattern. */
export const fieldNames = () => FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.name));

/** The links the sync makes - and the one it leaves to the Compass sync. */
export const LINKS: { from: string; to: string; type: string; how: string }[] = [
  { from: "Order", to: "Contact", type: "HubSpot default", how: "Found by the order's email, never created. Tried again every 30 minutes; after 24 hours without a contact the order shows under Review queue." },
  { from: "Order", to: "Products & Pricing", type: "USER_DEFINED 119", how: "Each article, found by its article number (the shop's SKU). Once, when the order is first written; an article not in HubSpot is skipped." },
  { from: "Order", to: "Company", type: "HubSpot default", how: "The buyer's primary company (or their only one), read from the contact found by email - never guessed from the billing name. A buyer with no company leaves the order without one." },
];
