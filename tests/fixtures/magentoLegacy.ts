// @ts-nocheck
// THE OLD CONNECTOR'S MAPPING, VERBATIM - copied from APSOAssistant
// smart-bar/gateway/magento-poller.js (provisionalProps, as live on 11.10.2026), with its
// config injected. The hub's port (src/lib/connectors/magento/rules.ts) is tested
// against it. Do not edit this to make a test pass: it is the reference.

const config = { magento: { pipelineId: "3687945443", pipelineStage: "5093087452" } };

export function provisionalProps(o) {
  const cur = o.order_currency_code || '';
  const n = (v) => (v == null || v === '' ? '' : String(v));
  const inc = o.increment_id != null ? String(o.increment_id) : '';
  // Maps Magento onto EXISTING native + order_* HubSpot props (nothing invented).
  // Compass is the daily source of truth and OVERWRITES the ERP-owned fields
  // (hs_order_name→A26, revenue, mandant, PC/GM, associations). Magento OWNS the
  // web fields below; blanks are stripped so we never wipe a Compass value.
  const toMs = (s) => { if (!s) return ''; const t = Date.parse(String(s).replace(' ', 'T') + 'Z'); return Number.isFinite(t) ? String(t) : ''; };
  const toDate = (s) => { const d = s ? new Date(String(s).replace(' ', 'T') + 'Z') : null; return (d && !isNaN(d)) ? String(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) : ''; };  // midnight-UTC epoch ms for date props
  const ba = o.billing_address || {};
  const shipAssign = ((o.extension_attributes && o.extension_attributes.shipping_assignments) || [])[0];
  const sa = (shipAssign && shipAssign.shipping && shipAssign.shipping.address) || {};
  const paid = Number(o.total_paid || 0);
  // A26 ERP order number, written back by the ERP and exposed in REST by the
  // Apso_OrderRestExport module. '' until that module is live → falls back to the
  // provisional flow below unchanged. When present we stamp the correct A26 right
  // away so the dashboard shows it the moment the order transfers; Compass just
  // re-writes it once on the next daily load.
  const erpNo = String((o.extension_attributes && o.extension_attributes.erp_order_number) || '').trim();
  const companyName = (ba.company || `${o.customer_firstname || ''} ${o.customer_lastname || ''}`.trim());
  const props = {
    hs_external_order_id: inc,                  // web order number = stable upsert/match key
    hs_order_name: erpNo ? `${erpNo} | ${companyName}` : (inc ? `Magento order (${inc}) - to be overwritten` : ''),  // A26 when known, else provisional (Compass overwrites)
    order_order_number: erpNo,                  // A26 (ERP write-back) when available; blank is stripped → provisional
    hs_pipeline: config.magento.pipelineId,
    hs_pipeline_stage: config.magento.pipelineStage,   // Entered — required or HubSpot drops hs_pipeline too; Compass overwrites on reconcile
    hs_currency_code: cur,
    hs_total_price: n(o.grand_total),
    hs_subtotal_price: n(o.subtotal),
    hs_tax: n(o.tax_amount),
    hs_shipping_cost: n(o.shipping_amount),
    hs_order_discount: n(o.discount_amount),
    hs_discount_codes: n(o.coupon_code),
    hs_total_weight: n(o.weight),
    hs_refund_amount: n(o.total_refunded),
    // dates + external status (native external-order fields)
    hs_external_created_date: toMs(o.created_at),
    hs_external_modified_date: toMs(o.updated_at),
    hs_external_order_status: n(o.status),
    // payment
    hs_payment_processing_method: n(o.payment && o.payment.method),
    hs_payment_status: (paid > 0 && paid >= Number(o.grand_total || 0)) ? 'paid' : (paid > 0 ? 'partial' : 'pending'),
    // billing address (native hs_billing_*)
    hs_billing_address_name: ba.company || `${o.customer_firstname || ''} ${o.customer_lastname || ''}`.trim(),
    hs_billing_address_firstname: n(ba.firstname || o.customer_firstname),
    hs_billing_address_lastname: n(ba.lastname || o.customer_lastname),
    hs_billing_address_email: n(o.customer_email || ba.email),
    hs_billing_address_phone: n(ba.telephone),
    hs_billing_address_street: n(Array.isArray(ba.street) ? ba.street.join(', ') : ba.street),
    hs_billing_address_city: n(ba.city),
    hs_billing_address_state: n(ba.region),
    hs_billing_address_postal_code: n(ba.postcode),
    hs_billing_address_country: n(ba.country_id),
    // shipping address (native hs_shipping_*)
    hs_shipping_address_name: sa.company || `${sa.firstname || ''} ${sa.lastname || ''}`.trim(),
    hs_shipping_address_phone: n(sa.telephone),
    hs_shipping_address_street: n(Array.isArray(sa.street) ? sa.street.join(', ') : sa.street),
    hs_shipping_address_city: n(sa.city),
    hs_shipping_address_state: n(sa.region),
    hs_shipping_address_postal_code: n(sa.postcode),
    hs_shipping_address_country: n(sa.country_id),
    // quantities + provisional revenue/mandant (Compass overwrites revenue + mandant)
    order_total_qty: n(o.total_qty_ordered),
    order_item_count: n(o.total_item_count),
    order_total_net_revenue: n(o.subtotal),     // provisional webshop price — Compass overwrites
    order_order_date: toDate(o.created_at),      // provisional web placed-date — Compass overwrites with the ERP order date
    order_mandant: cur === 'CHF' ? '100' : '110',
    order_customer_name: companyName,
    // coordination (Magento-owned; no native equivalent)
    order_channel: 'eshop',
    order_source_system: 'magento',
    order_reconcile_state: erpNo ? 'erp_linked' : 'web_provisional',   // deterministic once the A26 is known
  };
  // lines → existing order_line_NN_* (article / qty / revenue)
  const bySku = new Map();   // collapse priced row + rev-0 twin → keep higher-revenue
  for (const l of (o.items || [])) {
    if (!l.sku) continue;
    const prev = bySku.get(l.sku);
    if (!prev || Number(l.row_total || 0) > Number(prev.row_total || 0)) bySku.set(l.sku, l);
  }
  let i = 1;
  for (const l of bySku.values()) {
    if (i > 80) break;
    const p = `order_line_${String(i).padStart(2, '0')}_`;
    props[p + 'article'] = l.sku;
    props[p + 'qty'] = n(l.qty_ordered);
    props[p + 'revenue'] = n(l.row_total);
    i++;
  }
  // Never write blanks — that would wipe a Compass value.
  for (const k of Object.keys(props)) if (props[k] === '') delete props[k];
  return props;
}
