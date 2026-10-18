// APSOhub - MICROSOFT ADS TO THE HUB (SARCLA 18.10.2026: "manual, it's shit" - and A+P's
// Azure does not let him register an app for Microsoft's API).
//
// Runs every morning inside Microsoft Advertising (Tools > Scripts, scheduled daily). Adds up
// impressions, clicks and cost per month, from January last year to yesterday, over every
// campaign of the account, and sends them to the Google Sheet's web app (sheet-web-app.gs),
// which writes them into the sheet the hub reads. It reads only; it changes nothing in the account.
//
// Paste in: WEB_APP_URL (from deploying the sheet's web app) and SECRET (the same in both scripts).

const WEB_APP_URL = "PASTE THE WEB APP URL HERE";
const SECRET = "PASTE THE SECRET HERE";

function main() {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const rows = [];
  for (let m = new Date(today.getFullYear() - 1, 0, 1); m <= yesterday; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    const end = last < yesterday ? last : yesterday;
    const t = monthTotals(asDate(m), asDate(end));
    rows.push([`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`, t.impressions, t.clicks, Math.round(t.cost * 100) / 100, t.campaigns]);
  }
  const account = AdsApp.currentAccount();
  const payload = { secret: SECRET, account: account.getName(), currency: account.getCurrencyCode(), through: asText(yesterday), rows };
  const res = UrlFetchApp.fetch(WEB_APP_URL, { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true });
  Logger.log(`Sent ${rows.length} months up to ${asText(yesterday)}: HTTP ${res.getResponseCode()} ${String(res.getContentText()).slice(0, 200)}`);
}

/** Every campaign once, whatever its kind - search, shopping, Performance Max, video. */
function monthTotals(from, to) {
  const seen = {};
  const t = { impressions: 0, clicks: 0, cost: 0, campaigns: 0 };
  for (const kind of ["campaigns", "shoppingCampaigns", "performanceMaxCampaigns", "videoCampaigns", "audienceCampaigns"]) {
    if (typeof AdsApp[kind] !== "function") continue;
    let it;
    try { it = AdsApp[kind]().forDateRange(from, to).get(); } catch (e) { continue; }
    while (it.hasNext()) {
      const c = it.next();
      const id = String(c.getId());
      if (seen[id]) continue;
      seen[id] = true;
      const s = c.getStats();
      t.impressions += s.getImpressions();
      t.clicks += s.getClicks();
      t.cost += s.getCost();
      t.campaigns += 1;
    }
  }
  return t;
}

const asDate = (d) => ({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
const asText = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
