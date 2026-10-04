// DoC - what the app reads from its environment, in one place.
//
// The names are the ones SARCLA C2S V1 used, on purpose: switching the work over
// is moving DOC_CAPTURE_FROM and DOC_SEND_EMAIL from Railway to AWS, nothing else.
//
//   DOC_CAPTURE_FROM  ISO moment; shop orders placed from then on are flagged in
//                     HubSpot. Unset = capture off.
//   DOC_SEND_EMAIL    "1" = invoiced orders are emailed. Anything else = they wait
//                     under "Due", visible on the board, and nothing is sent.

function env(name: string): string | null {
  const v = process.env[name];
  if (v === undefined) return null;
  const t = v.trim();
  return t ? t : null;
}

export const DOC_SKU = "8001228582";
/** Fee lines are never products of their own: seal (automated) and plastics (Back Office). */
export const FEE_SKUS = new Set([DOC_SKU, "8001133004"]);

export const WEB_PROP = "order_web_order_number";
export const REQUEST_PROP = "order_doc_request";
export const STATUS_PROP = "order_doc_status";

export const INVOICED = "5093092552"; // PERFORMIS "Invoiced (Sent to customer)"
export const CANCELLED = "5676846286";
export const AP_NUMBER = /([A-Z]\d{2}\.\d{6})\.\d{3}/i;

export const CAPTURE_EVERY_MIN = 15;
export const SWEEP_EVERY_MIN = 60; // invoicing lands once a day

/** Where the Back Office ticket goes when no declaration is found at all - the
 *  same pipeline and stage C2S V1 used (its TICKET_PIPELINE_ID / TICKET_STAGE_ID). */
export const TICKET_PIPELINE_ID = env("DOC_TICKET_PIPELINE_ID") ?? "1726786777";
export const TICKET_STAGE_ID = env("DOC_TICKET_STAGE_ID") ?? "2338266325";

export const FROM = env("DOC_FROM") ?? "APSOparts® <info@news.apsoparts.com>";
export const REPLY_TO = env("DOC_REPLY_TO") ?? "support@apsoparts.com";

export function expireDays(): number {
  return Number(env("DOC_EXPIRE_DAYS") ?? 120);
}

/** Runaway breaker, not a throttle: September had about two seal declarations a day. */
export function maxPerDay(): number {
  return Number(env("DOC_MAX_PER_DAY") ?? 40);
}

export function captureFrom(): number {
  return Date.parse(env("DOC_CAPTURE_FROM") ?? "") || 0;
}

export function smtp() {
  return {
    host: env("DOC_SMTP_HOST") ?? "smtp.hubapi.com",
    port: Number(env("DOC_SMTP_PORT") ?? 587),
    user: env("DOC_SMTP_USER") ?? "",
    pass: env("DOC_SMTP_PASS") ?? "",
  };
}

/** PricingHub backend: article -> compound -> newest AP-Link declaration, and the PDF. */
export function backend() {
  return {
    url: (env("DOC_BACKEND_URL") ?? "https://commercehubbackend-production.up.railway.app").replace(/\/+$/, ""),
    key: env("DOC_BACKEND_KEY") ?? "",
  };
}

export function magentoKeys() {
  return {
    base: (env("MAGENTO_BASE_URL") ?? "https://www.apsoparts.com").replace(/\/+$/, ""),
    consumerKey: env("MAGENTO_CONSUMER_KEY") ?? "",
    consumerSecret: env("MAGENTO_CONSUMER_SECRET") ?? "",
    accessToken: env("MAGENTO_ACCESS_TOKEN") ?? "",
    accessSecret: env("MAGENTO_ACCESS_SECRET") ?? "",
  };
}

export function magentoConfigured(): boolean {
  const k = magentoKeys();
  return !!(k.consumerKey && k.consumerSecret && k.accessToken && k.accessSecret);
}

export function smtpConfigured(): boolean {
  const s = smtp();
  return !!(s.user && s.pass && backend().key);
}

export function sendingOn(): boolean {
  return env("DOC_SEND_EMAIL") === "1" && smtpConfigured() && magentoConfigured();
}

export function captureOn(): boolean {
  return captureFrom() > 0 && magentoConfigured();
}

/** The names a missing piece is reported under, in the order the app needs them. */
export function missingForDocuments(): string[] {
  const k = magentoKeys();
  const missing: string[] = [];
  if (!k.consumerKey) missing.push("MAGENTO_CONSUMER_KEY");
  if (!k.consumerSecret) missing.push("MAGENTO_CONSUMER_SECRET");
  if (!k.accessToken) missing.push("MAGENTO_ACCESS_TOKEN");
  if (!k.accessSecret) missing.push("MAGENTO_ACCESS_SECRET");
  if (!backend().key) missing.push("DOC_BACKEND_KEY");
  return missing;
}
