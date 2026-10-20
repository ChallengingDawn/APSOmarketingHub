// APSOhub - MICROSOFT ADS TO THE HUB (SARCLA 18.10.2026: "manual, it's shit" - and A+P's
// Azure does not let him register an app for Microsoft's API).
//
// Runs every morning inside Microsoft Advertising (Tools > Scripts, scheduled daily). Adds up
// impressions, clicks and cost per month, from January last year to yesterday, over every
// campaign of every ad account the login reaches, and sends them to the Google Sheet's web app
// (sheet-web-app.gs), which writes them into the sheet the hub reads. It reads only; it
// changes nothing in the accounts.
//
// Made at manager level (18.10: "No active account selected"), the script selects each account
// itself; made inside one account, it counts that one. Accounts in another currency than the
// first are counted for impressions and clicks; their cost is not mixed in - the hub is told.
//
// Each month goes as a total ("2026-09") and split by campaign type ("2026-09|Performance Max") -
// Microsoft's side of Google's "by network" table on Reach (SARCLA 18.10: "this table for Microsoft as well").
// The sheet's web app writes the rows as they come; it needs no change for the split.
//
// 20.10.2026: also the conversions and their value (revenue) per month - Dashboard 2026's SEA revenue, the ad
// platforms' own figure (SARCLA chose it over GA4's, which sees only the visitors who accepted statistics cookies).
// Paste the new sheet-web-app.gs too (it writes the two new columns), then redeploy it as a new version.
//
// Paste in: WEB_APP_URL (from deploying the sheet's web app) and SECRET (the same in both scripts).

const WEB_APP_URL = "PASTE THE WEB APP URL HERE";
const SECRET = "PASTE THE SECRET HERE";

function main() {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const months = [];
  for (let m = new Date(today.getFullYear() - 1, 0, 1); m <= yesterday; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    months.push({ key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`, from: asDate(m), to: asDate(last < yesterday ? last : yesterday), impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0, campaigns: 0, kinds: {} });
  }
  const names = [];
  let currency = null;
  const mixed = [];
  eachAccount((account) => {
    const cur = account.getCurrencyCode();
    names.push(account.getName());
    if (currency === null) currency = cur;
    const sameCurrency = cur === currency;
    if (!sameCurrency) mixed.push(`${account.getName()} (${cur})`);
    for (const m of months) {
      const t = monthTotals(m.from, m.to);
      m.impressions += t.impressions;
      m.clicks += t.clicks;
      m.conversions += t.conversions;
      if (sameCurrency) { m.cost += t.cost; m.revenue += t.revenue; }
      m.campaigns += t.campaigns;
      for (const [kind, k] of Object.entries(t.kinds)) {
        const a = (m.kinds[kind] = m.kinds[kind] || { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0, campaigns: 0 });
        a.impressions += k.impressions; a.clicks += k.clicks; a.conversions += k.conversions; if (sameCurrency) { a.cost += k.cost; a.revenue += k.revenue; } a.campaigns += k.campaigns;
      }
    }
  });
  if (mixed.length) Logger.log(`Cost left out for accounts in another currency than ${currency}: ${mixed.join(", ")}`);
  const rows = [];
  const r2 = (x) => Math.round(x * 100) / 100;
  for (const m of months) {
    rows.push([m.key, m.impressions, m.clicks, r2(m.cost), m.campaigns, r2(m.conversions), r2(m.revenue)]);
    for (const [kind, k] of Object.entries(m.kinds)) rows.push([`${m.key}|${kind}`, k.impressions, k.clicks, r2(k.cost), k.campaigns, r2(k.conversions), r2(k.revenue)]);
  }
  if (!revenueSeen) Logger.log("This Microsoft Advertising account's statistics give no revenue (Stats.getRevenue): the conversion value column stays 0 - tell the hub's team.");
  const payload = { secret: SECRET, account: names.join(", "), currency: mixed.length ? `${currency} (others left out of cost)` : currency, through: asText(yesterday), rows };
  const res = UrlFetchApp.fetch(WEB_APP_URL, { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true });
  Logger.log(`${names.length} account(s): ${names.join(", ")}. Sent ${months.length} months (${rows.length} rows with the campaign types) up to ${asText(yesterday)}: HTTP ${res.getResponseCode()} ${String(res.getContentText()).slice(0, 200)}`);
}

/** Every ad account the login reaches, each selected in turn; or the one the script runs in. */
function eachAccount(fn) {
  let it = null;
  try { it = AccountsApp.accounts().get(); } catch (e) { it = null; }
  let any = false;
  while (it && it.hasNext()) {
    const account = it.next();
    AccountsApp.select(account);
    fn(AdsApp.currentAccount());
    any = true;
  }
  if (!any) fn(AdsApp.currentAccount());
}

/**
 * Every campaign once, whatever its kind, and the totals per kind. The specific kinds are asked
 * first and the general list last, so a campaign carries its own kind; what only the general
 * list returns is a search campaign.
 */
const KINDS = [["performanceMaxCampaigns", "Performance Max"], ["shoppingCampaigns", "Shopping"], ["audienceCampaigns", "Audience"], ["videoCampaigns", "Video"], ["campaigns", "Search"]];
let revenueSeen = false;
function monthTotals(from, to) {
  const seen = {};
  const t = { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0, campaigns: 0, kinds: {} };
  for (const [kind, label] of KINDS) {
    if (typeof AdsApp[kind] !== "function") continue;
    let it;
    try { it = AdsApp[kind]().forDateRange(from, to).get(); } catch (e) { continue; }
    while (it.hasNext()) {
      const c = it.next();
      const id = String(c.getId());
      if (seen[id]) continue;
      seen[id] = true;
      const s = c.getStats();
      const k = (t.kinds[label] = t.kinds[label] || { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0, campaigns: 0 });
      // the conversions and their value - read defensively: an older scripts version may lack them
      const conv = typeof s.getConversions === "function" ? Number(s.getConversions()) || 0 : 0;
      const rev = typeof s.getRevenue === "function" ? Number(s.getRevenue()) || 0 : 0;
      if (typeof s.getRevenue === "function") revenueSeen = true;
      for (const x of [t, k]) {
        x.impressions += s.getImpressions();
        x.clicks += s.getClicks();
        x.cost += s.getCost();
        x.conversions += conv;
        x.revenue += rev;
        x.campaigns += 1;
      }
    }
  }
  return t;
}

const asDate = (d) => ({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
const asText = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
