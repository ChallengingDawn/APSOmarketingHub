// APSOhub - GOOGLE ADS TO THE HUB (SARCLA 20.10.2026: Dashboard 2026's SEA revenue from "the ad platforms' own
// value" - Google Analytics sees only the visitors who accepted statistics cookies, far below the real figure).
//
// Runs every morning inside Google Ads (Tools > Bulk actions > Scripts, frequency: daily). Adds up impressions,
// clicks, cost, conversions and conversion value per month, from January last year to yesterday, over every
// account the login reaches (made in a manager account) or the one account it is made in, and writes them into
// the tab "Google Ads" of the same Google Sheet the Microsoft Ads script writes - the hub reads it with its
// service account. It reads only; it changes nothing in the accounts. A Google Ads script writes to a Google
// Sheet itself, so no web app is needed here; the Google login that runs it must be able to edit the sheet.
//
// Paste in: SHEET_ID - the sheet's id from its address (docs.google.com/spreadsheets/d/<THIS PART>/edit).

const SHEET_ID = "16QuE9tOmBMEMvAj8mdCLLcgytix9hM4bKONB7iwkcdQ";
const TAB = "Google Ads";

function main() {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const from = `${today.getFullYear() - 1}-01-01`, to = ymd(yesterday);
  const months = {};
  const names = [];
  let currency = null;
  const mixed = [];
  eachAccount((account) => {
    const cur = account.getCurrencyCode();
    names.push(account.getName());
    if (currency === null) currency = cur;
    const same = cur === currency;
    if (!same) mixed.push(`${account.getName()} (${cur})`);
    const rows = AdsApp.search(
      "SELECT segments.month, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value " +
      `FROM customer WHERE segments.date BETWEEN '${from}' AND '${to}'`);
    while (rows.hasNext()) {
      const r = rows.next();
      const key = String(r.segments.month).slice(0, 7);
      const m = (months[key] = months[key] || { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 });
      m.impressions += Number(r.metrics.impressions) || 0;
      m.clicks += Number(r.metrics.clicks) || 0;
      m.conversions += Number(r.metrics.conversions) || 0;
      // money of an account in another currency is not mixed in - the hub is told
      if (same) { m.cost += (Number(r.metrics.costMicros) || 0) / 1e6; m.revenue += Number(r.metrics.conversionsValue) || 0; }
    }
  });
  const r2 = (x) => Math.round(x * 100) / 100;
  const written = new Date().toISOString();
  const cur = mixed.length ? `${currency} (others left out of cost)` : currency;
  const values = [["month", "impressions", "clicks", "cost", "currency", "conversions", "revenue", "account", "through", "written"]];
  for (const key of Object.keys(months).sort()) {
    const m = months[key];
    values.push([key, m.impressions, m.clicks, r2(m.cost), cur, r2(m.conversions), r2(m.revenue), names.join(", "), to, written]);
  }
  const book = SpreadsheetApp.openById(SHEET_ID);
  const sheet = book.getSheetByName(TAB) || book.insertSheet(TAB);
  sheet.clearContents();
  // the months stay text ("2026-09"), never dates
  sheet.getRange(1, 1, values.length, 1).setNumberFormat("@");
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  if (mixed.length) Logger.log(`Cost and value left out for accounts in another currency than ${currency}: ${mixed.join(", ")}`);
  Logger.log(`${names.length} account(s): ${names.join(", ")}. Wrote ${values.length - 1} months up to ${to} into "${TAB}".`);
}

/** Every account a manager login reaches, each selected in turn; or the one account the script is made in. */
function eachAccount(fn) {
  if (typeof AdsManagerApp !== "undefined") {
    const it = AdsManagerApp.accounts().get();
    let any = false;
    while (it.hasNext()) {
      const account = it.next();
      AdsManagerApp.select(account);
      fn(AdsApp.currentAccount());
      any = true;
    }
    if (any) return;
  }
  fn(AdsApp.currentAccount());
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
