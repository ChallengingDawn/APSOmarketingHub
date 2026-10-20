// APSOhub - GOOGLE ADS TO THE HUB (SARCLA 20.10.2026: Dashboard 2026's SEA revenue from "the ad platforms' own
// value" - Google Analytics sees only the visitors who accepted statistics cookies, far below the real figure).
//
// Runs every morning inside Google Ads (Tools > Bulk actions > Scripts, frequency: daily). Adds up impressions,
// clicks, cost, conversions and conversion value per month, from January last year to yesterday, and writes them
// into the Google Sheet the Microsoft Ads script writes too - ONE TAB PER ACCOUNT, "Google Ads 975-499-5314": paste
// the same script into every APSOparts account (DE, CH...) and each keeps its own tab; the hub adds them up. Made in
// a manager account, it does every account below it in one go. It reads only; it changes nothing in the accounts.
// A Google Ads script writes to a Google Sheet itself, so no web app is needed; the Google login that runs it must
// be able to edit the sheet.

const SHEET_ID = "16QuE9tOmBMEMvAj8mdCLLcgytix9hM4bKONB7iwkcdQ";

function main() {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const from = `${today.getFullYear() - 1}-01-01`, to = ymd(yesterday);
  const book = SpreadsheetApp.openById(SHEET_ID);
  const written = new Date().toISOString();
  const r2 = (x) => Math.round(x * 100) / 100;
  const done = [];
  eachAccount((account) => {
    const months = {};
    const rows = AdsApp.search(
      "SELECT segments.month, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value " +
      `FROM customer WHERE segments.date BETWEEN '${from}' AND '${to}'`);
    while (rows.hasNext()) {
      const r = rows.next();
      const key = String(r.segments.month).slice(0, 7);
      const m = (months[key] = months[key] || { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 });
      m.impressions += Number(r.metrics.impressions) || 0;
      m.clicks += Number(r.metrics.clicks) || 0;
      m.cost += (Number(r.metrics.costMicros) || 0) / 1e6;
      m.conversions += Number(r.metrics.conversions) || 0;
      m.revenue += Number(r.metrics.conversionsValue) || 0;
    }
    const id = account.getCustomerId(), name = account.getName(), currency = account.getCurrencyCode();
    const values = [["month", "impressions", "clicks", "cost", "currency", "conversions", "revenue", "account", "through", "written"]];
    for (const key of Object.keys(months).sort()) {
      const m = months[key];
      values.push([key, m.impressions, m.clicks, r2(m.cost), currency, r2(m.conversions), r2(m.revenue), `${name} (${id})`, to, written]);
    }
    const tab = `Google Ads ${id}`;
    const sheet = book.getSheetByName(tab) || book.insertSheet(tab);
    sheet.clearContents();
    // the months stay text ("2026-09"), never dates
    sheet.getRange(1, 1, values.length, 1).setNumberFormat("@");
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    done.push(`${name} (${id}, ${currency}): ${values.length - 1} months`);
  });
  Logger.log(`Wrote up to ${to}: ${done.join("; ")}`);
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
